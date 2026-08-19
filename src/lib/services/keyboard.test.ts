// @vitest-environment node
// Логіка чиста: подія — звичайний обʼєкт, `closest` підставляє сам тест.
import { describe, expect, it } from 'vitest';
import { acceptsShortcut, isPlainKey, isTypingTarget } from './keyboard';

/**
 * Захисти обробника гарячих клавіш — і вимикач, якого вимагає WCAG SC 2.1.4.
 *
 * **Чому це окремий файл, хоч `isTypingTarget` уже перевіряє
 * `keySequence.test.ts`.** Там він перевіряється як деталь СЛУЖБОВОГО ЖЕСТУ.
 * Тут — сам `acceptsShortcut`, тобто те, крізь що проходять звичайні
 * скорочення `T`, `L` і `F`; доти на нього не дивився жоден тест, і гілка
 * `Escape` була непокритою (`keyboard.ts` — 50% рядків до цього файлу).
 *
 * Головна перевірка — «вимикач справді вимикає». HOTKEYS-v8 § 3 каже прямо, що
 * «є перемикач» і «перемикач вимикає скорочення» — різні твердження. Друге
 * тепер твердить не документація, а прогін.
 */

/** Мінімальний елемент із `closest` — рівно те, що читає `isTypingTarget`. */
function target(matches: string | null) {
	return {
		closest: (selector: string) => (matches !== null && selector.includes(matches) ? {} : null)
	} as unknown as EventTarget;
}

function keyEvent(code: string, extra: Partial<KeyboardEvent> = {}): KeyboardEvent {
	return {
		code,
		ctrlKey: false,
		metaKey: false,
		altKey: false,
		target: null,
		...extra
	} as KeyboardEvent;
}

describe('acceptsShortcut', () => {
	it('перевірка жива: звичайна літера поза полем проходить', () => {
		expect(acceptsShortcut(keyEvent('KeyT'), true)).toBe(true);
	});

	describe('WCAG SC 2.1.4: вимикач', () => {
		it('вимкнені скорочення НЕ проходять — жодна літера', () => {
			for (const code of ['KeyT', 'KeyL', 'KeyF', 'KeyV', 'KeyR']) {
				expect(acceptsShortcut(keyEvent(code), false), code).toBe(false);
			}
		});

		it('увімкнені — проходять; тобто вимикач вимикає саме те, що вмикає', () => {
			for (const code of ['KeyT', 'KeyL', 'KeyF', 'KeyV', 'KeyR']) {
				expect(acceptsShortcut(keyEvent(code), true), code).toBe(true);
			}
		});

		it('`Escape` лишається живим і при вимкнених скороченнях', () => {
			/*
			 * SC 2.1.4 говорить про літери, цифри й символи — про те, що зʼявляється
			 * при диктуванні. `Escape` під нього не потрапляє, а от меню, відкрите з
			 * клавіатури, без нього стає пасткою: вийти звідти більше нічим. Вимикач,
			 * який глушить `Escape`, полагодив би одну вимогу доступності, зламавши
			 * іншу.
			 */
			expect(acceptsShortcut(keyEvent('Escape'), false)).toBe(true);
		});
	});

	describe('модифікатори (HOTKEYS-v8 § 2.1)', () => {
		it('`Ctrl`, `Meta` й `Alt` знімають скорочення — це чужі команди браузера', () => {
			expect(acceptsShortcut(keyEvent('KeyT', { ctrlKey: true }), true)).toBe(false);
			expect(acceptsShortcut(keyEvent('KeyT', { metaKey: true }), true)).toBe(false);
			expect(acceptsShortcut(keyEvent('KeyT', { altKey: true }), true)).toBe(false);
		});

		it('`Shift` не знімає: він не міняє `code`, і комбінацій із ним браузер не займає', () => {
			expect(isPlainKey({ ctrlKey: false, metaKey: false, altKey: false })).toBe(true);
		});

		it('модифікатор сильніший за `Escape`: `Ctrl+Escape` — не наше', () => {
			expect(acceptsShortcut(keyEvent('Escape', { ctrlKey: true }), true)).toBe(false);
		});
	});

	describe('поля вводу (HK-TEXT-ENTRY-GUARD, CRITICAL)', () => {
		it('літера в полі не виконує команду', () => {
			expect(acceptsShortcut(keyEvent('KeyT', { target: target('input') }), true)).toBe(false);
		});

		it('`Escape` у полі — виняток: панель, що забрала фокус, мусить закриватися', () => {
			expect(acceptsShortcut(keyEvent('Escape', { target: target('input') }), true)).toBe(true);
		});

		it('`contenteditable` ловиться через `closest`, а не через `tagName`', () => {
			// Фокус у `contenteditable` стоїть на вкладеному вузлі, і його tagName — SPAN.
			expect(isTypingTarget(target('contenteditable'))).toBe(true);
		});
	});
});
