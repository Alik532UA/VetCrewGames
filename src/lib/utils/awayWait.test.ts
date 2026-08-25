// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
	AWAY_GRACE_MS,
	awaySecondsLeft,
	awayStamps,
	awayWaitState,
	goOnDecided,
	shouldHoldRound,
	votesNeeded
} from './awayWait';
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
	it('стоїть, поки зниклий не відповів і рішення не ухвалене', () => {
		expect(shouldHoldRound([member('a')], [], [], 2)).toBe(true);
	});

	/**
	 * Головна межа: зниклий, що вже відповів, раунду не тримає. Інакше «відповів і
	 * закрив вкладку» дарувало б присутнім чужий час.
	 */
	it('не стоїть, якщо зниклий уже відповів', () => {
		expect(shouldHoldRound([member('a')], ['a'], [], 2)).toBe(false);
	});

	/**
	 * ПІЛЬГОВИЙ ЧАС БІЛЬШЕ НЕ ЗНІМАЄ ПАУЗУ — і це головна зміна правила.
	 *
	 * Доти партія йшла далі сама за 15 секунд. Вимога автора: «після таймеру
	 * автоматично НЕ зникає вікно і не продовжується гра, а кнопка
	 * розблоковується». Причина в житті: гравець перезавантажує комп'ютер, і
	 * рішення чекати чи ні належить тим, хто грає.
	 */
	it('стоїть і після пільгового часу, поки не проголосували', () => {
		expect(shouldHoldRound([member('a')], [], [], 2)).toBe(true);
	});

	it('не стоїть, коли голосів досить', () => {
		// Двоє присутніх — треба два голоси.
		expect(shouldHoldRound([member('a')], [], ['b'], 2)).toBe(true);
		expect(shouldHoldRound([member('a')], [], ['b', 'c'], 2)).toBe(false);
	});

	it('не стоїть, коли всі на місці', () => {
		expect(shouldHoldRound([], [], [], 2)).toBe(false);
	});

	it('двоє зниклих: досить одного, хто не відповів', () => {
		expect(shouldHoldRound([member('a'), member('b')], ['a'], [], 3)).toBe(true);
	});
});

describe('скільки голосів потрібно', () => {
	it('більшість присутніх', () => {
		expect(votesNeeded(2)).toBe(2);
		expect(votesNeeded(3)).toBe(2);
		expect(votesNeeded(4)).toBe(3);
		expect(votesNeeded(5)).toBe(3);
	});

	/**
	 * Один присутній — один голос. Це не помилка округлення: коли решта пішла,
	 * рішення нема з ким ділити, і вимагати двох означало б замкнути людину в
	 * кімнаті назавжди.
	 */
	it('один присутній вирішує сам', () => {
		expect(votesNeeded(1)).toBe(1);
		expect(goOnDecided(['a'], 1)).toBe(true);
	});

	it('свій голос рахується один раз — це вже забезпечує журнал', () => {
		expect(goOnDecided(['a'], 2)).toBe(false);
		expect(goOnDecided(['a', 'b'], 2)).toBe(true);
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

describe('стан чекання одним обʼєктом', () => {
	const match = (over: Partial<Parameters<typeof awayWaitState>[0]> = {}) => ({
		away: [member('a')],
		answered: [] as string[],
		goOn: [] as string[],
		present: ['b', 'c'],
		...over
	});

	it('збирає паузу й межу голосів із полів матчу', () => {
		expect(awayWaitState(match())).toEqual({ hold: true, needed: 2 });
	});

	it('досить голосів — пауза знята', () => {
		expect(awayWaitState(match({ goOn: ['b', 'c'] })).hold).toBe(false);
	});

	/** Матчу ще немає — чекати нема на що, і це не «пауза за замовчуванням». */
	it('без матчу партія не стоїть', () => {
		expect(awayWaitState(null)).toEqual({ hold: false, needed: 1 });
	});
});
