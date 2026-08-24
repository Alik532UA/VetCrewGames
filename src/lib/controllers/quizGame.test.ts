import { describe, expect, it, vi } from 'vitest';
import { ONLINE_GAMES } from '$lib/config/quizOnline';

/*
 * Налаштування підмінені, як і в решті тестів контролерів: справжній синглтон у
 * конструкторі питає `window.matchMedia`, якого в jsdom немає.
 */
vi.mock('$lib/services/settings.svelte', () => ({
	settings: { addScore: vi.fn(), locale: 'uk' }
}));

const { createQuizGame, startQuizGame, POPULATION_SLOTS, ROUNDS_PER_STEP } =
	await import('./quizGame');

/**
 * МІСЦЕ ВИКЛИКУ, А НЕ КОНТРОЛЕР.
 *
 * `quizSeed.test.ts` доводить, що кожна гра детермінована за зерном — і
 * конструює їх правильно. Саме тому він і не побачив, що дошка кімнати
 * конструювала «Хто численніший?» з переставленими аргументами: перевірялися
 * контролери, а місце, яке їх створює, не перевірялося взагалі.
 *
 * Тут навпаки: усе йде через `createQuizGame()`, тобто через той самий шлях, що
 * в кімнаті. Помилка в аргументах будь-якої гри валить цей файл.
 */

/** Що саме роздали — рядком, щоб два прогони можна було просто порівняти. */
function dealt(gameId: string, seed: number): string {
	const created = createQuizGame({ game: gameId, seed });
	if (created === null) return 'null';
	startQuizGame(created);

	switch (created.kind) {
		case 'myths':
			return created.game.current?.id ?? 'none';
		case 'feeding':
			return created.game.round?.id ?? 'none';
		case 'habitat':
			return created.game.round?.animal.id ?? 'none';
		case 'family':
			return created.game.round?.id ?? 'none';
		case 'population':
			// Її роздає дошка, не фабрика — тут дошку заміщає цей рядок.
			created.game.startRound();
			return created.game.sourceAnimals.map((animal) => animal?.id).join('+');
	}
}

const SEED = 20260824;
const OTHER_SEED = 777001;
const IDS = ONLINE_GAMES.map((game) => game.id);

describe('гра одного раунду вікторини', () => {
	it('перевірка жива: набір ігор кімнати не порожній', () => {
		expect(IDS.length).toBeGreaterThanOrEqual(6);
	});

	it.each(IDS)('%s: гра набору справді створюється', (id) => {
		expect(createQuizGame({ game: id, seed: SEED }), 'гра з набору без контролера').not.toBeNull();
	});

	/**
	 * ГОЛОВНИЙ інваріант: те саме зерно — та сама дошка.
	 *
	 * Незакріплене зерно означає `Math.random()` усередині контролера, тобто
	 * різні тварини в двох гравців однієї кімнати. Саме це й було в «Хто
	 * численніший?»: зерно потрапляло в аргумент `totalRounds`, а до самого
	 * генератора не доходило.
	 */
	it.each(IDS)('%s: два створення з одним зерном дають ту саму дошку', (id) => {
		const first = dealt(id, SEED);
		expect(first).not.toBe('none');
		expect(dealt(id, SEED)).toBe(first);
	});

	it.each(IDS)('%s: інше зерно дає іншу дошку', (id) => {
		/*
		 * Перевірка ЖИВА: без неї «детермінізм» проходив би й на функції, яка
		 * завжди віддає те саме. Один набір збігів на різних зернах можливий
		 * випадково, тож порівнюються два різні зерна на різницю хоч в одній грі —
		 * а не на різницю в кожній.
		 */
		const seeded = dealt(id, SEED);
		const other = dealt(id, OTHER_SEED);
		expect([seeded, other].every((value) => value !== 'none')).toBe(true);
	});

	it('різні зерна дають різні дошки хоч у більшості ігор', () => {
		const changed = IDS.filter((id) => dealt(id, SEED) !== dealt(id, OTHER_SEED));
		expect(changed.length, `зерно не впливає ні на що: ${IDS.join(', ')}`).toBeGreaterThan(
			IDS.length / 2
		);
	});

	/** Той самий дефект, тільки з боку розкладу: одна картка замість трьох. */
	it('«Хто численніший?» роздає три картки, а не одну', () => {
		const created = createQuizGame({ game: 'population', seed: SEED });
		expect(created?.kind).toBe('population');
		if (created?.kind !== 'population') return;
		created.game.startRound();
		expect(created.game.slotCount).toBe(POPULATION_SLOTS);
		expect(created.game.sourceAnimals).toHaveLength(POPULATION_SLOTS);
	});

	/**
	 * І з боку кількості раундів: `totalRounds` з переставлених аргументів ставав
	 * зерном, тобто раунд не закінчувався ніколи й відповідь не зараховувалась.
	 */
	it.each(IDS)('%s: у кроці рівно один раунд', (id) => {
		const created = createQuizGame({ game: id, seed: SEED });
		expect(created?.game.totalRounds).toBe(ROUNDS_PER_STEP);
	});

	it('гра з новішої збірки віддає `null`, а не падає', () => {
		expect(createQuizGame({ game: 'game-from-the-future', seed: SEED })).toBeNull();
	});
});
