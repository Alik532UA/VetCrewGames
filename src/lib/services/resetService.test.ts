import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/paths', () => ({ base: '/VetCrewGames' }));

/**
 * Аварійне скидання: що воно стирає, і що станеться, коли проєкт зміниться.
 *
 * Файл ділиться на дві половини, і потрібні обидві.
 *
 * **Структурна** читає джерело регексом. Вона дешева й ловить те, що поведінкою
 * не видно взагалі: що текст підтвердження НЕ йде через i18n, що кожна половина
 * стоїть під власним `try`, що префікс береться з одного джерела зі сховищем.
 *
 * **Поведінкова** проганяє сам `hardReset` над підставними `caches`,
 * `serviceWorker` і сховищем, у яких лежать ключі й scope СУСІДНІХ проєктів.
 * Тут її доти не було, і в цьому докблоці стояло пояснення чому: мовляв,
 * `hardReset` наприкінці кличе `window.location.reload()`, тож повний прогін у
 * jsdom «або нічого не робить, або валить оточення тесту». Насправді
 * `vi.stubGlobal('location', …)` знімає це одним рядком — а без поведінкової
 * половини покриття файлу було 8,33% рядків, і головна його властивість
 * трималася на тому, що регекс бачить рядок `startsWith(scopePrefix)`.
 *
 * Різниця між «рядок є» і «фільтр працює» тут коштує ЧУЖИХ даних: origin
 * спільний, і в `Slovko` цей самий код знімав service worker `MindStep`. Джерела
 * там теж виглядали розумно.
 *
 * Зворотний експеримент прогнано на трьох захистах окремо: без фільтра за
 * `scope` падають 3 перевірки, без фільтра кешів за префіксом — 2, без
 * підтвердження — 2.
 */
const SOURCE = 'src/lib/services/resetService.ts';
const source = readFileSync(SOURCE, 'utf8');
/**
 * Код без комментарів.
 *
 * Потрібно, бо докблок цитує `localStorage.clear()` саме як опис того, чого
 * робити НЕ можна — і перевірка «прямого clear() немає» ловила б цю цитату.
 * Той самий прийом уже стоїть у перевірках правил бази.
 */
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('аварійне скидання', () => {
	it('перевірка жива: файл знайдено', () => {
		expect(source).toContain('export async function hardReset');
	});

	it('стирає лише СВОЄ: через фасад, а не через сховище напряму', () => {
		/*
		 * Origin спільний із сусідніми проєктами на GitHub Pages, тож
		 * `localStorage.clear()` знищив би чужі дані. Фасад видаляє лише ключі з
		 * префіксом `vetcrewgames_` (STORAGE-NAMESPACE-v8 § 2).
		 */
		expect(code, 'сховище чиститься фасадом').toMatch(/\bstorage\.clear\(\)/);
		expect(code, 'сесійне сховище теж').toMatch(/\bsessionStore\.clear\(\)/);
		expect(code, 'прямий clear() знищив би дані сусідів').not.toMatch(
			/localStorage\.clear\(\)|sessionStorage\.clear\(\)/
		);
	});

	it('кукі стираються лише свого шляху', () => {
		// Без `path`, що збігається з поставленим, запис не видаляється, а дублюється.
		expect(source).toMatch(/path=\$\{path\}/);
		expect(source).toMatch(/base \|\| '\/'/);
	});

	it('у проді підтвердження обов’язкове (два незалежні бар’єри)', () => {
		expect(source, 'діалог мусить бути').toMatch(/window\.confirm\(/);
		expect(source, 'поріг проду мусить бути іншим за dev').toMatch(/RESET_PRESSES_PROD/);
	});

	it('пороги: 5 у dev, 55 у проді', async () => {
		const { RESET_PRESSES_DEV, RESET_PRESSES_PROD } = await import('./resetService');
		// Ціна випадкового спрацювання — увесь місцевий прогрес.
		expect(RESET_PRESSES_DEV).toBe(5);
		expect(RESET_PRESSES_PROD).toBe(55);
	});

	it('текст підтвердження НЕ через i18n — і це записано', () => {
		/*
		 * `confirm()` може знадобитися саме тоді, коли зламалося завантаження
		 * словників: `t()` віддав би ключ, тобто людина побачила б «reset.confirm»
		 * перед знищенням прогресу. Виняток свідомий, і причина стоїть у файлі.
		 */
		expect(source, 'i18n у діалозі скидання — пастка').not.toMatch(/\bt\(['"]/);
		expect(source, 'виняток мусить бути обґрунтований у самому файлі').toMatch(/i18n/);
	});

	it('кеші стираються — і ЛИШЕ свої, за префіксом', () => {
		/*
		 * PWA тут ще немає, тож сьогодні цей код не робить нічого. Написаний він
		 * заздалегідь навмисно: `caches.keys()` віддає імена кешів усього ORIGIN, і
		 * дописувати фільтр у поспіху, коли PWA вже приїхала, — це рівно той спосіб,
		 * яким скидання перетворюється на «стерти все, що є на домені».
		 */
		expect(code, 'кеші мусять чиститися').toMatch(/caches\.keys\(\)/);
		expect(code, 'фільтр за префіксом проєкту — обовʼязковий').toMatch(/startsWith\(PREFIX\)/);
		expect(code, 'префікс мусить бути з ОДНОГО джерела зі сховищем').toMatch(/from '\.\/storage'/);
		// Видалення без фільтра — саме те, чого тут не має бути.
		expect(code, 'жодного delete по всіх іменах').not.toMatch(
			/names\.map\(|keys\.map\(\s*\(?name\)?\s*=>\s*caches\.delete/
		);
	});

	it('реєстрації service worker знімаються — і ЛИШЕ свої, за scope', () => {
		/*
		 * Найважливіша перевірка цього файлу, і вона про чужі дані.
		 *
		 * `getRegistrations()` віддає реєстрації всього ORIGIN. `Slovko` проходить по
		 * всіх і знімає кожну — тобто одне натискання `r` там вбиває service worker
		 * MindStep і будь-якого іншого проєкту на `alik532ua.github.io`. Тут scope
		 * мусить лежати всередині `base`.
		 *
		 * Порівняння саме як АДРЕСИ: `scope` завжди абсолютний
		 * (`https://host/VetCrewGames/`), а `base` — шлях (`/VetCrewGames`), тож пряме
		 * `startsWith(base)` не збіглося б ніколи й фільтр тихо відкинув би все.
		 */
		expect(code, 'реєстрації мусять зніматися').toMatch(/getRegistrations\(\)/);
		expect(code, 'фільтр за scope — обовʼязковий').toMatch(
			/registration\.scope\.startsWith\(scopePrefix\)/
		);
		expect(code, 'scope порівнюється як адреса, а не як шлях').toMatch(
			/new URL\(`\$\{base \|\| ''\}\/`, window\.location\.origin\)/
		);
	});

	it('кожна половина під власним try: збій однієї не скасовує решту', () => {
		// Спільний `try` означав би: не вдалося стерти кукі — і кеші лишилися.
		// Скидання кличуть, коли вже зламано, тож воно робить стільки, скільки може.
		const tries = (code.match(/(?:^|\s)try\s*\{/g) ?? []).length;
		expect(tries, 'try мусить бути кілька, а не один на все').toBeGreaterThanOrEqual(4);
	});

	it('обидві половини під перевіркою наявності — сьогодні вони no-op', () => {
		// Проєкт ще без PWA. Без цих guard-ів код кидав би на кожному скиданні.
		expect(code).toMatch(/'caches' in window/);
		expect(code).toMatch(/'serviceWorker' in navigator/);
	});
});

/**
 * Друга половина: що скидання РОБИТЬ, а не з чого воно написане.
 *
 * Перевірки вище читають джерело регексом, і цього замало саме тут. Регекс
 * доводить, що в коді стоїть `startsWith(scopePrefix)`; він не доводить, що
 * `scopePrefix` складений так, щоб чужі реєстрації в нього не потрапили. А ціна
 * помилки в цьому рядку — дані СУСІДНІХ проєктів на спільному origin: у
 * `Slovko` одне натискання `r` знімало service worker `MindStep`, і джерела там
 * теж виглядали розумно.
 *
 * Тому нижче — прогін самого `hardReset` над підставними `caches`,
 * `serviceWorker` і сховищем, із ключами й scope сусідів у них. Покриття
 * `resetService.ts` до цього блоку — 8,33% рядків (`npm test`, 2026-08-20).
 */
describe('аварійне скидання: поведінка', () => {
	const OWN_SCOPE = 'https://alik532ua.github.io/VetCrewGames/';
	const NEIGHBOUR_SCOPE = 'https://alik532ua.github.io/MindStep/';

	/** Те саме підставне сховище, що в `storage.test.ts`: у прогоні свого немає. */
	function makeStorage(entries: Record<string, string>): Storage {
		const data = new Map(Object.entries(entries));
		return {
			get length() {
				return data.size;
			},
			key: (i: number) => [...data.keys()][i] ?? null,
			getItem: (k: string) => data.get(k) ?? null,
			setItem: (k: string, v: string) => void data.set(k, v),
			removeItem: (k: string) => void data.delete(k),
			clear: () => data.clear()
		} as Storage;
	}

	let local: Storage;
	let session: Storage;
	let deletedCaches: string[];
	let unregistered: string[];

	beforeEach(() => {
		vi.resetModules();
		deletedCaches = [];
		unregistered = [];

		// Ключі сусідів по origin — саме вони мусять пережити скидання.
		local = makeStorage({
			mindstep_progress: 'чуже',
			slovko_deck: 'теж чуже',
			vetcrewgames_score: 'своє'
		});
		session = makeStorage({ mindstep_session: 'чуже', vetcrewgames_logs: 'своє' });
		vi.stubGlobal('localStorage', local);
		vi.stubGlobal('sessionStorage', session);

		vi.stubGlobal('caches', {
			keys: async () => ['vetcrewgames_v1', 'vetcrewgames_images', 'mindstep_v3', 'slovko_words'],
			delete: async (name: string) => {
				deletedCaches.push(name);
				return true;
			}
		});

		vi.stubGlobal('navigator', {
			onLine: true,
			serviceWorker: {
				getRegistrations: async () => [
					{ scope: OWN_SCOPE, unregister: async () => void unregistered.push(OWN_SCOPE) },
					{
						scope: NEIGHBOUR_SCOPE,
						unregister: async () => void unregistered.push(NEIGHBOUR_SCOPE)
					}
				]
			}
		});

		// Перезавантаження наприкінці — єдине, чого в jsdom зробити неможливо.
		vi.stubGlobal('location', { origin: 'https://alik532ua.github.io', reload: () => {} });
		vi.stubGlobal('confirm', () => true);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('перевірка жива: підставні сусіди на місці до скидання', () => {
		expect(local.getItem('mindstep_progress')).toBe('чуже');
		expect(local.getItem('vetcrewgames_score')).toBe('своє');
	});

	it('стирає СВОЇ ключі й лишає чужі', async () => {
		const { hardReset } = await import('./resetService');
		await hardReset(false);

		expect(local.getItem('vetcrewgames_score'), 'своє мусило зникнути').toBeNull();
		expect(session.getItem('vetcrewgames_logs'), 'своє мусило зникнути').toBeNull();

		expect(local.getItem('mindstep_progress'), 'дані сусіда').toBe('чуже');
		expect(local.getItem('slovko_deck'), 'дані сусіда').toBe('теж чуже');
		expect(session.getItem('mindstep_session'), 'дані сусіда').toBe('чуже');
	});

	it('видаляє лише кеші зі своїм префіксом', async () => {
		const { hardReset } = await import('./resetService');
		await hardReset(false);

		expect(deletedCaches.sort()).toEqual(['vetcrewgames_images', 'vetcrewgames_v1']);
		expect(deletedCaches, 'кеш сусіда').not.toContain('mindstep_v3');
		expect(deletedCaches, 'кеш сусіда').not.toContain('slovko_words');
	});

	it('знімає лише реєстрації всередині свого base — головна перевірка файлу', async () => {
		/*
		 * `getRegistrations()` віддає реєстрації ВСЬОГО origin. Тут їх дві, і
		 * зникнути мусить рівно одна. Порівняння йде як адреса: `scope` завжди
		 * абсолютний, а `base` — шлях, тож пряме `startsWith(base)` не збіглося б
		 * ніколи й фільтр тихо відкинув би все — тобто виглядав би як обережність,
		 * а працював би як «не робити нічого».
		 */
		const { hardReset } = await import('./resetService');
		await hardReset(false);

		expect(unregistered).toEqual([OWN_SCOPE]);
		expect(unregistered, 'service worker сусіда').not.toContain(NEIGHBOUR_SCOPE);
	});

	it('відмова в підтвердженні не стирає нічого', async () => {
		vi.stubGlobal('confirm', () => false);
		const { hardReset } = await import('./resetService');
		await hardReset(true);

		expect(local.getItem('vetcrewgames_score')).toBe('своє');
		expect(deletedCaches).toEqual([]);
		expect(unregistered).toEqual([]);
	});

	it('збій однієї половини не скасовує решту', async () => {
		// Кожна половина під власним try: скидання кличуть, коли вже зламано, тож
		// воно мусить зробити стільки, скільки зможе.
		vi.stubGlobal('caches', {
			keys: async () => {
				throw new Error('Cache API заблоковано');
			},
			delete: async () => true
		});

		const { hardReset } = await import('./resetService');
		await expect(hardReset(false), 'аварійний шлях не має права кидати').resolves.toBeUndefined();

		expect(local.getItem('vetcrewgames_score'), 'сховище все одно стерте').toBeNull();
		expect(unregistered, 'реєстрації все одно зняті').toEqual([OWN_SCOPE]);
	});
});
