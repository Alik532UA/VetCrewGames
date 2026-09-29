import { browser } from '$app/environment';
import { logService } from '$lib/services/logService.svelte';

/**
 * Повноекранний режим — лише там, де браузер його справді ВМІЄ.
 *
 * Винесено з шапки не заради розміру: це умовляння браузерного API з префіксами
 * `webkit`, і до самої шапки вони стосунку не мають. Шапці треба лише «чи можна»,
 * «зараз повний екран чи ні» і «перемкни».
 *
 * ## Чому без підробки (прохання автора 2026-09-26)
 *
 * iPhone не дає сторінкам повноекранного режиму взагалі — лише відео. Доти там
 * вмикалася ПІДРОБКА: атрибут на `<html>` і `position: fixed` у стилях. Панелей
 * Safari вона не ховала, тож людина бачила кнопку, що міняє лише власний значок, —
 * і читала це як зламаний сайт. Той самий «запасний» шлях вмикався й будь-де, де
 * справжній запит відхилено, і там теж нічого не ховав.
 *
 * Визначення — за МОЖЛИВІСТЮ, а не за моделлю: iPad звітує як Mac і повний екран уміє,
 * а вкладений фрейм без `allow="fullscreen"` не вміє на будь-якому пристрої.
 *
 * ## Кнопка тепер є й там, де повного екрана не дають (прохання автора 2026-09-29)
 *
 * Доти на iPhone кнопки не було зовсім, а шлях «Поділитися → На початковий екран»
 * називав один тост, що зникав за 12 секунд. Тепер натиск там відкриває вікно з
 * поясненням і кроками встановлення, а де браузер уміє — вибір «у цьому браузері» чи
 * «встановити застосунок» (`buttonAction` нижче, вікно — `features/fullscreenOffer.ts`).
 * Ховається кнопка лише у встановленому застосунку, який повного екрана не вміє: клас
 * `no-fullscreen` ставить скрипт першого кадру в `app.html`, тож вона не блимає.
 */

interface FullscreenDocument extends Document {
	webkitFullscreenEnabled?: boolean;
	webkitFullscreenElement?: Element | null;
	/** Старий WebKit повертає `undefined`, а не проміс. */
	webkitExitFullscreen?: () => Promise<void> | undefined;
}

interface FullscreenHTMLElement extends HTMLElement {
	/** Старий WebKit (Safari й iPadOS до 16.4) повертає `undefined`, а не проміс. */
	webkitRequestFullscreen?: () => Promise<void> | undefined;
}

/**
 * Чи вміє браузер повний екран для сторінки.
 *
 * SYNC: та сама умова стоїть у скрипті першого кадру (`src/app.html`), який
 * ховає кнопку до гідрації. Звіряє їх `src/fullscreen-first-frame.test.ts`.
 */
export function canFullscreen(): boolean {
	if (!browser) return false;
	const doc = document as FullscreenDocument;
	return Boolean(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
}

/** Сторінку відкрито з початкового екрана — вона вже без панелей браузера. */
export function isStandalone(): boolean {
	if (!browser) return false;
	const nav = navigator as Navigator & { standalone?: boolean };
	return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

/** Що робить натиск кнопки шапки. `hidden` — кнопки немає зовсім. */
export type FullscreenAction = 'exit' | 'enter' | 'offer' | 'blocked' | 'hidden';

/**
 * НАТИСК КНОПКИ «НА ВЕСЬ ЕКРАН» (прохання автора 2026-09-29, відповіді 1 і 4 — «A»).
 *
 * | стан                               | натиск                                        |
 * | ---------------------------------- | --------------------------------------------- |
 * | зараз повний екран                 | вийти одразу                                  |
 * | уміє, застосунок не встановлено    | вікно «у цьому браузері / встановити»         |
 * | уміє, відкрито як застосунок       | одразу на весь екран                          |
 * | не вміє, не встановлено (iPhone)   | вікно з поясненням і кроками встановлення     |
 * | не вміє, встановлено               | кнопки немає: запропонувати більше нічого     |
 *
 * «Встановлено» — `isStandalone()`: застосунок відкрито з початкового екрана чи вікна
 * застосунку. Остання умова — та сама, що в скрипті першого кадру (`app.html`), який
 * ховає кнопку до гідрації; звіряє їх `src/fullscreen-first-frame.test.ts`.
 */
export function buttonAction(state: {
	active: boolean;
	can: boolean;
	installed: boolean;
}): FullscreenAction {
	if (state.active) return 'exit';
	if (state.can) return state.installed ? 'enter' : 'offer';
	return state.installed ? 'hidden' : 'blocked';
}

/** Відмова браузера — не падіння: кнопка лишається, а в журналі видно чому. */
function settle(result: Promise<void> | undefined, action: string): void {
	result?.catch((error: unknown) =>
		logService.warn('ui', 'fullscreen refused', { action, reason: String(error) })
	);
}

class FullscreenState {
	/** Чи зараз повний екран. */
	active = $state(false);

	toggle(): void {
		if (!canFullscreen()) return;

		const doc = document as FullscreenDocument;
		const root = document.documentElement as FullscreenHTMLElement;

		if (doc.fullscreenElement || doc.webkitFullscreenElement) {
			const exit = doc.exitFullscreen ?? doc.webkitExitFullscreen;
			settle(exit?.call(doc), 'exit');
			return;
		}

		const request = root.requestFullscreen ?? root.webkitRequestFullscreen;
		settle(request?.call(root), 'enter');
	}

	/**
	 * Стежити за станом — зокрема за виходом ЗЗОВНІ, клавішею Esc або системною
	 * кнопкою. Повертає прибирання: життєвий цикл веде компонент, бо тут `$effect`
	 * недоступний (module-level singleton, SVELTE-CORE-v8 § 2.6).
	 */
	watch(): () => void {
		if (!browser) return () => {};

		const sync = () => {
			const doc = document as FullscreenDocument;
			this.active = !!(doc.fullscreenElement || doc.webkitFullscreenElement);
		};

		document.addEventListener('fullscreenchange', sync);
		document.addEventListener('webkitfullscreenchange', sync);
		return () => {
			document.removeEventListener('fullscreenchange', sync);
			document.removeEventListener('webkitfullscreenchange', sync);
		};
	}
}

export const fullscreen = new FullscreenState();
