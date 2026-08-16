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
