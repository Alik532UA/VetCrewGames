// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { AWAY_GRACE_MS, awaySecondsLeft, awayStamps, shouldHoldRound } from './awayWait';
import type { Member } from '$lib/net/roomTypes';

/**
 * ОЧІКУВАННЯ ЗНИКЛОГО: скільки чекаємо й коли партія справді стоїть.
 *
 * ## Що тут доводиться
 *
 * Вимога автора: «зʼявляється по центру екрану вікно що перекриває гру з
 * очікуванням гравця, поки чекаєте гравця, то у грі зупиняється таймер і до
 * таймера додається +3 секунди, бо це відволікаючий фактор».
 *
 * Пауза без межі перетворює вихід одного гравця на зупинку всіх — тому межі тут
 * дві, і кожна перевіряється окремо: пільговий час і «зниклий уже відповів». Друга
 * важливіша за першу: без неї той, хто відповів і закрив вкладку, тримав би раунд
 * на паузі, а присутні отримували б чужий час у подарунок.
 *
 * Сам зсув дедлайну живе в `controllers/quizMatch` (`setHold`) — там же й
 * надбавка в три секунди.
 */

const member = (uid: string): Member =>
	({ uid, name: uid, country: '', avatar: null }) as unknown as Member;

describe('пільговий час', () => {
	it('рахується від НАЙПІЗНІШОГО зникнення', () => {
		const now = 100_000;
		const since = { a: now - 10_000, b: now - 2_000 };

		// Якби рахувалося від найранішого, лишилося б 5 с; від найпізнішого — 13.
		expect(awaySecondsLeft([member('a'), member('b')], since, now)).toBe(
			Math.ceil((AWAY_GRACE_MS - 2_000) / 1000)
		);
	});

	it('без зниклих — нуль, а не пільга', () => {
		expect(awaySecondsLeft([], {}, 100_000)).toBe(0);
	});

	it('вичерпаний час не стає відʼємним', () => {
		const now = 100_000;
		expect(awaySecondsLeft([member('a')], { a: now - AWAY_GRACE_MS - 5_000 }, now)).toBe(0);
	});
});

describe('чи стоїть партія', () => {
	it('стоїть, поки зниклий не відповів і пільга не вичерпана', () => {
		expect(shouldHoldRound([member('a')], [], 7)).toBe(true);
	});

	/**
	 * Головна межа: зниклий, що вже відповів, раунду не тримає. Інакше «відповів і
	 * закрив вкладку» дарувало б присутнім чужий час.
	 */
	it('не стоїть, якщо зниклий уже відповів', () => {
		expect(shouldHoldRound([member('a')], ['a'], 7)).toBe(false);
	});

	it('не стоїть після пільгового часу', () => {
		expect(shouldHoldRound([member('a')], [], 0)).toBe(false);
	});

	it('не стоїть, коли всі на місці', () => {
		expect(shouldHoldRound([], [], 7)).toBe(false);
	});

	it('двоє зниклих: досить одного, хто не відповів', () => {
		expect(shouldHoldRound([member('a'), member('b')], ['a'], 7)).toBe(true);
	});
});

describe('мить зникнення', () => {
	it('тримає попередню мітку, а не переставляє її щоразу', () => {
		const players = [member('a'), member('b')];
		const first = awayStamps(players, ['b'], {}, 1_000);
		expect(first).toEqual({ a: 1_000 });

		// `a` і далі відсутній — мітка мусить лишитися першою, інакше пільговий час
		// поновлювався б на кожному знімку присутності й не закінчувався б ніколи.
		const later = awayStamps(players, ['b'], first, 9_000);
		expect(later).toEqual({ a: 1_000 });
	});

	it('той, хто повернувся, зникає з переліку', () => {
		const players = [member('a')];
		expect(awayStamps(players, ['a'], { a: 1_000 }, 9_000)).toEqual({});
	});
});
