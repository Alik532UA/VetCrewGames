<script lang="ts">
	import { Sun, Moon, Snowflake, Leaf } from 'lucide-svelte';
	import { page } from '$app/state';
	import { t, formatPlain } from '$lib/i18n';
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
</script>

<HeaderMenu
	label={formatPlain(t('header.toggleTheme'))}
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
	label={formatPlain(t('header.toggleLocale'))}
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
