// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { roomQuery, roomRoute, roomsAwaitingMe } from './awaitedRoom';
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

describe('які кімнати варті питання', () => {
	const codes = (rooms: ReturnType<typeof roomsAwaitingMe>) => rooms.map((r) => r.code);

	it('жива партія — кандидат', () => {
		expect(codes(roomsAwaitingMe([room()], NOW))).toEqual(['abcd']);
	});

	it('порожній перелік не дає кандидатів', () => {
		expect(roomsAwaitingMe([], NOW)).toEqual([]);
	});

	/** Лобі нікого не тримає: там партія ще не почалася. */
	it('лобі не кандидат', () => {
		expect(roomsAwaitingMe([room({ status: 'lobby' })], NOW)).toEqual([]);
	});

	it('скінчена партія не кандидат', () => {
		expect(roomsAwaitingMe([room({ status: 'over' })], NOW)).toEqual([]);
	});

	/**
	 * Дешевий відсів: кімната, у якій дві хвилини тиші, не варта навіть питання про
	 * присутність. Остаточне слово все одно за присутністю — див. контролер.
	 */
	it('кімната, у якій давно нікого, не кандидат', () => {
		const silent = room({ aliveAt: NOW - ROOM_IDLE_MS - 1_000 });
		expect(roomsAwaitingMe([silent], NOW)).toEqual([]);
	});

	it('кімната старішої збірки без позначки лишається кандидатом', () => {
		expect(codes(roomsAwaitingMe([room({ aliveAt: undefined })], NOW))).toEqual(['abcd']);
	});

	it('свіжіші спершу', () => {
		const older = room({ code: 'old', aliveAt: NOW - 60_000 });
		const newer = room({ code: 'new', aliveAt: NOW - 1_000 });
		expect(codes(roomsAwaitingMe([older, newer], NOW))).toEqual(['new', 'old']);
		expect(codes(roomsAwaitingMe([newer, older], NOW))).toEqual(['new', 'old']);
	});

	/** Кімната з позначкою — краща підстава, ніж кімната без неї. */
	it('позначка часу йде перед її відсутністю', () => {
		const stamped = room({ code: 'stamped', aliveAt: NOW - 1_000 });
		const bare = room({ code: 'bare', aliveAt: undefined });
		expect(codes(roomsAwaitingMe([bare, stamped], NOW))).toEqual(['stamped', 'bare']);
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
