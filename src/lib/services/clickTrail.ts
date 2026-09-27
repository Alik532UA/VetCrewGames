import { logService } from './logService.svelte';

/**
 * ЩО САМЕ НАТИСНУЛИ — рядок у журнал на кожен натиск елемента керування (прохання автора
 * 2026-09-27).
 *
 * Доти звіт із табло казав, ЩО зламалося, і не казав, ПІСЛЯ ЧОГО: у звіті автора стояло
 * чотири однакові «auto search failed» — і жодного слова про те, що кожному передував
 * натиск «Автоматичний пошук». Кнопку видавав лише стек у DevTools
 * (`SearchBlock.svelte:68`, тепер `SearchWindow`), а стеку у звіті немає й бути не може: звіт копіює людина з
 * телефона.
 *
 * ## Що йде в журнал — `data-testid`, і більше нічого
 *
 * Ні тексту кнопки, ні значення поля: там бувають імена гравців і коди кімнат, а звіт
 * надсилають третій особі. Атрибут є і в продакшні (стратегія B, AGENTS.md), тож рядок у
 * звіті той самий, що в тестах, і його знаходить пошук по джерелах. Елемент без атрибута
 * пишеться тегом і найближчим предком з атрибутом — щоб «button» мав хоч якесь місце.
 *
 * Чужі `uid` у атрибутах (`account-follow-{uid}-btn`, `quiz-away-{uid}-btn`) — ховаються:
 * щоб розібрати збій, досить знати, що натиснули «стежити», а за чиїм `uid` — то вже
 * чужий слід у чужому звіті.
 *
 * ## Чому фаза перехоплення
 *
 * Обробник, що зупиняє спливання (`stopPropagation` у меню й накладках), інакше лишав би
 * натиск без запису — рівно той, після якого, можливо, щось і зламалося.
 */

/** Те, що людина натискає навмисно. `label` немає: натиск на нього — ще й натиск на поле. */
const CONTROL = [
	'button',
	'a[href]',
	'input',
	'select',
	'textarea',
	'summary',
	'[role="button"]',
	'[role="link"]',
	'[role="switch"]',
	'[role="tab"]',
	'[role="menuitem"]',
	'[role="option"]',
	'[role="checkbox"]',
	'[role="radio"]'
].join(', ');

/** `uid` Firebase — двадцять вісім літер і цифр; коди кімнат і номери карток — короткі. */
const UID = /[A-Za-z0-9]{20,}/g;
const hide = (testid: string) => testid.replace(UID, '…');

/** Запис про натиск: що натиснули; `null` — натиснули не елемент керування. */
export function clickTarget(target: EventTarget | null): Record<string, string> | null {
	if (!(target instanceof Element)) return null;
	const control = target.closest(CONTROL);
	if (!control) return null;
	const own = control.getAttribute('data-testid');
	if (own) return { target: hide(own) };
	const within = control.parentElement?.closest('[data-testid]')?.getAttribute('data-testid');
	return {
		target: control.tagName.toLowerCase(),
		...(within ? { within: hide(within) } : {})
	};
}

/** Слухати натиски до кінця сторінки. Повертає, чим перестати (кличе кореневий layout). */
export function trackClicks(): () => void {
	const onClick = (event: MouseEvent) => {
		const entry = clickTarget(event.target);
		if (entry) logService.info('ui', 'click', entry);
	};
	window.addEventListener('click', onClick, { capture: true });
	return () => window.removeEventListener('click', onClick, { capture: true });
}
