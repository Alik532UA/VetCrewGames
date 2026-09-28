import { labelFit, largestFittingScale, LABEL_SLACK_PX } from './labelScale';

/**
 * Дія: ПІДПИС НА КАРТИНЦІ (`.image-caption`) трохи меншим — лише коли його найдовше слово
 * не стає в рядок. Решта назв лишається свого кегля.
 *
 * ## Чому виняток, а не менший кегль для всіх
 *
 * Прохання автора 2026-09-28: «через це слово не роби шрифт усюди менше, а тільки виняток
 * для таких довгих слів». Слово тут одне — нідерл. «Reuzenmiereneter» (7,56 em жирним
 * Inglobal), і рвалося воно не скрізь: на Windows при 11cqi йому лишалося 4px на картинці
 * 142px, а Chromium у CI (Linux) округлює ширини гліфів до цілих пікселів — і там воно
 * переходило на «Reuzenmierene / ter». Тобто «влазить чи ні» залежить від ПРИСТРОЮ, і
 * вирішувати мусить вимір на ньому, а не число, підібране на одному комп'ютері.
 *
 * ## Що міряється: найдовше СЛОВО, а не рядок
 *
 * Назва з кількох слів переноситься між ними — так і задумано, і зменшувати її нема чого.
 * Ширина найдовшого слова — це `min-content` підпису, але лише без `overflow-wrap: anywhere`
 * (з ним мінімумом стає одна літера) і без `max-width` (він обрізав би вимір саме там, де
 * слово не влазить). Обидва знімаються на час виміру й повертаються в тому самому такті —
 * браузер між ними не малює.
 *
 * Арифметика — `labelFit`, та сама, що в `fitLabel` підписів карток «Кого більше?»: кроком
 * 5%, не менше за 70%, а що не врятувало й дно — переноситься (`overflow-wrap` у CSS).
 *
 * ## Пропорція — лише перша спроба
 *
 * `labelFit` каже, яким має бути кегль, якщо рядок вужчає пропорційно. На Linux це не так:
 * гліфи округлені до цілих пікселів, і менший кегль буває ширшим за пропорцію — тобто
 * слово, «зменшене як треба», рвалося б і далі, і саме там, де підпис рвався від початку.
 * Тому вибраний кегль перевіряється виміром (`largestFittingScale`): крок униз, поки слово
 * не стане в рядок, або вгору, поки стає. Слово меншає рівно настільки, скільки треба.
 */

/** Скільки чекати, поки розкладка вгамується: те саме число, що в `fitLabel`. */
const SETTLE_MS = 140;

/**
 * @param node Підпис із класом `.image-caption`: у CSS його кегль множиться на
 *   `--caption-scale` (типово 1).
 * @param _text Текст підпису — лише щоб Svelte кликав `update`, коли назва змінилася в тому
 *   самому вузлі (новий раунд «Де живем?»).
 */
export function fitCaption(node: HTMLElement, _text?: string) {
	if (typeof ResizeObserver === 'undefined') return;

	let pending: ReturnType<typeof setTimeout> | null = null;
	let alive = true;

	function measure() {
		pending = null;
		node.style.removeProperty('--caption-scale');

		// Поля й стеля — у `cqi`, тобто від кегля не залежать: місце те саме за будь-якого масштабу.
		const style = getComputedStyle(node);
		const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
		const room = parseFloat(style.maxWidth) - padding;
		const zoom = zoomOf(node);

		// З `important`: вимір не мусить залежати від того, що ще стоїть у каскаді.
		node.style.setProperty('max-width', 'none', 'important');
		node.style.setProperty('overflow-wrap', 'normal', 'important');
		node.style.setProperty('width', 'min-content', 'important');
		const longest = () => node.getBoundingClientRect().width / zoom - padding;
		const needed = longest();

		let scale = 1;
		// `maxWidth` не число (`none`) або вузол ще без розміру — не чіпаємо.
		if (room > 0 && needed > 0) {
			const first = labelFit(needed, room).scale;
			if (first < 1) {
				scale = largestFittingScale(first, (candidate) => {
					node.style.setProperty('--caption-scale', String(candidate));
					return longest() <= room - LABEL_SLACK_PX;
				});
			}
		}

		node.style.removeProperty('width');
		node.style.removeProperty('overflow-wrap');
		node.style.removeProperty('max-width');
		if (scale !== 1) node.style.setProperty('--caption-scale', String(scale));
		else node.style.removeProperty('--caption-scale');
	}

	/**
	 * Вимір відкладений, доки розкладка не вгамується, — з тієї самої причини, що в
	 * `fitLabel`: перший вимір до шрифта чи до масштабу сторінки дав би кегль для стану,
	 * якого вже не буде. Таймер, а не кадр: у прихованій панелі кадри не йдуть.
	 */
	function schedule() {
		if (!alive) return;
		if (pending) clearTimeout(pending);
		pending = setTimeout(measure, SETTLE_MS);
	}

	/*
	 * Спостерігаємо за КАРТИНКОЮ (батьком) і за самим підписом: перша міняє кегль (він у
	 * `cqi` від неї), другий — `max-width` чи назву. Власний запис кегля знову міняє розмір
	 * підпису, але наступний вимір дає те саме число — і на ньому все стає.
	 */
	const sizes = new ResizeObserver(schedule);
	if (node.parentElement) sizes.observe(node.parentElement);
	sizes.observe(node);

	const ready = document.fonts?.ready ?? Promise.resolve();
	void ready.then(() => {
		if (alive) schedule();
	});

	return {
		update() {
			schedule();
		},
		destroy() {
			alive = false;
			if (pending) clearTimeout(pending);
			sizes.disconnect();
			node.style.removeProperty('--caption-scale');
		}
	};
}

/**
 * Скільки пікселів екрана в одному CSS-пікселі вузла. Сторінки ігор зменшує `zoom`
 * (`fitToViewport`), а `getBoundingClientRect` віддає вже зменшені розміри, тоді як
 * `getComputedStyle` — незменшені. Без поправки на зменшеній сторінці слово здавалося б
 * коротшим, ніж є, і виняток не спрацював би саме там, де екран тісний.
 *
 * `currentCSSZoom` — точне число; де його ще немає, — відношення двох ширин (`offsetWidth`
 * ціле, тож тут похибка до пів пікселя, і її покриває запас `labelFit`).
 */
function zoomOf(node: HTMLElement): number {
	const zoom = (node as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom;
	if (zoom && zoom > 0) return zoom;
	const layout = node.offsetWidth;
	const visual = node.getBoundingClientRect().width;
	return layout > 0 && visual > 0 ? visual / layout : 1;
}
