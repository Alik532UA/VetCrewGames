import { beforeEach, describe, expect, it, vi } from 'vitest';
import { animals } from '$lib/config/population-game';
import { buildDeck, MEMORY_PAIRS } from '$lib/config/memory-game';

const settingsMock = { addScore: vi.fn() };
vi.mock('$lib/services/settings.svelte', () => ({ settings: settingsMock }));

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
		expect([...counts.values()].every((n) => n === 2), 'кожна двічі').toBe(true);
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
		const ids = (seed: number) => buildDeck(seed).map((card) => card.id).join(',');
		expect(ids(42)).toBe(ids(42));
		expect(ids(42)).not.toBe(ids(43));
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

describe('MemoryGameController', () => {
	beforeEach(() => settingsMock.addScore.mockReset());

	const started = (seed = 1) => {
		const game = new MemoryGameController();
		game.start(seed);
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
		expect(settingsMock.addScore).toHaveBeenCalledWith(1);
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

	it('третю картку не відкрити, доки лежать дві', () => {
		const game = started();
		const [a, b] = mismatchIndexes(game);
		game.flip(a);
		game.flip(b);

		const third = game.slots.findIndex((slot, i) => i !== a && i !== b && !slot.faceUp);
		expect(game.flip(third), 'хід відхилено').toBe(false);
		expect(game.slots[third].faceUp).toBe(false);
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
		game.start(3, [
			{ id: 'a', nameKey: 'memory.you', score: 0, local: true },
			{ id: 'b', nameKey: 'memory.rival', score: 0, local: false }
		]);

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
		expect(
			settingsMock.addScore,
			'чужі очки в загальний рахунок не йдуть'
		).not.toHaveBeenCalled();
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
