<script lang="ts">
	import { Sun, Moon, Snowflake, Leaf, Keyboard, KeyboardOff } from 'lucide-svelte';
	import { page } from '$app/state';
	import { t, formatPlain } from '$lib/i18n';
	import { fullscreen } from '$lib/services/fullscreen.svelte';
	import { acceptsShortcut } from '$lib/services/keyboard';
	import { settings } from '$lib/services/settings.svelte';
	import { LANGUAGE_META, flagSrc, languageLabel } from '$lib/i18n/languages';
	import { langPath, languageFromParam, routeRestFromId, type Language } from '$lib/i18n/routing';
	import { THEME_OPTIONS, type Theme } from '$lib/config/themes';
	import HeaderMenu from './HeaderMenu.svelte';

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
	 * `false` на прохання автора (2026-08-23): кнопка займає місце в ряду, а
	 * користуються нею рідко. Прибрана З ОЧЕЙ, не з коду, — детально чому саме
	 * так, і що з цього тягне за собою WCAG, написано над самою кнопкою.
	 */
	const SHOW_SHORTCUTS_TOGGLE = false;

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

	── ЧОМУ ЗАРАЗ ПРИХОВАНА (на прохання автора, 2026-08-23) ──

	Кнопку прибрано З ОЧЕЙ, а не з коду: автор сказав «можливо колись повернемо».
	Повернення — знімається `SHOW_SHORTCUTS_TOGGLE`, один рядок.

	Прапорець — `const`, і саме тому. Умова `{#if}` на сталій `false` лишає
	розмітку в дереві компонента, тож `svelte-check`, ESLint і збірка й далі її
	перевіряють: `t()` бачить ключі, значки лишаються імпортованими, i18n-паритет
	не рветься. Закоментований блок нічого з цього не дає — він гниє тихо, і
	«колись повернемо» через півроку означає «перепишемо з нуля».

	САМІ СКОРОЧЕННЯ ПРАЦЮЮТЬ І ДАЛІ. Приховано лише перемикач видимості; обробник
	вище живий, а `settings.shortcutsEnabled` лишається справжнім прапорцем із
	власним значенням у сховищі. Тобто WCAG SC 2.1.4 виконується так само —
	вимкнути одиночні літери досі можна, просто зараз не звідси. Якщо перемикач не
	повернеться, вимикач мусить з'явитися десь інде: скорочення без способу їх
	вимкнути порушують критерій прямо.
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

<style>
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
