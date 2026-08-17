import { describe, expect, it, vi } from 'vitest';
import { LocalRoom } from '$lib/net/localRoom';
import type { Member, RoomInfo } from '$lib/net/roomTypes';

/*
 * Налаштування підмінені, як і в решті тестів контролерів: справжній синглтон у
 * конструкторі питає `window.matchMedia`, якого в jsdom немає.
 */
const addScore = vi.fn();
vi.mock('$lib/services/settings.svelte', () => ({ settings: { addScore } }));

const { PairsMatch } = await import('./pairsMatch.svelte');
const { TURN_LIMIT_MS } = await import('./turnLimit');

/**
 * Спільна партія «Знайди пару» — на двох учасниках в одному процесі.
 *
 * Головне, що тут доводиться: **стан партії є чистою функцією від (зерно, склад,
 * журнал)**. Саме на цьому тримається рішення «авторитету немає ні в кого»: якщо
 * двоє з того самого журналу отримують ту саму дошку, сервер для узгодження не
 * потрібен. Перевіряється це не описом, а порівнянням двох дошок після кожного
 * ходу.
 *
 * Транспорт підставний (`LocalRoom`) — і це не спрощення. Із живою базою кожна
 * перевірка вимагала б мережі й ключів, і мережевий шар лишився б без тестів
 * узагалі: рівно так, як у MindStep, де про це сказано в комментарі до правил.
 */

const HOST = 'uid-host';
const GUEST = 'uid-guest';
const WATCHER = 'uid-watcher';

const info = (over: Partial<RoomInfo> = {}): RoomInfo => ({
	gameId: 'pairs',
	rulesVersion: 1,
	seed: 20260817,
	status: 'playing',
	hostUid: HOST,
	// Чотири пари — партія коротка, але всі переходи в ній є.
	config: { pairs: 4, cols: 4 },
	...over
});

const members = (): Member[] => [
	{ uid: HOST, name: 'Господар', role: 'player', order: 1 },
	{ uid: GUEST, name: 'Гість', role: 'player', order: 2 }
];

/** Кімната з двома гравцями й двома підключеними пристроями. */
function table(extra: Member[] = []) {
	const room = new LocalRoom(info(), [...members(), ...extra]);
	const host = new PairsMatch(HOST, room.transport());
	const guest = new PairsMatch(GUEST, room.transport());
	const stop = [host.listen(), guest.listen()];
	return { room, host, guest, stop: () => stop.forEach((off) => off()) };
}

/** Як виглядає дошка: цього досить, щоб два стани збіглися або ні. */
const board = (match: { game: { slots: unknown[]; currentPlayerIndex: number } }) =>
	JSON.stringify({
		slots: match.game.slots,
		turn: match.game.currentPlayerIndex
	});

type Slot = { card: { pairKey: string }; takenBy: string | null };
type Board = { game: { slots: Slot[] } };

/**
 * Індекси двох карток, що складають пару, — серед тих, що ЩЕ НА ДОШЦІ.
 *
 * `takenBy === null` тут не дрібниця: перша версія цієї помічної функції шукала
 * серед усіх карток і після кожної забраної пари повертала ту саму. Ходи йшли в
 * журнал, дошка не рухалася, і перевірка кінця партії падала — на помилці тесту,
 * а не гри.
 */
function findPair(match: Board): [number, number] {
	const slots = match.game.slots;
	for (let i = 0; i < slots.length; i++) {
		if (slots[i].takenBy !== null) continue;
		for (let j = i + 1; j < slots.length; j++) {
			if (slots[j].takenBy !== null) continue;
			if (slots[i].card.pairKey === slots[j].card.pairKey) return [i, j];
		}
	}
	throw new Error('пари немає — дошка не роздана');
}

/** Два індекси, що НЕ складають пари, — серед тих, що ще на дошці. */
function findMismatch(match: Board): [number, number] {
	const slots = match.game.slots;
	for (let i = 0; i < slots.length; i++) {
		if (slots[i].takenBy !== null) continue;
		for (let j = i + 1; j < slots.length; j++) {
			if (slots[j].takenBy !== null) continue;
			if (slots[i].card.pairKey !== slots[j].card.pairKey) return [i, j];
		}
	}
	throw new Error('усі картки однакові — дошка не роздана');
}

describe('партія роздається з кімнати', () => {
	it('перевірка жива: обидва бачать дошку, а не порожнє місце', () => {
		const { host, guest, stop } = table();
		expect(host.game.slots).toHaveLength(8);
		expect(guest.game.slots).toHaveLength(8);
		stop();
	});

	it('те саме зерно — та сама розкладка в обох', () => {
		const { host, guest, stop } = table();
		expect(board(guest)).toBe(board(host));
		stop();
	});

	it('перший хід — за тим, хто зайшов першим, а не за тим, хто натиснув', () => {
		const { host, stop } = table();
		expect(host.actor?.id).toBe(HOST);
		expect(host.myTurn).toBe(true);
		stop();
	});

	it('доки кімната в лобі, дошка нічия', () => {
		const room = new LocalRoom(info({ status: 'lobby' }), members());
		const match = new PairsMatch(HOST, room.transport());
		const off = match.listen();
		expect(match.status).toBe('lobby');
		expect(match.actor, 'у лобі ходити нема кому').toBeNull();
		off();
	});
});

describe('хід їде журналом', () => {
	it('клік не малює нічого сам — малює хід, що приїхав', async () => {
		const { host, guest, stop } = table();
		const [first] = findPair(host);

		await host.flip(first);

		expect(host.game.slots[first].faceUp, 'у того, хто клікнув').toBe(true);
		expect(guest.game.slots[first].faceUp, 'і в сусіда — з того самого журналу').toBe(true);
		expect(board(guest)).toBe(board(host));
		stop();
	});

	it('зібрана пара лишає хід тому самому гравцеві', async () => {
		const { host, guest, stop } = table();
		const [a, b] = findPair(host);

		await host.flip(a);
		await host.flip(b);

		expect(host.game.slots[a].takenBy).toBe(HOST);
		expect(host.actor?.id, 'влучив — грає далі').toBe(HOST);
		expect(board(guest)).toBe(board(host));
		stop();
	});

	it('невдала пара передає хід — але лише коли її оголосили', async () => {
		const { host, guest, stop } = table();
		const [a, b] = findMismatch(host);

		await host.flip(a);
		await host.flip(b);
		expect(host.actor?.id, 'дошка чекає на оголошення').toBe(HOST);
		expect(host.game.awaitingPeek).toBe(true);

		await host.resolve();
		expect(host.actor?.id).toBe(GUEST);
		expect(guest.myTurn, 'сусід дізнався про це з журналу').toBe(true);
		expect(board(guest)).toBe(board(host));
		stop();
	});

	it('перегортання оголошує ТОЙ САМИЙ гравець, а не чужий таймер', async () => {
		/*
		 * У соло паузу міряє таймер сторінки. Якби кожен пристрій міряв свою, дошки
		 * розійшлися б на той час, поки один уже перегорнув, а другий ще ні.
		 */
		const { host, guest, stop } = table();
		const [a, b] = findMismatch(host);
		await host.flip(a);
		await host.flip(b);

		await guest.resolve();
		expect(host.actor?.id, 'чуже оголошення нічого не змінило').toBe(HOST);
		stop();
	});
});

describe('чужі ходи нікого не розводять', () => {
	it('хід не в свою черга не означає нічого — і однаково в обох', async () => {
		const { host, guest, stop } = table();
		const before = board(host);
		const [first] = findPair(host);

		await guest.flip(first);

		expect(board(host), 'дошка не ворухнулася').toBe(before);
		expect(board(guest)).toBe(before);
		stop();
	});

	it('навіть дописаний напряму позачерговий хід відкидають ОБИДВА', async () => {
		// Клієнт міг би обійти перевірку в `flip()` і написати в журнал сам. Правила
		// застосування однакові в усіх, тож такий хід просто нічого не означає.
		const { room, host, guest, stop } = table();
		const before = board(host);

		const written = await room
			.transport()
			.append({ seq: 1, by: GUEST, type: 'flip', payload: { index: 0 } });

		expect(written, 'база такий запис приймає').toBe(true);
		expect(board(host), 'а правила — ні').toBe(before);
		expect(board(guest)).toBe(before);
		stop();
	});

	it('номер ходу зайнятий — другий хід зникає', async () => {
		const { room, host, stop } = table();
		const [first] = findPair(host);

		expect(
			await room.transport().append({ seq: 1, by: HOST, type: 'flip', payload: { index: first } })
		).toBe(true);
		expect(
			await room.transport().append({ seq: 1, by: HOST, type: 'flip', payload: { index: 3 } }),
			'той самий номер удруге не пишеться'
		).toBe(false);
		expect(room.moves).toHaveLength(1);
		stop();
	});
});

describe('глядач', () => {
	const watcher = (): Member => ({
		uid: WATCHER,
		name: 'Глядач',
		role: 'spectator',
		order: 3
	});

	it('бачить ту саму дошку, що й гравці', async () => {
		const { room, host, stop } = table([watcher()]);
		const eye = new PairsMatch(WATCHER, room.transport());
		const off = eye.listen();
		const [a] = findPair(host);

		await host.flip(a);

		expect(board(eye)).toBe(board(host));
		expect(eye.iAmSpectator).toBe(true);
		off();
		stop();
	});

	it('у черзі не стоїть і дописати не може', async () => {
		const { room, host, stop } = table([watcher()]);
		const eye = new PairsMatch(WATCHER, room.transport());
		const off = eye.listen();

		expect(eye.players.map((player) => player.uid)).toEqual([HOST, GUEST]);
		expect(eye.myTurn).toBe(false);

		await eye.flip(0);
		expect(room.moves, 'журнал не поповнився').toHaveLength(0);
		expect(board(eye)).toBe(board(host));
		off();
		stop();
	});
});

describe('пізній учасник відтворює, а не отримує', () => {
	it('той, хто підключився посеред партії, доганяє журналом', async () => {
		const { room, host, stop } = table();
		const [a, b] = findPair(host);
		await host.flip(a);
		await host.flip(b);

		// Третій пристрій підключається лише зараз — стану йому ніхто не надсилав.
		const late = new PairsMatch(GUEST, room.transport());
		const off = late.listen();

		expect(board(late)).toBe(board(host));
		expect(late.applied).toBe(2);
		off();
		stop();
	});

	it('склад гравців змінився — дошка роздається заново', async () => {
		/*
		 * Черга рахується зі складу, тож новий гравець посеред партії означає іншу
		 * партію. Це не «оптимізація на потім»: без переroзданої дошки двоє
		 * рахували б чергу від різних списків.
		 */
		const { room, host, stop } = table();
		const [a] = findPair(host);
		await host.flip(a);
		expect(host.applied).toBe(1);

		room.setMembers([...members(), { uid: 'uid-third', name: 'Третій', role: 'player', order: 3 }]);

		expect(host.applied, 'журнал прокручується спочатку').toBe(1);
		expect(host.players).toHaveLength(3);
		stop();
	});
});

describe('кінець партії', () => {
	it('усі пари зібрано — ходити більше нема кому', async () => {
		const { host, guest, stop } = table();

		// Забираємо пари одну за одною: влучний хід лишається за тим самим гравцем,
		// тож усю партію грає господар.
		for (let taken = 0; taken < 4; taken++) {
			const [a, b] = findPair(host);
			await host.flip(a);
			await host.flip(b);
		}

		expect(host.game.gameOver).toBe(true);
		expect(host.actor, 'партія скінчилася').toBeNull();
		expect(host.game.takenPairs).toBe(4);
		expect(board(guest)).toBe(board(host));
		stop();
	});
});

describe('хід їде транспортом, а не лише в памʼяті', () => {
	it('хід без даних не несе порожнього поля', async () => {
		/*
		 * Закріплений дефект. `set()` у Firebase на `undefined` усередині обʼєкта
		 * КИДАЄ, тож хід `peek` (даних не несе) не записувався ніколи — дошка
		 * назавжди лишалася з двома відкритими картками. Помітити це на підставному
		 * транспорті було неможливо, бо той `undefined` приймав; тепер він так само
		 * суворий, і ця перевірка падає на регресії.
		 */
		const { room, host, stop } = table();
		const [a, b] = findMismatch(host);
		await host.flip(a);
		await host.flip(b);

		await host.resolve();

		const peek = room.moves.find((move) => move.type === 'peek');
		expect(peek, 'перегортання мусило дійти до транспорту').toBeTruthy();
		expect(Object.values(peek!).every((value) => value !== undefined)).toBe(true);
		expect('payload' in peek!, 'порожнього поля немає взагалі').toBe(false);
		stop();
	});

	it('жоден хід партії не містить undefined', async () => {
		const { room, host, stop } = table();
		const [a, b] = findPair(host);
		await host.flip(a);
		await host.flip(b);
		const [c, d] = findMismatch(host);
		await host.flip(c);
		await host.flip(d);
		await host.resolve();

		expect(room.moves.length).toBeGreaterThan(4);
		for (const move of room.moves) {
			for (const [key, value] of Object.entries(move)) {
				expect(value, `${move.type}.${key}`).not.toBeUndefined();
			}
		}
		stop();
	});
});

describe('швидкий клік не грає за суперника', () => {
	/**
	 * Дефект, який знайшов гравець.
	 *
	 * У соло третя картка навмисно гортає невдалу пару одразу — хто вже все
	 * запамʼятав, не мусить чекати таймера. У спільній партії те саме правило
	 * оберталося на дірку: перегортання передає хід суперникові, і та сама третя
	 * картка ставала ЙОГО першою — вибраною мною.
	 */
	it('клік по третій картці перегортає, а не відкриває суперникові його першу', async () => {
		const { host, guest, stop } = table();
		const [a, b] = findMismatch(host);
		await host.flip(a);
		await host.flip(b);

		const third = host.game.slots.findIndex(
			(slot, index) => index !== a && index !== b && !slot.faceUp
		);
		await host.flip(third);

		expect(host.actor?.id, 'хід перейшов').toBe(GUEST);
		expect(host.game.slots[third].faceUp, 'третя картка НЕ відкрита').toBe(false);
		expect(
			host.game.slots.filter((slot) => slot.faceUp),
			'дошка чиста'
		).toHaveLength(0);
		expect(board(guest)).toBe(board(host));
		stop();
	});

	it('дописаний напряму хід через паузу відкидають обидва', async () => {
		// Той самий обхід, але вручну: перевірку в `flip()` можна обійти записом.
		const { room, host, guest, stop } = table();
		const [a, b] = findMismatch(host);
		await host.flip(a);
		await host.flip(b);
		const before = board(host);

		const third = host.game.slots.findIndex(
			(slot, index) => index !== a && index !== b && !slot.faceUp
		);
		await room.transport().append({ seq: 3, by: HOST, type: 'flip', payload: { index: third } });

		expect(board(host), 'дошка не ворухнулася').toBe(before);
		expect(board(guest)).toBe(before);
		stop();
	});

	it('після влучної пари клік і далі відкриває — швидкість не загубилася', async () => {
		const { host, stop } = table();
		const [a, b] = findPair(host);
		await host.flip(a);
		await host.flip(b);

		const next = host.game.slots.findIndex((slot) => slot.takenBy === null);
		await host.flip(next);

		expect(host.game.slots[next].faceUp, 'влучив — грає далі й без паузи').toBe(true);
		stop();
	});
});

describe('господар — той, кого назвала кімната', () => {
	it('господар лишається господарем, навіть коли не перший у складі', () => {
		/*
		 * Дефект живого прогону: сторінка рахувала господаря як «перший у списку», а
		 * база віддає склад за алфавітом ключів. Щойно заходив хтось із меншим `uid`,
		 * кнопка «Почати» зникала — у самого господаря.
		 */
		const room = new LocalRoom(info({ status: 'lobby' }), [
			{ uid: 'aaa-guest', name: 'Гість', role: 'player', order: 2 },
			{ uid: HOST, name: 'Господар', role: 'player', order: 1 }
		]);
		const match = new PairsMatch(HOST, room.transport());
		const off = match.listen();

		expect(match.members[0].uid, 'у складі він НЕ перший').not.toBe(HOST);
		expect(match.hostUid).toBe(HOST);
		off();
	});

	it('черга рахується за входом, а не за порядком у списку', () => {
		const room = new LocalRoom(info(), [
			{ uid: 'aaa-guest', name: 'Гість', role: 'player', order: 2 },
			{ uid: HOST, name: 'Господар', role: 'player', order: 1 }
		]);
		const match = new PairsMatch(HOST, room.transport());
		const off = match.listen();

		expect(match.players.map((player) => player.uid)).toEqual([HOST, 'aaa-guest']);
		expect(match.actor?.id, 'перший хід у того, хто зайшов першим').toBe(HOST);
		off();
	});
});

describe('нова партія в тій самій кімнаті', () => {
	it('нове зерно роздає іншу колоду й стирає журнал', async () => {
		const { room, host, guest, stop } = table();
		const [a, b] = findPair(host);
		await host.flip(a);
		await host.flip(b);
		const before = board(host);

		await room.transport().restart(777);

		expect(room.moves, 'журнал порожній').toHaveLength(0);
		expect(host.applied).toBe(0);
		expect(board(host), 'колода інша').not.toBe(before);
		expect(board(guest), 'і однакова в обох').toBe(board(host));
		expect(host.actor?.id, 'перший хід знову за першим').toBe(HOST);
		stop();
	});
});

/**
 * Межа очікування: суперник зник, і партія не мусить висіти назавжди.
 *
 * Головне, що тут доводиться, — **присутність не впливає на стан партії**.
 * Присутність гасне сама (`onDisconnect`) і не лежить у журналі, тож вона лише
 * вмикає кнопку. Змінює стан рівно один хід — `yield`, — і його законність усі
 * учасники перевіряють однаково, за серверними позначками часу з журналу.
 *
 * Час тут «серверний» і рухається `room.tick()`. Не `Date.now()`: перевірка, що
 * залежить від справжнього годинника, або чекає реальні секунди, або зеленіє
 * випадково.
 */
describe('суперник відпав', () => {
	/** Трохи більше за межу — щоб перетин був однозначним. */
	const PAST_LIMIT = TURN_LIMIT_MS + 1000;

	it('до часу забрати чергу не можна — і кнопки немає', async () => {
		const { room, host, guest, stop } = table();
		// Хід за господарем, чекає гість.
		expect(host.actor?.id).toBe(HOST);

		room.tick(TURN_LIMIT_MS - 1000);
		expect(guest.canYieldAt(room.tick(0)), 'межа ще не вийшла').toBe(false);

		await guest.yieldTurn(room.tick(0));
		expect(room.moves, 'зарано — ходу немає').toHaveLength(0);
		expect(host.actor?.id, 'черга не зрушила').toBe(HOST);
		stop();
	});

	it('після межі чергу забирають — і однаково в обох', async () => {
		const { room, host, guest, stop } = table();

		const now = room.tick(PAST_LIMIT);
		expect(guest.canYieldAt(now), 'межа вийшла').toBe(true);

		await guest.yieldTurn(now);

		expect(host.actor?.id, 'черга перейшла до того, хто чекав').toBe(GUEST);
		expect(guest.actor?.id, 'і так само в другого').toBe(GUEST);
		expect(board(guest)).toBe(board(host));
		stop();
	});

	it('свою чергу віддати не можна: це був би спосіб пропустити невигідний хід', async () => {
		const { room, host, stop } = table();
		const now = room.tick(PAST_LIMIT);

		expect(host.canYieldAt(now), 'моя черга — кнопки немає').toBe(false);
		await host.yieldTurn(now);
		expect(room.moves).toHaveLength(0);
		stop();
	});

	it('дописаний напряму yield до часу відкидають обидва', async () => {
		// Кнопки немає, але запис у журнал можна зробити руками. Правила
		// застосування мусять відкинути такий хід у ВСІХ, а не лише в UI.
		const { room, host, guest, stop } = table();
		room.tick(1000);

		await room.transport().append({ seq: 1, by: GUEST, type: 'yield' });

		expect(host.actor?.id, 'черга не зрушила').toBe(HOST);
		expect(guest.actor?.id).toBe(HOST);
		expect(host.applied, 'номер журналу зайнято — хід просто нічого не означає').toBe(1);
		stop();
	});

	it('глядач чергу не забирає', async () => {
		const watcher: Member = { uid: WATCHER, name: 'Глядач', role: 'spectator', order: 3 };
		const { room, host, stop } = table([watcher]);
		const eye = new PairsMatch(WATCHER, room.transport());
		const off = eye.listen();

		const now = room.tick(PAST_LIMIT);
		expect(eye.canYieldAt(now), 'глядач у черзі не стоїть').toBe(false);

		await room.transport().append({ seq: 1, by: WATCHER, type: 'yield' });
		expect(host.actor?.id, 'черга не зрушила').toBe(HOST);

		off();
		stop();
	});

	it('відкрита картка того, хто пішов, закривається — очікування не спосіб підглянути', async () => {
		const { room, host, guest, stop } = table();
		const [a] = findMismatch(host);
		await host.flip(a);
		expect(host.game.slots[a].faceUp, 'картку відкрито').toBe(true);

		await guest.yieldTurn(room.tick(PAST_LIMIT));

		expect(host.game.slots[a].faceUp, 'і закрито разом із передачею черги').toBe(false);
		expect(board(guest)).toBe(board(host));
		stop();
	});

	it('сміттєві ходи НЕ подовжують очікування', async () => {
		/*
		 * Дірка, яку це закриває. Номер у журналі займає будь-який учасник: правило
		 * бази дозволяє створити хід, підписаний своїм uid, а законність перевіряють
		 * уже правила гри. Якби відлік зсував кожен доданий хід, глядач міг би
		 * дописувати сміття раз на хвилину — і той, чий партнер зник, не забрав би
		 * чергу НІКОЛИ.
		 */
		const watcher: Member = { uid: WATCHER, name: 'Глядач', role: 'spectator', order: 3 };
		const { room, guest, stop } = table([watcher]);

		room.tick(PAST_LIMIT - 1000);
		// Глядач дописує щось своє — законним ходом це не є.
		await room.transport().append({ seq: 1, by: WATCHER, type: 'flip', payload: { index: 0 } });
		const now = room.tick(1000);

		expect(guest.canYieldAt(now), 'межа все одно вийшла').toBe(true);
		await guest.yieldTurn(now);
		expect(guest.actor?.id, 'чергу забрано').toBe(GUEST);
		stop();
	});

	it('відлік першої черги йде від початку партії, а не від нуля', async () => {
		// Суперник, який зайшов у кімнату й одразу зник, інакше тримав би першу
		// чергу назавжди: межі очікування не було б від чого рахувати.
		const { room, guest, stop } = table();
		expect(guest.turnSince, 'позначка початку партії є').not.toBeNull();
		expect(guest.yieldReadyAt).toBe((guest.turnSince ?? 0) + TURN_LIMIT_MS);
		expect(guest.canYieldAt(room.tick(PAST_LIMIT))).toBe(true);
		stop();
	});

	it('після власного ходу відлік починається заново', async () => {
		const { room, host, guest, stop } = table();
		room.tick(PAST_LIMIT);

		// Господар усе-таки зіграв — отже, він на місці.
		const [a, b] = findPair(host);
		await host.flip(a);
		await host.flip(b);

		expect(guest.canYieldAt(room.tick(0)), 'відлік зсунувся на щойно зроблений хід').toBe(false);
		stop();
	});

	it('у кімнаті партія скінчилася — забирати нічого', async () => {
		const { room, host, guest, stop } = table();
		await room.transport().setStatus('over');
		expect(guest.yieldReadyAt, 'межа незастосовна').toBeNull();
		expect(guest.canYieldAt(room.tick(PAST_LIMIT))).toBe(false);
		expect(host.status).toBe('over');
		stop();
	});
});
