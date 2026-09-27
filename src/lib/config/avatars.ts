import { fnv1a } from '$lib/utils/fnv';

/**
 * АВАТАР — КОРОТКИЙ РЯДОК `значок:колір`, а не картинка.
 *
 * ## Чому не зображення
 *
 * Зберігати його було б ніде: Storage у проєкті немає, а заводити його заради
 * підпису в списку — це і правила доступу до файлів, і межа розміру, і чистка
 * покинутого, і CSP на новий origin. У RTDB же лежать самі поля, і кожне з них
 * має межу: `payload` кімнати рахується в кілобайтах, а `members/$uid` пише
 * КОЖЕН вхід у кімнату. `cat:blue` важить девʼять байтів і не додає жодного
 * нового механізму — ідея взята з сусіднього `Slovko`, де той самий вибір
 * записано рядком `internal:{значок}:{колір}` у полі `photoURL`.
 *
 * ## Чому два незалежні виміри, а не один список
 *
 * Вісімнадцять значків і дванадцять кольорів дають 216 різних підписів
 * тридцятьма кнопками. Готовий список із 216 картинок займав би екран прокруткою
 * й не давав би нічого зверху.
 *
 * ## Значки — лише `lucide-svelte`
 *
 * Системні емодзі в UI заборонені (AGENTS.md): на Windows замість прапора
 * стоять дві літери, і те саме буває з тваринами.
 *
 * ## Межа довжини тут і в правилах бази — ОДНЕ число
 *
 * `AVATAR_MAX` дублюється в `database.rules.json` (три вузли), і розійшовшись,
 * ці два числа дали б аватар, який видно на екрані й який база відкидає, —
 * тобто «не вдалося зайти в кімнату» без жодної причини. Найдовша пара зараз
 * `squirrel:magenta` (16), а 24 лишає місце на довшу назву без перевикладання
 * правил. Саме межа й тримає запис обмеженим: взірець `[a-z]+:[a-z]+` сам собою
 * пропустив би мегабайт літер. Переліку значків у правилах немає — тож нові
 * значки й кольори бази не зачіпають.
 */

/**
 * Тварини — спершу, і лише тварини замінюють значки, яких більше немає
 * (`normaliseAvatar`): рішення автора 2026-09-27 (12-A, 13-A).
 */
export const AVATAR_ANIMALS = [
	'cat',
	'dog',
	'rabbit',
	'bird',
	'fish',
	'snail',
	'turtle',
	'bug',
	'squirrel',
	'rat',
	'panda',
	'worm',
	'shrimp'
] as const;

/** Фрукти й овочі — добирають набір до вісімнадцяти (12-A). */
export const AVATAR_PLANTS = ['carrot', 'banana', 'cherry', 'apple', 'grape'] as const;

/** Значки. Порядок — той, у якому вони стоять у виборі: тварини, тоді рослини. */
export const AVATAR_ICONS = [...AVATAR_ANIMALS, ...AVATAR_PLANTS] as const;

/**
 * ЗНАЧКИ, ЯКИХ БІЛЬШЕ НЕМАЄ (рішення автора 2026-09-27, 12-A): людина й знаки — смайл,
 * зірка, серце, блискавка, мішень. У сховищах і в профілях вони лишилися, і читаються
 * твариною того самого кольору (`normaliseAvatar`), а не порожнім місцем.
 */
const RETIRED_ICONS: readonly string[] = ['user', 'smile', 'star', 'heart', 'zap', 'target'];

/**
 * Кольори тла — ІМЕНАМИ, а не значеннями.
 *
 * У рядок їде імʼя (`cat:blue`), а не `#1d4ed8`, і причина не в довжині: колір
 * мусить лишитися тим самим після зміни палітри, і мусить бути перевірним. Самі
 * значення живуть токенами `--color-avatar-*` у `global.css`, тобто їхній
 * контраст із білим значком звіряє `src/contrast.test.ts` у всіх чотирьох темах,
 * а не чиєсь око.
 *
 * Порядок — за відтінком (вибір читається веселкою, а не списком): чотири нові кольори
 * (14-A) стоять поруч зі своїми сусідами — коричневий біля оранжевого, оливковий перед
 * зеленим, темно-синій після синього, пурпуровий між фіолетовим і рожевим.
 *
 * Палітра НЕ залежить від теми, і це рішення: аватар відрізняє людину, тож він
 * мусить виглядати однаково в мене й у неї. Видимість плитки на будь-якій
 * панелі дає тонка рамка з кольору тексту — той самий прийом, що у `Flag`.
 */
export const AVATAR_COLORS = [
	'red',
	'orange',
	'brown',
	'olive',
	'green',
	'teal',
	'blue',
	'navy',
	'violet',
	'magenta',
	'pink',
	'slate'
] as const;

export type AvatarIcon = (typeof AVATAR_ICONS)[number];
export type AvatarColor = (typeof AVATAR_COLORS)[number];

/** Аватар, розібраний на дві частини. */
export interface AvatarLook {
	icon: AvatarIcon;
	color: AvatarColor;
}

/** Межа довжини рядка. Те саме число стоїть у `database.rules.json`. */
export const AVATAR_MAX = 24;

/** Ключ сховища. Префікс `vetcrewgames_` додає фасад `storage`. */
export const AVATAR_KEY = 'pairs.avatar';

/** Взірець форми. Той самий стоїть у правилах бази. */
const SHAPE = /^[a-z]+:[a-z]+$/;

const includes = (list: readonly string[], item: string) => list.includes(item);

/**
 * Чи це наш аватар — тобто відома пара з ЧИННИХ списків.
 *
 * Перевіряється НЕ лише форма: `dragon:gold` формі відповідає, а намалювати
 * його нічим. Значок, якого більше немає (`star:red`), теж не чинний — його
 * переводить у чинний `normaliseAvatar`.
 */
export function isAvatar(value: unknown): value is string {
	if (typeof value !== 'string' || value.length > AVATAR_MAX || !SHAPE.test(value)) return false;
	const [icon, color] = value.split(':');
	return includes(AVATAR_ICONS, icon) && includes(AVATAR_COLORS, color);
}

/**
 * АВАТАР, ЯКИЙ МОЖНА НАМАЛЮВАТИ, — або порожньо.
 *
 * Значок, якого більше немає, переходить у ТВАРИНУ ТОГО САМОГО КОЛЬОРУ (рішення автора
 * 2026-09-27, 13-A: «мовчки замінити на випадкову тварину того самого кольору»). Тварину
 * вибирає хеш самого рядка, а не `Math.random`: той самий `star:red` стає тією самою
 * твариною на кожному пристрої й у кожного, хто бачить його в кімнаті, — інакше
 * «випадкова» заміна в мене й у нього була б різною, і одну людину бачили б двома.
 */
export function normaliseAvatar(value: unknown): string {
	if (isAvatar(value)) return value;
	if (typeof value !== 'string' || value.length > AVATAR_MAX || !SHAPE.test(value)) return '';
	const [icon, color] = value.split(':');
	if (!includes(RETIRED_ICONS, icon) || !includes(AVATAR_COLORS, color)) return '';
	return `${AVATAR_ANIMALS[fnv1a(value) % AVATAR_ANIMALS.length]}:${color}`;
}

/**
 * ЧИ Є ЩО ПОКАЗАТИ — чинна пара або значок, якого більше немає.
 *
 * Типової плитки тепер немає: кожен має аватарку з першого візиту (випадкову, доки не
 * вибере сам, — `services/playerAvatar`), тож показується кожна, що є. Порожньо чи
 * зіпсовано — нічого: плитка стоїть поруч з іменем і нічого до нього не додає.
 */
export function hasAvatar(value: unknown): boolean {
	return normaliseAvatar(value) !== '';
}

/**
 * Розібрати аватар. Порожнє чи невідоме — перший значок першого кольору: це відповідь
 * лише на «чим малювати ВИБІР», де щось мусить бути позначене. Чи малювати плитку
 * взагалі — питання `hasAvatar`.
 */
export function parseAvatar(value: unknown): AvatarLook {
	const avatar = normaliseAvatar(value);
	if (avatar === '') return { icon: AVATAR_ICONS[0], color: AVATAR_COLORS[0] };
	const [icon, color] = avatar.split(':');
	return { icon: icon as AvatarIcon, color: color as AvatarColor };
}

/** Зібрати аватар у рядок для запису. */
export function formatAvatar(icon: AvatarIcon, color: AvatarColor): string {
	return `${icon}:${color}`;
}

/** Випадкова пара з усього набору — аватарка нового гравця (рішення автора 2026-09-27, 8-A). */
export function randomAvatar(random: () => number): string {
	const at = (length: number) => Math.min(length - 1, Math.floor(random() * length));
	return formatAvatar(
		AVATAR_ICONS[at(AVATAR_ICONS.length)],
		AVATAR_COLORS[at(AVATAR_COLORS.length)]
	);
}
