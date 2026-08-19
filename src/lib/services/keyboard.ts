/**
 * Захисти обробника гарячих клавіш (HOTKEYS-v8 § 2).
 *
 * **Чому окремо від `keySequence.ts`.** Серія натискань — це один із двох
 * споживачів цих перевірок, а не їхній власник: звичайні скорочення (`T`, `L`)
 * потребують рівно того самого. Тримати `isTypingTarget` усередині
 * `keySequence` означало б, що другий споживач напише свою копію — і саме так
 * розходяться реалізації в сусідніх проєктах.
 *
 * **КАРТА КЛАВІШ ЦЬОГО ПРОЄКТУ** — щоб наступний агент не аналізував заново:
 *
 * | Клавіша | Стан | Чому |
 * |---|---|---|
 * | `T` | ✅ тема | чотири теми, `settings.setTheme` |
 * | `L` | ✅ меню мов | чотири мови; перемикання — це НАВІГАЦІЯ (`langPath`), тож клавіша відкриває меню, а не «наступну мову» |
 * | `V` | ✅ службове табло | `components/ServiceBadge.svelte` |
 * | `R` | ✅ аварійне скидання | `services/resetService.ts` |
 * | `F` | ✅ на весь екран | `services/fullscreen.svelte.ts`, кнопка в шапці |
 * | `Esc` | ✅ закрити меню | |
 * | `M` | ⏭️ ПРОПУЩЕНО | звуку в проєкті немає — жодного `<audio>`, жодного сервісу звуку |
 * | `B` | ⏭️ ПРОПУЩЕНО | динамічних фонів немає; тло задає тема |
 * | `C` | ⏭️ ПРОПУЩЕНО | годинника на екрані немає |
 * | `H` | ⏭️ ПРОПУЩЕНО | секцій-вкладок немає; «на початок» це посилання в шапці |
 * | `PgUp`/`PgDn`, `1`–`9` | ⏭️ ПРОПУЩЕНО | сторінка не крокує секціями |
 *
 * Пропущене — це відсутня функція, а не забута клавіша. Щойно функція
 * зʼявиться, клавіша береться з канонічної карти (HOTKEYS-v8 § 1.1), а не
 * вигадується.
 */

/**
 * Чи друкує людина зараз у полі.
 *
 * `closest`, а не порівняння `tagName`: у `contenteditable` фокус стоїть на
 * вкладеному вузлі, і його `tagName` — це `SPAN`, тож перевірка за тегом такий
 * випадок пропускає.
 */
export function isTypingTarget(target: EventTarget | null | undefined): boolean {
	const element = target as HTMLElement | null | undefined;
	if (!element || typeof element.closest !== 'function') return false;
	return (
		element.closest(
			'input, textarea, select, [contenteditable]:not([contenteditable="false"])'
		) !== null
	);
}

/**
 * Чи це одиночна клавіша без модифікаторів.
 *
 * `Ctrl+T` відкриває вкладку, `Ctrl+R` перезавантажує, `Ctrl+V` вставляє — і всі
 * три дають той самий `event.code`, що й одиночна клавіша. `Shift` навмисно не
 * перевіряється: він не змінює `code`, а комбінації з ним браузер зазвичай не
 * займає.
 */
export function isPlainKey(event: {
	ctrlKey?: boolean;
	metaKey?: boolean;
	altKey?: boolean;
}): boolean {
	return !event.ctrlKey && !event.metaKey && !event.altKey;
}

/**
 * Обидва захисти разом — те, що потрібно обробникові на вікні.
 *
 * `Escape` — єдиний виняток із захисту полів: панель, яку відкрили клавішею,
 * може забрати фокус у своє поле, і тоді літера, якою її відкрили, законно
 * зʼїдається полем. Закрити панель зсередини більше нічим (HOTKEYS-v8 § 2.2).
 */
export function acceptsShortcut(event: KeyboardEvent): boolean {
	if (!isPlainKey(event)) return false;
	if (event.code === 'Escape') return true;
	return !isTypingTarget(event.target);
}
