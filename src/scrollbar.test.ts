import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Інваріанти власної смуги прокрутки (SCROLLBAR-v8 § 11).
 *
 * Сама смуга перевіряється лише в браузері — це геометрія й події вказівника.
 * Тут те, що видно в джерелах, і кожен пункт закриває конкретний дефект із § 9
 * канону, а не стилістику.
 */

const read = (file: string) => readFileSync(file, 'utf8');

const APP_HTML = 'src/app.html';
const CONTROLLER = 'src/lib/controllers/scrollbar.svelte.ts';
const SETTINGS = 'src/lib/services/settings.svelte.ts';
const BAR = 'src/lib/components/PageScrollbar.svelte';
const LAYOUT = 'src/routes/+layout.svelte';

describe('смуга прокрутки', () => {
	/**
	 * § 8.2. Скрипт першого кадру не може імпортувати контролер, тож умови
	 * існують у двох місцях. Розійдуться вони МОВЧКИ: на першому кадрі буде
	 * одне, після гідрації інше — і користувач побачить стрибок вигляду смуги.
	 */
	it('умови першого кадру збігаються з контролером (§ 8.2)', () => {
		const html = read(APP_HTML);
		const controller = read(CONTROLLER);
		const settings = read(SETTINGS);

		const media = '(hover: hover) and (pointer: fine)';
		expect(html.includes(media), `${APP_HTML}: немає медіазапиту ${media}`).toBe(true);
		expect(controller.includes(media), `${CONTROLLER}: немає медіазапиту ${media}`).toBe(true);

		// Ключ сховища й значення за замовчуванням — теж пара, що мусить збігатися.
		expect(html).toContain("'vetcrewgames_scrollbarMode'");
		expect(html).toMatch(/\|\|\s*'custom'/);
		expect(settings).toMatch(/scrollbarMode = \$state<ScrollbarMode>\('custom'\)/);
	});

	/**
	 * § 2.3. Якби клас ставили й знімали самі малювальники, перемикання режиму
	 * давало б гонку, і на екрані було б дві смуги — власна й системна.
	 */
	it('клас на <html> має рівно одного власника (§ 2.3)', () => {
		const owners = [LAYOUT, APP_HTML, BAR, CONTROLLER].flatMap((file) =>
			[...read(file).matchAll(/classList\.(?:add|remove|toggle)\(\s*'has-custom-scrollbar'/g)].map(
				() => file
			)
		);
		expect(
			owners,
			`клас ставлять у ${owners.length} місцях; має бути двоє — ефект у корені й скрипт першого кадру`
		).toEqual([LAYOUT, APP_HTML]);
	});

	/**
	 * § 9.2. `behavior: 'auto'` означає «взяти значення з CSS `scroll-behavior`».
	 * Якщо там `smooth`, кожен рух миші запускає власну анімацію, і вони
	 * наздоганяють одна одну. У коді при цьому все виглядає правильним.
	 */
	it("прокрутка жесту миттєва, а не 'auto' (§ 9.2)", () => {
		const source = read(BAR);
		expect(source).toContain("behavior: 'instant'");
		expect(source, "знайдено behavior: 'auto'").not.toContain("behavior: 'auto'");
	});

	/**
	 * § 9.12. Натиск на доріжці починає нативне виділення, а біля правого краю
	 * вікна виділення вмикає автоскрол браузера — і два скроли тягнуть сторінку
	 * кожен у свій бік. Симптом «іноді застигає», причина в CSS.
	 */
	it('жест не ділиться з браузером (§ 9.12)', () => {
		const source = read(BAR);
		const styles = source.match(/<style>([\s\S]*)<\/style>/)?.[1] ?? '';
		const track = styles.match(/\.page-scrollbar \{([^}]*)\}/)?.[1] ?? '';
		const thumb = styles.match(/\.page-scrollbar__thumb \{([^}]*)\}/)?.[1] ?? '';

		expect(track, 'доріжці бракує user-select: none').toContain('user-select: none');
		expect(thumb, 'повзунку бракує pointer-events: none').toContain('pointer-events: none');
		expect(
			source.match(/function onTrackPointerDown[\s\S]*?\n\t\}/)?.[0] ?? '',
			'у pointerdown немає preventDefault()'
		).toContain('e.preventDefault()');
	});

	/**
	 * § 9.13. `setPointerCapture` може кинути виняток і знімається разом із
	 * рендером елемента. Доріжка завширшки 10px губить курсор від найменшого
	 * зсуву вбік, тож жест насправді мусить нести слухач на `window`.
	 */
	it('рухи під час жесту слухаються на window (§ 9.13)', () => {
		const window_ = read(BAR).match(/<svelte:window([\s\S]*?)\/>/)?.[1] ?? '';
		expect(window_, 'у <svelte:window> немає гілки для перетягування').toMatch(
			/if \(dragging\)[\s\S]*?requestScroll/
		);
	});
});
