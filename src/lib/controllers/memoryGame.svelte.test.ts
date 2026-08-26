import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animals } from '$lib/config/population-game';
import {
	buildDeck,
	MEMORY_PAIRS,
	MEMORY_PAIRS_COMPACT,
	layoutForViewport
} from '$lib/config/memory-game';

/*
 * Рахунок і рекорди живуть у `playerData`, і мокається саме він: доти тут
 * стояв мок `settings`, бо рахунок був полем налаштувань. Переїзд перевіряти
 * тут нічого — важливо, що контролер кличе `addScore` і `finishGame` рівно
 * тоді, коли треба.
 */
const playerMock = { addScore: vi.fn(), finishGame: vi.fn() };
vi.mock('$lib/services/playerData.svelte', () => ({ playerData: playerMock }));

const { MemoryGameController } = await import('./memoryGame.svelte');

describe('колода «Знайди пару»', () => {
	it('перевірка жива: тварин вистачає на колоду', () => {
		expect(animals.length).toBeGreaterThan(MEMORY_PAIRS * 2);
	});

	it('колода — це рівно пари, і кожна тварина трапляється двічі', () => {
		const deck = buildDeck(1);
		expect(deck).toHaveLength(MEMORY_PAIRS * 2);

		const counts = new Map<string, number>();
		for (const card of deck) counts.set(card.pairKey, (counts.get(card.pairKey) ?? 0) + 1);
		expect(counts.size, 'різних тварин рівно стільки, скільки пар').toBe(MEMORY_PAIRS);
		expect(
			[...counts.values()].every((n) => n === 2),
			'кожна двічі'
		).toBe(true);
	});

	it('id карток унікальні', () => {
		const deck = buildDeck(7);
		expect(new Set(deck.map((card) => card.id)).size).toBe(deck.length);
	});

	/**
	 * Головна властивість для спільної партії: те саме зерно — та сама
	 * розкладка. Без неї учасникам довелося б пересилати всю колоду, а
	 * розбіжність вилізла б аж посеред гри.
	 */
	it('те саме зерно дає ту саму колоду, різні — різну', () => {
		const ids = (seed: number) =>
			buildDeck(seed)
				.map((card) => card.id)
				.join(',');
		expect(ids(42)).toBe(ids(42));
		expect(ids(42)).not.toBe(ids(43));
	});

	/**
	 * Не тавтологія: перевіряється саме ВІДПОВІДНІСТЬ порогу й розміру колоди.
	 * Розійшовшись, вони дають сітку в чотири колонки з чотирнадцятьма парами —
	 * сім рядів, під які місця не рахували, і партію доводиться гортати.
	 */
	it('вузький екран дає меншу колоду, широкий — повну', () => {
		const stub = (matches: boolean) =>
			vi.stubGlobal('matchMedia', (query: string) => ({ matches, media: query }));

		stub(true);
		expect(layoutForViewport()).toEqual({ pairs: MEMORY_PAIRS_COMPACT, cols: 4 });
		stub(false);
		expect(layoutForViewport()).toEqual({ pairs: MEMORY_PAIRS, cols: 7 });
	});

	/**
	 * Пари й колонки — одне рішення: десять пар у сім колонок дають два ряди й
	 * хвостик, чотирнадцять у чотири — сім рядів. Доти колонки задавав
	 * медіазапит, а пари — функція, і зв'язок тримався на тому, що обидва пороги
	 * випадково однакові.
	 */
	it('колода лягає повними рядами в обох розкладках', () => {
		const stub = (matches: boolean) =>
			vi.stubGlobal('matchMedia', (query: string) => ({ matches, media: query }));

		for (const narrow of [true, false]) {
			stub(narrow);
			const { pairs, cols } = layoutForViewport();
			expect((pairs * 2) % cols, `${pairs} пар у ${cols} колонок лишають хвостик`).toBe(0);
		}
	});

	it('менша колода лягає повними рядами по чотири', () => {
		expect(MEMORY_PAIRS_COMPACT * 2, 'інакше останній ряд недомальований').toBe(20);
		expect((MEMORY_PAIRS_COMPACT * 2) % 4).toBe(0);
	});

	it('колода перемішана, а не зібрана парами поспіль', () => {
		// Без тасування сусідні картки були б однією парою. Перевіряємо саме це,
		// а не «випадковість»: її тест довести не може.
		const deck = buildDeck(5);
		const adjacentPairs = deck.filter(
			(card, index) => index % 2 === 0 && deck[index + 1]?.pairKey === card.pairKey
		).length;
		expect(adjacentPairs).toBeLessThan(MEMORY_PAIRS);
	});
});

// `matchMedia` підмінює лише перевірка порогу — решті він не потрібен, і
// лишати підміну після неї означало б, що наступний тест бачить чужий екран.
afterEach(() => vi.unstubAllGlobals());

describe('MemoryGameController', () => {
	beforeEach(() => {
		playerMock.addScore.mockReset();
		playerMock.finishGame.mockReset();
	});

	const started = (seed = 1) => {
		const game = new MemoryGameController();
		game.start({ seed });
		return game;
	};

	/** Індекси двох карток однієї пари. */
	const pairIndexes = (game: InstanceType<typeof MemoryGameController>, nth = 0) => {
		const key = [...new Set(game.slots.map((s) => s.card.pairKey))][nth];
		return game.slots.flatMap((slot, index) => (slot.card.pairKey === key ? [index] : []));
	};

	/** Індекси двох карток РІЗНИХ пар. */
	const mismatchIndexes = (game: InstanceType<typeof MemoryGameController>) => {
		const [a] = pairIndexes(game, 0);
		const [b] = pairIndexes(game, 1);
		return [a, b];
	};

	it('start() розкладає закриту колоду', () => {
		const game = started();
		expect(game.slots).toHaveLength(MEMORY_PAIRS * 2);
		expect(game.slots.every((slot) => !slot.faceUp && slot.takenBy === null)).toBe(true);
		expect(game.takenPairs).toBe(0);
		expect(game.moves).toBe(0);
		expect(game.gameOver).toBe(false);
	});

	/**
	 * Розмір колоди належить ПАРТІЇ, а не пристрою. На телефоні він менший, і
	 * без цього двоє учасників розклали б із того самого зерна різні колоди —
	 * тобто спільна гра розсипалася б там, де вона й задумана: у синхронності.
	 */
	it('кількість пар задає партія', () => {
		const game = new MemoryGameController();
		game.start({ seed: 1, pairs: 10 });

		expect(game.pairs).toBe(10);
		expect(game.slots).toHaveLength(20);
		expect(new Set(game.slots.map((slot) => slot.card.pairKey)).size).toBe(10);
	});

	it('менша колода закінчується на своїй кількості пар, а не на типовій', () => {
		const game = new MemoryGameController();
		game.start({ seed: 2, pairs: 10 });

		for (const key of [...new Set(game.slots.map((slot) => slot.card.pairKey))]) {
			const [a, b] = game.slots.flatMap((slot, i) => (slot.card.pairKey === key ? [i] : []));
			game.flip(a);
			game.flip(b);
		}
		expect(game.takenPairs).toBe(10);
		expect(game.gameOver, 'партія на десять пар мусить завершитися на десятій').toBe(true);
	});

	/**
	 * РЕКОРДОМ тут вважаються пари ГРАВЦЯ ЗА ЦИМ ПРИСТРОЄМ, а не всі зібрані.
	 *
	 * За одним пристроєм грають удвох, і зарахувати собі чужі пари означало б
	 * рекорд, якого людина не робила. Та сама межа, що на наскрізному рахунку.
	 */
	it('кінець партії записує рекорд — і лише свої пари', () => {
		const game = new MemoryGameController();
		game.start({
			seed: 4,
			pairs: 10,
			players: [
				{ id: 'a', nameKey: 'memory.you', score: 0, local: true },
				{ id: 'b', nameKey: 'memory.rival', score: 0, local: false }
			]
		});

		for (const key of [...new Set(game.slots.map((slot) => slot.card.pairKey))]) {
			const [a, b] = game.slots.flatMap((slot, i) => (slot.card.pairKey === key ? [i] : []));
			game.flip(a);
			game.flip(b);
		}

		expect(game.gameOver).toBe(true);
		expect(playerMock.finishGame).toHaveBeenCalledTimes(1);
		// Саме `localScore`, а не `takenPairs`: у цій партії всі збіги дістав
		// гравець за цим пристроєм (збіг не передає хід), тож числа тут рівні —
		// різниця видна в партії з промахами, і охороняє її сам виклик.
		expect(playerMock.finishGame).toHaveBeenCalledWith('memory', game.localScore);
	});

	it('соло-партія — це список із одного гравця', () => {
		const game = started();
		expect(game.players).toHaveLength(1);
		expect(game.current.local).toBe(true);
	});

	it('збіг забирається одразу й хід лишається за гравцем', () => {
		const game = started();
		const [first, second] = pairIndexes(game);

		game.flip(first);
		game.flip(second);

		expect(game.slots[first].takenBy).toBe(game.players[0].id);
		expect(game.slots[second].takenBy).toBe(game.players[0].id);
		expect(game.players[0].score).toBe(1);
		expect(game.awaitingPeek, 'ховати нема чого').toBe(false);
		expect(game.currentPlayerIndex, 'вгадав — ходить далі').toBe(0);
		expect(playerMock.addScore).toHaveBeenCalledWith(1);
	});

	it('промах лишає картки відкритими, доки не приберуть', () => {
		const game = started();
		const [a, b] = mismatchIndexes(game);

		game.flip(a);
		game.flip(b);

		expect(game.awaitingPeek).toBe(true);
		expect(game.slots[a].faceUp && game.slots[b].faceUp, 'обидві видно').toBe(true);
		expect(game.moves).toBe(1);

		game.resolvePeek();

		expect(game.slots[a].faceUp || game.slots[b].faceUp, 'обидві закрилися').toBe(false);
		expect(game.awaitingPeek).toBe(false);
	});

	/**
	 * Дошка не блокується на час паузи: гравець, який уже все запам'ятав, не
	 * мусить чекати таймера. Пауза лишається тим, хто хоче роздивитися.
	 */
	it('третя картка гортає невдалу пару одразу й починає новий хід', () => {
		const game = started();
		const [a, b] = mismatchIndexes(game);
		game.flip(a);
		game.flip(b);
		expect(game.awaitingPeek).toBe(true);

		const third = game.slots.findIndex((slot, i) => i !== a && i !== b && !slot.faceUp);
		expect(game.flip(third), 'хід прийнято, а не відхилено').toBe(true);

		expect(game.slots[a].faceUp || game.slots[b].faceUp, 'попередні закрилися').toBe(false);
		expect(game.slots[third].faceUp, 'нова відкрилася').toBe(true);
		expect(game.awaitingPeek, 'лежить одна, а не дві').toBe(false);
	});

	it('клік по вже відкритій картці нічого не гортає', () => {
		const game = started();
		const [a, b] = mismatchIndexes(game);
		game.flip(a);
		game.flip(b);

		expect(game.flip(a), 'по собі ж — не хід').toBe(false);
		expect(game.slots[a].faceUp && game.slots[b].faceUp, 'обидві лишилися видимі').toBe(true);
		expect(game.awaitingPeek).toBe(true);
	});

	it('пара, зібрана третім кліком, зараховується тому, чий тепер хід', () => {
		const game = new MemoryGameController();
		game.start({
			seed: 11,
			players: [
				{ id: 'a', nameKey: 'memory.you', score: 0, local: true },
				{ id: 'b', nameKey: 'memory.rival', score: 0, local: false }
			]
		});

		const [x, y] = mismatchIndexes(game);
		game.flip(x);
		game.flip(y);

		// Третій клік гортає промах — і хід переходить ДО того, як карту відкрито.
		const [p, q] = pairIndexes(game, 2);
		game.flip(p);
		game.flip(q);

		expect(game.currentPlayerIndex).toBe(1);
		expect(game.players[1].score, 'пара дісталася другому гравцеві').toBe(1);
		expect(game.players[0].score).toBe(0);
	});

	it('та сама картка двічі — це не хід', () => {
		const game = started();
		const [first] = pairIndexes(game);
		expect(game.flip(first)).toBe(true);
		expect(game.flip(first), 'повторний клік нічого не робить').toBe(false);
		expect(game.moves).toBe(0);
	});

	it('уже забрану картку не перевернути', () => {
		const game = started();
		const [first, second] = pairIndexes(game);
		game.flip(first);
		game.flip(second);
		expect(game.flip(first)).toBe(false);
	});

	/**
	 * Черга й окремі рахунки існують уже зараз, хоча грає один: дописати їх
	 * потім означало б переписати правила, а не доповнити.
	 */
	it('у спільній партії промах передає хід, а збіг — ні', () => {
		const game = new MemoryGameController();
		game.start({
			/*
			 * Зерно вибране так, щоб починав ЛОКАЛЬНИЙ гравець, і це не підгонка під
			 * зелений колір. Перший хід тепер виводиться із зерна (прохання автора:
			 * «перший ходить випадковий гравець»), а останній рядок цього пункту питає
			 * саме про локального: чужі очки не йдуть у загальний рахунок сайту. На
			 * зерні, де починає суперник, промах передав би хід локальному — і пункт
			 * перевіряв би протилежне до того, для чого написаний.
			 *
			 * Сам вибір першого ходу перевіряє `pairsMatch.svelte.test.ts`: там він і
			 * має значення, бо там двоє клієнтів.
			 */
			seed: 6,
			players: [
				{ id: 'a', nameKey: 'memory.you', score: 0, local: true },
				{ id: 'b', nameKey: 'memory.rival', score: 0, local: false }
			]
		});

		const [x, y] = mismatchIndexes(game);
		game.flip(x);
		game.flip(y);
		game.resolvePeek();
		expect(game.currentPlayerIndex, 'промах — хід переходить').toBe(1);

		const [p, q] = pairIndexes(game, 2);
		game.flip(p);
		game.flip(q);
		expect(game.currentPlayerIndex, 'збіг — хід лишається').toBe(1);
		expect(game.players[1].score).toBe(1);
		expect(playerMock.addScore, 'чужі очки в загальний рахунок не йдуть').not.toHaveBeenCalled();
	});

	it('партія завершується, коли зібрано всі пари', () => {
		const game = started();
		const keys = [...new Set(game.slots.map((slot) => slot.card.pairKey))];
		for (const key of keys) {
			const [a, b] = game.slots.flatMap((slot, i) => (slot.card.pairKey === key ? [i] : []));
			game.flip(a);
			game.flip(b);
		}
		expect(game.takenPairs).toBe(MEMORY_PAIRS);
		expect(game.gameOver).toBe(true);
		expect(game.localScore).toBe(MEMORY_PAIRS);
	});

	it('після кінця партії ходи не приймаються', () => {
		const game = started();
		const keys = [...new Set(game.slots.map((slot) => slot.card.pairKey))];
		for (const key of keys) {
			const [a, b] = game.slots.flatMap((slot, i) => (slot.card.pairKey === key ? [i] : []));
			game.flip(a);
			game.flip(b);
		}
		expect(game.flip(0)).toBe(false);
	});
});
