/**
 * WEB ANIMATIONS У JSDOM.
 *
 * Переходи Svelte 5 крутяться через `element.animate`, якого в jsdom немає. Поки переходи
 * стояли лише в блоках, які в тестах не перемикаються, це не спливало; перехід, що в тесті
 * справді грає (корені дошки й табла спільної вікторини міняє `{#key}` чи `{#if}` батька),
 * валив тест із «element.animate is not a function».
 *
 * Підставка — анімація «одразу скінчилася»: вузли стають туди, де будуть після переходу,
 * тож тест бачить кінцевий стан, а не проміжний. Ставиться лише там, де `animate` немає, —
 * справжній браузер (e2e) її не бачить. `beforeAll`, а не код на верхньому рівні: так файл
 * належить раннеру (`src/test-runners.test.ts`), і до першого рендера підставка вже стоїть.
 */
import { beforeAll } from 'vitest';

beforeAll(() => {
	if (typeof Element === 'undefined' || typeof Element.prototype.animate === 'function') return;
	Element.prototype.animate = function () {
		const animation = {
			onfinish: null as null | (() => void),
			oncancel: null,
			cancel() {},
			finish() {},
			play() {},
			pause() {},
			currentTime: 0,
			playState: 'finished',
			finished: Promise.resolve()
		};
		queueMicrotask(() => animation.onfinish?.());
		return animation as unknown as Animation;
	};
});
