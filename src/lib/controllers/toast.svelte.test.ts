import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from './toast.svelte';

/**
 * Пауза автозникнення (NOTIFICATIONS-v8 § 3).
 *
 * Канон називає головним саме тест на ЗАЛИШОК часу: відновлення «з нуля»
 * найчастіше проходить рев'ю непоміченим, бо зовні пауза працює — тост стоїть,
 * поки на ньому курсор. Помітно стає лише тоді, коли він живе після відведення
 * рівно стільки ж, скільки жив би з самого початку.
 *
 * Перевіряється саме контролер, а не показ: у прихованій панелі CSS-стану
 * `:hover` не викликати синтетикою, а `:focus-within` не буває без фокуса
 * вікна. Тобто DOM-перевірка тут показала б «все зелено» просто тому, що
 * жодна з подій не настала.
 */
describe('тост', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		for (const message of [...toast.messages]) toast.remove(message.id);
	});

	afterEach(() => vi.useRealTimers());

	it('перевірка жива: спочатку тостів немає', () => {
		expect(toast.messages).toHaveLength(0);
	});

	it('зникає сам, коли час вийшов', () => {
		toast.info('common.close', 1000);
		expect(toast.messages).toHaveLength(1);

		vi.advanceTimersByTime(1000);
		expect(toast.messages).toHaveLength(0);
	});

	it('на паузі не зникає, скільки б часу не минуло', () => {
		toast.info('common.close', 1000);
		const { id } = toast.messages[0];

		vi.advanceTimersByTime(400);
		toast.pause(id);
		vi.advanceTimersByTime(10_000);

		expect(toast.messages, 'зник, поки на нього дивилися').toHaveLength(1);
	});

	/** Головний тест набору: відновлення йде із ЗАЛИШКУ, а не з повної тривалості. */
	it('після паузи лишається залишок часу, а не повна тривалість', () => {
		toast.info('common.close', 1000);
		const { id } = toast.messages[0];

		vi.advanceTimersByTime(700); // 300 лишилося
		toast.pause(id);
		vi.advanceTimersByTime(5000); // на паузі час не йде
		toast.resume(id);

		vi.advanceTimersByTime(299);
		expect(toast.messages, 'зник раніше за залишок').toHaveLength(1);

		vi.advanceTimersByTime(2);
		expect(toast.messages, 'відновлення пішло з повної тривалості').toHaveLength(0);
	});

	/**
	 * Миша й фокус приходять незалежно: відведення миші при живому фокусі не
	 * має відновлювати таймер. Тому причини рахуються, а не перезаписуються.
	 */
	it('дві причини паузи знімаються двома відновленнями', () => {
		toast.info('common.close', 1000);
		const { id } = toast.messages[0];

		toast.pause(id); // навели мишу
		toast.pause(id); // і зайшов фокус
		toast.resume(id); // мишу відвели, фокус лишився

		vi.advanceTimersByTime(5000);
		expect(toast.messages, 'таймер пішов, хоч фокус ще на тості').toHaveLength(1);

		toast.resume(id);
		vi.advanceTimersByTime(1000);
		expect(toast.messages).toHaveLength(0);
	});

	/**
	 * Зміна розміру вікна приходить пачками — без цієї перевірки кожна додавала
	 * б власну копію того самого повідомлення.
	 */
	it('однакове повідомлення видно як уже наявне', () => {
		expect(toast.has('common.close')).toBe(false);
		toast.info('common.close', 1000);
		expect(toast.has('common.close')).toBe(true);
	});

	it('дію викликає той, хто натиснув, а не таймер', () => {
		const onAction = vi.fn();
		toast.info('common.close', 1000, { labelKey: 'common.next', onAction });

		vi.advanceTimersByTime(1000);
		expect(onAction, 'дія не має спрацьовувати сама').not.toHaveBeenCalled();
	});
});

/**
 * ТОСТ ПРО ПРИЧИНУ ЗБОЮ (прохання автора 2026-09-27): той самий тост, що й решта, — лише
 * текст, дії й час від причини. Доти збій пошуку був сім секунд «спробуйте ще раз».
 *
 * Зворотні експерименти (прогнано): не замінювати попередній тост про збій — червоніє
 * «новий збій замінює старий»; відновлювати таймер закріпленого — «закріплений не
 * зникає»; пропонувати звіт на обрив — «що пропонує кожна причина».
 */
describe('тост про збій', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		for (const message of [...toast.messages]) toast.remove(message.id);
	});

	afterEach(() => vi.useRealTimers());

	it('що пропонує кожна причина: оновлення — старій сторінці, звіт — тому, чого не виправиш сам', () => {
		const offer = (problem: Parameters<typeof toast.problem>[0]) => {
			toast.problem(problem);
			const [message] = toast.messages;
			return {
				type: message.type,
				key: message.messageKey,
				reload: message.action?.labelKey === 'pairs.reload',
				report: message.report ?? false
			};
		};
		expect(offer('offline')).toEqual({
			type: 'warn',
			key: 'problem.offline',
			reload: false,
			report: false
		});
		expect(offer('reload')).toMatchObject({ reload: true, report: false });
		expect(offer('mismatch')).toMatchObject({ reload: true, report: true });
		expect(offer('rules')).toMatchObject({ key: 'problem.rules', reload: false, report: true });
		expect(offer('code')).toEqual({
			type: 'error',
			key: 'problem.code',
			reload: false,
			report: true
		});
	});

	it('новий збій замінює старий, а звичайних тостів не чіпає', () => {
		toast.info('common.close', 5000);
		toast.problem('rules');
		toast.problem('code');
		expect(toast.messages.map((message) => message.problem)).toEqual([undefined, 'code']);
		toast.dismissProblems();
		expect(toast.messages).toHaveLength(1);
	});

	it('зникає сам за PROBLEM_MS; закріплений — не зникає, хоч би що робила миша', async () => {
		const { PROBLEM_MS } = await import('./toast.svelte');
		toast.problem('rules');
		vi.advanceTimersByTime(PROBLEM_MS);
		expect(toast.messages, 'незакріплений зник у свій час').toHaveLength(0);

		toast.problem('code');
		const { id } = toast.messages[0];
		toast.pause(id);
		toast.pin(id);
		toast.resume(id);
		vi.advanceTimersByTime(PROBLEM_MS * 4);
		expect(toast.messages).toHaveLength(1);
		expect(toast.messages[0].pinned).toBe(true);
		toast.remove(id);
		expect(toast.messages, 'хрестик закриває й закріплений').toHaveLength(0);
	});
});
