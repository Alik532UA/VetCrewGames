// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { roomAwaitingMe, roomQuery, roomRoute } from './awaitedRoom';
import { ROOM_IDLE_MS } from '$lib/config/roomLife';
import type { OwnRoom } from '$lib/net/ownRooms';

/**
 * «ВАС ЧЕКАЮТЬ У ГРІ»: яка кімната справді чекає, а яка лише існує.
 *
 * ## Що тут доводиться
 *
 * Автор попросив сповіщення з двома кнопками для гравця, який вийшов зі сторінки
 * посеред партії. Найдорожча помилка такого сповіщення — нагадувати про те, чого
 * немає: партія скінчилася, або з кімнати всі пішли ще вчора, а смуга висить і
 * пропонує «повернутися».
 *
 * Тому дві межі, і кожна перевіряється окремо: `playing` і ЖИВА (позначку
 * `aliveAt` оновлює кожен, хто сидить у кімнаті; тиша означає, що чекати мене нема
 * кому).
 */

const room = (over: Partial<OwnRoom> = {}): OwnRoom => ({
	code: 'abcd',
	gameId: 'quiz',
	status: 'playing',
	hostUid: 'host',
	amHost: false,
	aliveAt: 1_000_000,
	...over
});

const NOW = 1_000_000;

describe('яка кімната чекає', () => {
	it('жива партія чекає', () => {
		expect(roomAwaitingMe([room()], NOW)?.code).toBe('abcd');
	});

	it('порожній перелік не чекає', () => {
		expect(roomAwaitingMe([], NOW)).toBeNull();
	});

	/** Лобі нікого не тримає: там партія ще не почалася. */
	it('лобі не чекає', () => {
		expect(roomAwaitingMe([room({ status: 'lobby' })], NOW)).toBeNull();
	});

	it('скінчена партія не чекає', () => {
		expect(roomAwaitingMe([room({ status: 'over' })], NOW)).toBeNull();
	});

	/**
	 * ГОЛОВНА МЕЖА. Без неї сповіщення пропонувало б вернутися в партію, з якої
	 * всі пішли — і кнопка «повернутися» вела б у порожню кімнату.
	 */
	it('кімната, у якій давно нікого, не чекає', () => {
		const silent = room({ aliveAt: NOW - ROOM_IDLE_MS - 1_000 });
		expect(roomAwaitingMe([silent], NOW)).toBeNull();
	});

	it('кімната старішої збірки без позначки лишається придатною', () => {
		expect(roomAwaitingMe([room({ aliveAt: undefined })], NOW)?.code).toBe('abcd');
	});

	it('із кількох живих — найсвіжіша', () => {
		const older = room({ code: 'old', aliveAt: NOW - 60_000 });
		const newer = room({ code: 'new', aliveAt: NOW - 1_000 });
		expect(roomAwaitingMe([older, newer], NOW)?.code).toBe('new');
		expect(roomAwaitingMe([newer, older], NOW)?.code).toBe('new');
	});

	/** Кімната з позначкою — краща підстава, ніж кімната без неї. */
	it('позначка часу перемагає її відсутність', () => {
		const stamped = room({ code: 'stamped', aliveAt: NOW - 1_000 });
		const bare = room({ code: 'bare', aliveAt: undefined });
		expect(roomAwaitingMe([bare, stamped], NOW)?.code).toBe('stamped');
	});
});

describe('куди веде «повернутися»', () => {
	/**
	 * КЛЮЧ маршруту, а не готовий шлях: шлях складає `langPath()` через
	 * `resolve()`, бо лише він знає і мову, і базовий шлях сайту. Склеєний рядок
	 * працював би в розробці й вів у нікуди на хостингу.
	 */
	it('кімната веде на сторінку своєї гри', () => {
		expect(roomRoute(room())).toBe('quiz/online');
		expect(roomRoute(room({ gameId: 'pairs' }))).toBe('pairs/online');
	});

	it('невідома гра веде у вікторину, а не в нікуди', () => {
		expect(roomRoute(room({ gameId: 'нова-гра' }))).toBe('quiz/online');
	});

	it('код їде в ?room= і кодується для адреси', () => {
		expect(roomQuery(room())).toBe('?room=abcd');
		expect(roomQuery(room({ code: 'a b' }))).toBe('?room=a%20b');
	});
});
