// @vitest-environment node
// Логіка чиста — DOM потрібен лише для `closest`, і його підставляє сам тест.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createKeySequence, type KeyStroke } from './keySequence';
import { isTypingTarget } from './keyboard';

/**
 * Захисти службового жесту.
 *
 * Ці перевірки — головна причина, чому логіка живе окремим модулем: у сусідніх
 * проєктах той самий жест написаний двічі, по-різному й без жодного тесту, і в
 * одному з них затиснута клавіша в полі пошуку витирає всі локальні дані.
 */

/** Мінімальний елемент із `closest` — рівно те, що читає `isTypingTarget`. */
function fakeTarget(matches: string | null): EventTarget {
	return { closest: (selector: string) => (matches === selector ? {} : null) } as unknown as EventTarget;
}

const press = (over: Partial<KeyStroke> = {}): KeyStroke => ({ code: 'KeyR', ...over });

describe('серія натискань', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('спрацьовує рівно на пороговому натисканні, не раніше', () => {
		const onComplete = vi.fn();
		const sequence = createKeySequence({ code: 'KeyR', threshold: 3, onComplete });

		sequence.handle(press());
		sequence.handle(press());
		expect(onComplete, 'два з трьох — ще нічого').not.toHaveBeenCalled();

		sequence.handle(press());
		expect(onComplete).toHaveBeenCalledTimes(1);
	});

	it('після спрацювання лічильник починається з нуля', () => {
		const onComplete = vi.fn();
		const sequence = createKeySequence({ code: 'KeyR', threshold: 2, onComplete });

		sequence.handle(press());
		sequence.handle(press());
		expect(sequence.count, 'інакше кожне наступне натискання спрацьовувало б знову').toBe(0);

		sequence.handle(press());
		expect(onComplete).toHaveBeenCalledTimes(1);
	});

	it('АВТОПОВТОР не рахується: затиснута клавіша — це одне натискання', () => {
		// ~30 подій за секунду. Без цього захисту затиснута клавіша набирає навіть
		// поріг у 50 менш ніж за дві секунди — тобто жест «серія натискань»
		// виконується тим, що на клавіатуру щось поклали.
		const onComplete = vi.fn();
		const sequence = createKeySequence({ code: 'KeyR', threshold: 3, onComplete });

		sequence.handle(press());
		for (let i = 0; i < 50; i++) sequence.handle(press({ repeat: true }));

		expect(onComplete).not.toHaveBeenCalled();
		expect(sequence.count, 'автоповтор не додає й не скидає').toBe(1);
	});

	it('НАБІР ТЕКСТУ не рахується: обробник висить на вікні', () => {
		const onComplete = vi.fn();
		const sequence = createKeySequence({ code: 'KeyR', threshold: 2, onComplete });
		const inField = press({ target: fakeTarget('input, textarea, select, [contenteditable]:not([contenteditable="false"])') });

		sequence.handle(inField);
		sequence.handle(inField);
		sequence.handle(inField);

		expect(onComplete, 'слово «ррр» у пошуку не є службовим жестом').not.toHaveBeenCalled();
	});

	it('МОДИФІКАТОРИ не рахуються: Ctrl+V — це вставлення, а не крок серії', () => {
		// Без цього вставлення поза полем вводу набирало б жест показу табла, а
		// `Ctrl+R` — жест скидання (HOTKEYS-v8 § 2.1). Це та сама вимога, яку канон
		// ставить усім обробникам, і тут вона доти не виконувалася.
		const onComplete = vi.fn();
		const sequence = createKeySequence({ code: 'KeyR', threshold: 3, onComplete });

		for (let i = 0; i < 10; i++) sequence.handle(press({ ctrlKey: true }));
		for (let i = 0; i < 10; i++) sequence.handle(press({ metaKey: true }));
		for (let i = 0; i < 10; i++) sequence.handle(press({ altKey: true }));

		expect(onComplete).not.toHaveBeenCalled();
		expect(sequence.count, 'комбінації не додають і не скидають').toBe(0);
	});

	it('комбінація не скидає вже набране', () => {
		const sequence = createKeySequence({ code: 'KeyR', threshold: 5, onComplete: vi.fn() });
		sequence.handle(press());
		sequence.handle(press({ ctrlKey: true }));
		expect(sequence.count).toBe(1);
	});

	it('натискання в полі не скидає вже набране', () => {
		// Втратити набране, зачепивши поле, — поведінка, якої ніхто не пояснить.
		const sequence = createKeySequence({ code: 'KeyR', threshold: 5, onComplete: vi.fn() });

		sequence.handle(press());
		sequence.handle(press({ target: fakeTarget('input, textarea, select, [contenteditable]:not([contenteditable="false"])') }));

		expect(sequence.count).toBe(1);
	});

	it('ІНША клавіша скидає — саме це робить жест серією, а не сумою', () => {
		const onComplete = vi.fn();
		const sequence = createKeySequence({ code: 'KeyR', threshold: 3, onComplete });

		sequence.handle(press());
		sequence.handle(press());
		sequence.handle(press({ code: 'KeyA' }));
		sequence.handle(press());
		sequence.handle(press());

		expect(onComplete).not.toHaveBeenCalled();
		expect(sequence.count).toBe(2);
	});

	it('ВІКНО між натисканнями закривається', () => {
		// Без вікна лічильник живе всю сесію: набравши літеру по одному разу за
		// годину, людина отримує жест, якого не робила.
		const onComplete = vi.fn();
		const sequence = createKeySequence({ code: 'KeyR', threshold: 3, windowMs: 2000, onComplete });

		sequence.handle(press());
		sequence.handle(press());
		vi.advanceTimersByTime(2001);
		sequence.handle(press());
		sequence.handle(press());

		expect(onComplete).not.toHaveBeenCalled();
		expect(sequence.count).toBe(2);
	});

	it('натискання в межах вікна продовжують серію', () => {
		const onComplete = vi.fn();
		const sequence = createKeySequence({ code: 'KeyR', threshold: 3, windowMs: 2000, onComplete });

		sequence.handle(press());
		vi.advanceTimersByTime(1900);
		sequence.handle(press());
		vi.advanceTimersByTime(1900);
		sequence.handle(press());

		expect(onComplete).toHaveBeenCalledTimes(1);
	});

	it('reset() знімає таймер, а не лише лічильник', () => {
		// Таймер, який лишився, спрацював би після знищення компонента.
		const onComplete = vi.fn();
		const sequence = createKeySequence({ code: 'KeyR', threshold: 3, onComplete });

		sequence.handle(press());
		sequence.reset();
		vi.runOnlyPendingTimers();

		expect(sequence.count).toBe(0);
		expect(onComplete).not.toHaveBeenCalled();
	});
});

describe('isTypingTarget', () => {
	it('порожня ціль не є полем', () => {
		expect(isTypingTarget(null)).toBe(false);
		expect(isTypingTarget(undefined)).toBe(false);
	});

	it('ціль без closest не валить перевірку', () => {
		// `event.target` буває `window` чи `document` — у них `closest` немає.
		expect(isTypingTarget({} as unknown as EventTarget)).toBe(false);
	});

	it('шукається ПРЕДОК, а не сам елемент', () => {
		// Фокус усередині `contenteditable` стоїть на вкладеному вузлі, і його
		// `tagName` — `SPAN`. Перевірка за `tagName` (як у MindStep) його пропускає.
		const nested = { closest: (s: string) => (s.includes('contenteditable') ? {} : null) };
		expect(isTypingTarget(nested as unknown as EventTarget)).toBe(true);
	});
});
