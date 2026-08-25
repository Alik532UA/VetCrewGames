import { logService } from '$lib/services/logService.svelte';

/**
 * ПІДКЛЮЧЕННЯ СМУГИ «ВАС ЧЕКАЮТЬ У ГРІ» — і чому воно імперативне.
 *
 * ## Бюджет
 *
 * Кореневий layout стоїть РІВНО на бюджеті (121 КБ gzip зі стелі 121): його
 * вантажить кожен відвідувач, і кожен кілобайт там — плата з усіх. Компонент із
 * контролером цей бюджет перевищили; заміряно `npm run check:build`: 121,138 КБ,
 * тобто на 1,1 КБ понад.
 *
 * Динамічний імпорт самого компонента не помагає: `{#if Cmp}<Cmp />{/if}` тягне в
 * layout помічник Svelte для змінних компонентів — і саме він і є та зайва вага.
 *
 * Тому монтуємо самі. У layout лишається ОДИН динамічний імпорт цього файлу, тобто
 * кілька байтів; усе інше приїжджає лише тоді, коли кімната справді знайдена — а
 * це рідкісний випадок навіть для тих, хто грає онлайн.
 *
 * ## Чому це не «поза застосунком»
 *
 * Смуга й так `position: fixed` — у розкладці сторінки вона не бере участі. А `page`
 * і `settings`, які вона читає, — модульні синглтони, не контекст: поза деревом
 * вони працюють так само.
 *
 * ## Чому НЕ перенести смугу в layout мови
 *
 * Бо це було б обманом перевірки, а не економією: `[[lang=lang]]/+layout` вантажать
 * усі ті самі відвідувачі, і справжня ціна не змінилася б — змінилося б лише
 * число, яке міряє гейт.
 */

let mounted = false;

/**
 * Перечитати свої кімнати й, якщо на мене чекають, показати смугу.
 *
 * Кличеться двічі: на вході в застосунок і після переходу ЗІ сторінки онлайну.
 * НЕ КИДАЄ: це довідка, і її несправність не має права ламати сторінку.
 */
export async function showAwaitedRoom(): Promise<void> {
	try {
		const { awaitedRoom } = await import('$lib/controllers/awaitedRoom.svelte');
		await awaitedRoom.refresh();
		if (!awaitedRoom.room || mounted) return;

		const [{ mount }, panel] = await Promise.all([
			import('svelte'),
			import('$lib/components/AwaitedRoom.svelte')
		]);
		mount(panel.default, { target: document.body });
		mounted = true;
	} catch (error) {
		logService.warn('network', 'awaited room banner not shown', { reason: String(error) });
	}
}
