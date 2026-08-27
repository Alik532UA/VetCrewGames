<script lang="ts">
	import { Sun, Moon, Snowflake, Leaf, Keyboard, KeyboardOff, CircleUser } from 'lucide-svelte';
	import { page } from '$app/state';
	import { t, formatPlain } from '$lib/i18n';
	import { fullscreen } from '$lib/services/fullscreen.svelte';
	import { acceptsShortcut } from '$lib/services/keyboard';
	import { settings } from '$lib/services/settings.svelte';
	import { LANGUAGE_META, flagSrc, languageLabel } from '$lib/i18n/languages';
	import { langPath, languageFromParam, routeRestFromId, type Language } from '$lib/i18n/routing';
	import { THEME_OPTIONS, type Theme } from '$lib/config/themes';
	import HeaderMenu from './HeaderMenu.svelte';
	import { playerAvatar } from '$lib/services/playerAvatar.svelte';
	import { paintAvatar } from '$lib/features/headerAvatar';

	/**
	 * Тема й мова — два, що відвідувач міняє в шапці.
	 *
	 * Разом в одному компоненті, бо це один ряд і ОДНА поведінка: відкритим може
	 * бути лише щось одне, і цьому правилу нема де жити всередині окремого меню.
	 *
	 * Тема доти перемикалася кнопкою по колу. З двома темами це працює, з
	 * чотирма — ні: щоб дістатися четвертої, треба тричі клацнути й тричі
	 * подивитися на те, чого не просив. Той самий висновок, що й із мовою.
	 */
	let openMenu = $state<'theme' | 'lang' | null>(null);

	/**
	 * Чи показувати вимикач гарячих клавіш у шапці.
	 *
	 * `false` тут стояло з 2026-08-23 на прохання автора: кнопка займає місце в
	 * ряду, а користуються нею рідко. ПОВЕРНЕНО 2026-08-27, і не «бо гарніше».
	 *
	 * Умова того рішення записана була тут-таки, над самою кнопкою: «Якщо
	 * перемикач не повернеться, вимикач мусить з'явитися десь інде: скорочення
	 * без способу їх вимкнути порушують критерій прямо». Він не з'явився ніде.
	 * `settings.setShortcutsEnabled` має РІВНО ОДНОГО кличущого в усьому
	 * застосунку — кнопку нижче, і чотири дні вона була під `{#if false}`.
	 *
	 * Тобто весь цей час WCAG SC 2.1.4 (рівень A, `HK-WCAG-CHARACTER-KEY`,
	 * CRITICAL) не виконувався ЖОДНИМ із трьох способів: вимкнути не було звідки,
	 * перепризначити нема чим, а `T`, `L`, `F`, `V`, `R` діють на вікні, а не у
	 * фокусі компонента. Найдорожче це для тих, хто диктує голосом: диктування
	 * розсипається на одиночні літери, і кожна «т» міняла б тему.
	 *
	 * Заперечення автора при цьому лишається справедливим і не знехтуване: ряд
	 * шапки на 390px виміряно з поверненою кнопкою — переповнення немає
	 * (`tests/shortcuts.spec.ts`). Якщо кнопка все-таки має піти з ряду, вимикач
	 * мусить з'явитися в іншому місці ТИМ САМИМ комітом, а не «колись»: гейт
	 * нижче впаде саме на цьому.
	 */
	const SHOW_SHORTCUTS_TOGGLE = true;

	/**
	 * Значки живуть тут, поруч із розміткою, а не в конфігу тем: інакше
	 * `lucide-svelte` тягнеться в `settings`, а звідти — у кожен тест, що бере
	 * налаштування.
	 *
	 * `Record<Theme, …>`, а не масив: TypeScript ВИМАГАЄ ключ на кожну тему, тож
	 * тема без значка стає помилкою збірки, а не порожнім місцем у меню.
	 */
	const ICONS: Record<Theme, typeof Sun> = {
		dark: Moon,
		'light-green': Sun,
		winter: Snowflake,
		'orange-purple': Leaf
	};

	const CurrentThemeIcon = $derived(ICONS[settings.theme]);

	const current = $derived(languageFromParam(page.params.lang));
	const rest = $derived(routeRestFromId(page.route.id));

	/*
	 * Закриття будь-яким кліком повз меню. В `$effect`, щоб слухач ішов разом із
	 * компонентом, а не жив довше за нього.
	 *
	 * Доти цю роль грала підкладка на весь екран — і саме вона ламала повторний
	 * натиск по кнопці: підкладка ловила `pointerdown` і закривала меню, а
	 * `click` уже доходив до кнопки, яка відкривала його знову. Клік по кнопці
	 * тепер не доходить сюди взагалі (`stopPropagation` у HeaderMenu), тож
	 * лишається саме те, що й мало бути: перемикач.
	 */
	$effect(() => {
		const close = () => (openMenu = null);
		window.addEventListener('click', close);
		return () => window.removeEventListener('click', close);
	});

	/**
	 * Гарячі клавіші: `T` — тема, `L` — меню мов, `F` — на весь екран, `Esc` —
	 * закрити (HOTKEYS-v8 § 1.1).
	 *
	 * **Три з чотирьох — одиночні літери, тож діють вони лише поки увімкнено
	 * `settings.shortcutsEnabled`** (WCAG SC 2.1.4, рівень A). Прапорець іде в
	 * `acceptsShortcut` параметром, і параметр цей обовʼязковий: забути про
	 * вимикач у новому обробнику не можна — не збереться.
	 *
	 * **Обробник живе тут, а не в кореневому layout, і це не випадково.** Обидві
	 * дії потребують стану, яким володіє саме цей компонент: `openMenu`. Підняти
	 * його в окремий модуль заради клавіші означало б завести ДРУГОГО власника
	 * стану, і розходження між кнопкою й клавішею стало б питанням часу. Шапка
	 * рендериться на кожній сторінці, тож `svelte:window` тут має ту саму
	 * досяжність, що й у layout, і знімається сам разом із компонентом.
	 *
	 * **`T` перемикає по колу, `L` відкриває МЕНЮ.** Різниця не в смаку: тему
	 * задає `settings.setTheme`, тобто дія суто клієнтська й миттєва. Мову ж
	 * перемикає НАВІГАЦІЯ (`langPath` — це `href`), і «наступна мова» по колу
	 * означала б до трьох перезавантажень, щоб дійти до потрібної. Тому клавіша
	 * робить те саме, що кнопка: відкриває список.
	 */
	function handleShortcut(event: KeyboardEvent) {
		if (!acceptsShortcut(event, settings.shortcutsEnabled)) return;

		if (event.code === 'Escape') {
			if (openMenu === null) return;
			openMenu = null;
			event.preventDefault();
			return;
		}

		if (event.code === 'KeyT') {
			const order = THEME_OPTIONS.map((option) => option.id);
			const next = order[(order.indexOf(settings.theme) + 1) % order.length];
			settings.setTheme(next as Theme);
			// `preventDefault` лише після того, як дія відбулася (HOTKEYS-v8 § 2.4).
			event.preventDefault();
			return;
		}

		if (event.code === 'KeyL') {
			openMenu = openMenu === 'lang' ? null : 'lang';
			event.preventDefault();
			return;
		}

		if (event.code === 'KeyF') {
			void fullscreen.toggle();
			event.preventDefault();
		}
	}
</script>

<svelte:window onkeydown={handleShortcut} />

<!--
	Вимикач гарячих клавіш — виконання WCAG SC 2.1.4 (рівень A) і водночас те, що
	робить самі скорочення виявними: доти про них не було написано ніде
	(HOTKEYS-v8 § 5).

	Стан несе `aria-pressed`, а не підпис: підпис називає ДІЮ, яку виконає натиск.
	Значок так само показує, що станеться, а не що є, — інакше кнопка й підпис
	говорили б різне.

	`aria-label` — БЕЗ `formatPlain()`: та функція міняє кириличну «і» на
	латинську «i», щоб літера була у шрифті inglobal. Для того, що малюється, це
	правильно; для того, що читає машина, — ні, бо «Вимкнути гарячi клавiшi» з
	латинською i вимовляється покручем (AGENTS.md, конвенції).

	── ЧОМУ БУЛА ПРИХОВАНА І ЧОМУ ПОВЕРНУЛАСЯ ──

	З 2026-08-23 по 2026-08-27 стояло `SHOW_SHORTCUTS_TOGGLE = false` — на прохання
	автора, бо кнопка займає місце в ряду, а користуються нею рідко. Прибрано було
	З ОЧЕЙ, а не з коду, і сам цей прийом правильний: умова `{#if}` на сталій
	лишає розмітку в дереві компонента, тож `svelte-check`, ESLint і збірка й далі
	її перевіряють — `t()` бачить ключі, значки лишаються імпортованими,
	i18n-паритет не рветься. Закоментований блок нічого з цього не дає.

	НЕПРАВИЛЬНИМ БУЛО ТВЕРДЖЕННЯ, ЯКЕ СТОЯЛО ТУТ ПОРУЧ: «WCAG SC 2.1.4
	виконується так само — вимкнути одиночні літери досі можна, просто зараз не
	звідси». Не можна було НІЗВІДКИ. `settings.setShortcutsEnabled` має рівно
	одного кличущого в усьому застосунку — кнопку нижче; жодної іншої панелі
	налаштувань у проєкті немає. Тобто критерій рівня A не виконувався жодним із
	трьох шляхів, і чотири дні це трималося на реченні, яке ніхто не перевірив.

	Наступного разу так само буде видно: `tests/shortcuts.spec.ts` натискає `T` і
	`L` до й після перемикача. Сховати кнопку, не поставивши вимикач деінде, той
	гейт більше не дасть.
-->
{#if SHOW_SHORTCUTS_TOGGLE}
	<button
		type="button"
		class="header-btn"
		onclick={() => settings.setShortcutsEnabled(!settings.shortcutsEnabled)}
		aria-pressed={settings.shortcutsEnabled}
		aria-label={t(settings.shortcutsEnabled ? 'header.shortcutsOn' : 'header.shortcutsOff')}
		data-testid="header-shortcuts-toggle"
	>
		{#if settings.shortcutsEnabled}
			<Keyboard size={20} />
		{:else}
			<KeyboardOff size={20} />
		{/if}
	</button>
{/if}

<HeaderMenu
	label={t('header.toggleTheme')}
	keyshortcuts={settings.shortcutsEnabled ? 'T' : undefined}
	testId="header-theme"
	items={THEME_OPTIONS.map((theme) => ({
		id: theme.id,
		label: formatPlain(t(theme.labelKey)),
		active: settings.theme === theme.id
	}))}
	open={openMenu === 'theme'}
	onToggle={(next) => (openMenu = next ? 'theme' : null)}
	onselect={(id) => {
		settings.setTheme(id as Theme);
		openMenu = null;
	}}
>
	{#snippet trigger()}
		<CurrentThemeIcon size={20} />
	{/snippet}
	{#snippet itemVisual(item)}
		{@const ItemIcon = ICONS[item.id as Theme]}
		<ItemIcon size={18} aria-hidden="true" />
	{/snippet}
</HeaderMenu>

<HeaderMenu
	label={t('header.toggleLocale')}
	keyshortcuts={settings.shortcutsEnabled ? 'L' : undefined}
	testId="header-locale"
	items={LANGUAGE_META.map((meta) => ({
		id: meta.code,
		label: languageLabel(meta.code),
		href: langPath(meta.code, rest),
		hreflang: meta.code,
		active: meta.code === current
	}))}
	open={openMenu === 'lang'}
	onToggle={(next) => (openMenu = next ? 'lang' : null)}
	onselect={(id) => {
		openMenu = null;
		// Той самий вибір, що й раніше: пам'ятаємо мову, щоб голий шлях відкрився
		// нею наступного разу.
		settings.rememberLocale(id as Language);
	}}
>
	{#snippet trigger()}
		<img src={flagSrc(current)} alt="" class="flag" width="24" height="16" />
	{/snippet}
	{#snippet itemVisual(item)}
		<img src={flagSrc(item.id as Language)} alt="" class="flag" width="24" height="16" />
	{/snippet}
</HeaderMenu>

<!--
	АКАУНТ — ІКОНКОЮ В ШАПЦІ, між вибором мови й повним екраном.

	Доти він був пунктом головного меню, і там стояло пояснення, чому саме там: «у
	шапці живуть перемикачі, а акаунт веде на окрему сторінку». Автор це рішення
	скасував — і аргумент проти нього був слабший, ніж здавався: у шапці вже стоїть
	наскрізний рахунок, тобто вона й так не лише про вигляд сторінки. Акаунт же
	потрібен саме там, де людина грає, а не лише на першому екрані.

	Посилання, а не кнопка: це навігація, і «відкрити в новій вкладці» мусить
	працювати. Мова в адресі — через `langPath`, як усе внутрішнє.
-->
<a
	href={langPath(current, 'account')}
	class="header-btn"
	aria-label={t('account.title')}
	title={t('account.title')}
	data-testid="header-account-link"
>
	<!--
		СВІЙ АВАТАР, ЯКЩО ЙОГО ВИБРАЛИ, і звичайний значок, якщо ні.

		Прохання автора: «якщо користувач виставив собі власну аватарку, то посилання
		виглядає як ця вибрана аватарка». Порожнеча тут значуща — `playerAvatar`
		віддає `''`, поки вибору не було, і це НЕ те саме, що типова плитка: типова
		плитка в шапці читалася б як «я вже щось вибрав».

		Аватар приїжджає зі сховища, а не з бази: шапка стоїть на кожній сторінці, і
		мережевий запит тут означав би SDK Firebase у чанку кореневого layout —
		бюджет якого вже вичерпаний. Профіль наздоганяє сховище при збереженні й при
		вході (`services/playerAvatar.svelte.ts`).
	-->
	{#if !playerAvatar.custom}
		<CircleUser size={20} />
	{:else}
		<!--
			ПИТАННЯ ТУТ — «чи аватар ВЛАСНИЙ», а не «чи він є». Типовий аватар у шапці
			означав би «я вже щось вибрав», хоч людина або не вибирала, або вибрала
			саме типовий; в обох випадках правильний малюнок — значок акаунта.

			Плитку малює `features/headerAvatar` — імперативно, і причина там же:
			`Avatar` тягне чотирнадцять значків `lucide`, а чанк кореневого layout
			стоїть рівно на бюджеті (заміряно: статичний імпорт дає 123 КБ зі стелі
			120). Так значки приїжджають лише тому, хто аватарку вибрав.

			`{@attach}` читає `playerAvatar.value`, тобто перемальовує плитку сам,
			щойно вибір змінився, — і прибирає попередню своїм поверненням.
		-->
		<span
			class="header-btn__badge"
			{@attach (node) => {
				let stop: (() => void) | null = null;
				let dead = false;
				void paintAvatar(node, playerAvatar.value).then((off) => {
					if (dead) off();
					else stop = off;
				});
				return () => {
					dead = true;
					stop?.();
				};
			}}
		></span>
	{/if}
</a>

<style>
	/*
	 * Посилання в ряду іконок мусить виглядати кнопкою: клас той самий, що в
	 * решти, а підкреслення тексту тут нема чого підкреслювати.
	 */
	/* Вузол під плитку: розмір задає сама плитка, тут лише вирівнювання. */
	.header-btn__badge {
		display: inline-flex;
	}

	a.header-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: inherit;
		text-decoration: none;
	}

	/*
	 * Прапор — картинка з фіксованою коробкою. Розміри стоять і в атрибутах, і
	 * тут: без атрибутів рядок шапки смикається, поки SVG вантажиться, а без
	 * CSS кожен прапор мав би свою натуральну ширину.
	 */
	.flag {
		width: 24px;
		height: 16px;
		object-fit: cover;
		border-radius: 2px;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25);
	}
</style>
