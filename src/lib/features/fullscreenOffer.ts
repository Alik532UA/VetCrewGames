import type { Sun } from 'lucide-svelte';
import { settings } from '$lib/services/settings.svelte';

/**
 * ПІДКЛЮЧЕННЯ ВІКНА «НА ВЕСЬ ЕКРАН» — імперативне, і причина та сама, що в
 * `features/awaitedBanner.ts`.
 *
 * Кнопка стоїть у шапці кореневого layout, а його бюджет вичерпано (код — 21,7 КБ gzip із
 * 22). `{#if Cmp}<Cmp />{/if}` із динамічним імпортом не помагає: він тягне в layout
 * помічник Svelte для змінних компонентів. Тому шапка лише імпортує цей модуль на натиск,
 * а він монтує вікно в `<body>` — туди, де немає предків із `zoom`, тож межі вікна — межі
 * екрана.
 *
 * ## Чому вікно не імпортує нічого з шапки (заміряно 2026-09-29)
 *
 * Модуль, спільний для кореневого layout і лінивого чанка, збирач виносить окремим файлом, а
 * окремий файл стискається гірше, ніж той самий код усередині layout. Так виїхали сервіс
 * повного екрана (+0,6 КБ gzip) і значок `Expand` (+0,34 КБ) — і бюджет перевищило. Тому
 * шапка ПЕРЕДАЄ їх сюди (`onfullscreen`, `fullscreenIcon`), а не вікно імпортує.
 *
 * З тієї самої причини вікно, словник і `mount` вантажаться звідси другим рівнем: статичні
 * імпорти тут збирач вписав би в перелік попереднього вантаження в чанку шапки.
 *
 * Словник вантажиться ДО монтування: вікно не показує ключів навіть на мить.
 */

export interface OfferOptions {
	/** `choice` — два пункти; `blocked` — повного екрана не дають, одразу кроки. */
	mode: 'choice' | 'blocked';
	/** Кнопка шапки: на неї вертається фокус. */
	trigger: HTMLElement;
	/** Вікно відкрилося чи закрилося — для `aria-expanded` кнопки. */
	onchange: (open: boolean) => void;
	/** Увімкнути повний екран — сервіс шапки. */
	onfullscreen: () => void;
	/** Значок кнопки шапки — той самий у пункті «на весь екран у цьому браузері». */
	fullscreenIcon: typeof Sun;
}

let open = false;

/** Показати вікно. */
export async function openFullscreenOffer(options: OfferOptions): Promise<void> {
	if (open) return;
	open = true;
	options.onchange(true);
	try {
		const [{ mount, unmount }, { default: FullscreenOffer }, { loadInstallText }] =
			await Promise.all([
				import('svelte'),
				import('$lib/components/FullscreenOffer.svelte'),
				import('$lib/i18n/install')
			]);
		const dict = await loadInstallText(settings.locale);
		const instance = mount(FullscreenOffer, {
			target: document.body,
			props: {
				mode: options.mode,
				dict,
				onfullscreen: options.onfullscreen,
				fullscreenIcon: options.fullscreenIcon,
				onclose: () => {
					open = false;
					options.onchange(false);
					// Не посеред власного обробника вікна: знімаємо наступною мікрозадачею.
					queueMicrotask(() => void unmount(instance));
					options.trigger.focus();
				}
			}
		});
	} catch (error) {
		open = false;
		options.onchange(false);
		throw error;
	}
}
