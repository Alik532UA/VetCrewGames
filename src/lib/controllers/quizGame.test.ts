import { describe, expect, it, vi } from 'vitest';
import { ONLINE_GAMES, quizProgramme } from '$lib/config/quizOnline';

/*
 * Налаштування підмінені, як і в решті тестів контролерів: справжній синглтон у
 * конструкторі питає `window.matchMedia`, якого в jsdom немає.
 */
vi.mock('$lib/services/settings.svelte', () => ({
	settings: { addScore: vi.fn(), locale: 'uk' }
}));

const {
	createQuizGame,
	startQuizGame,
	settledFamily,
	settledFeeding,
	settledHabitat,
	settledPopulation,
	settledQuestion,
	POPULATION_SLOTS,
	ROUNDS_PER_STEP
} = await import('./quizGame');

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
function dealt(gameId: string, seed: number, pick?: string): string {
	const created = createQuizGame({ game: gameId, seed, pick });
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

/**
 * ПИТАННЯ З КОЛОДИ КІМНАТИ (прохання автора 2026-09-26, `utils/quizDeck.ts`): крок
 * програми тепер несе, ЯКЕ САМЕ питання, і кожна з шести ігор мусить узяти саме
 * його — інакше колода вибирала б без повторів, а гра однаково тягнула б сама.
 *
 * Зворотний експеримент: не передати `step.pick` у будь-який контролер — червоніє
 * його гра.
 */
describe('питання з колоди кімнати', () => {
	it.each(IDS)('%s: крок із вибраним питанням дає саме його', (id) => {
		const [step] = quizProgramme(SEED, [id], 1);
		expect(step.pick, 'перевірка жива: колода вибрала питання').toBeTruthy();
		expect(dealt(id, step.seed, step.pick)).toBe((step.pick as string).split(',').join('+'));
	});

	it.each(IDS)('%s: невідоме цим даним питання — гра вибирає сама й не падає', (id) => {
		expect(dealt(id, SEED, 'nobody,knows,this')).toBe(dealt(id, SEED));
	});
});

/**
 * РОЗБІР НА ТАБЛІ МІЖ РАУНДАМИ (прохання автора 2026-09-28: «між раундами оновлений рахунок,
 * а нижче пояснення відповідей минулого раунду»).
 *
 * Два стани, і другий головний: гравець відповів — розбір показує ЙОГО відповідь; не встиг —
 * правильну, але без оцінки й без «ви дали смітнику» про страву, якої він не чіпав.
 */
describe('розбір раунду, що скінчився', () => {
	/** Перший раунд гри за зерном — той самий шлях, що в кімнаті. */
	function started(gameId: string) {
		const created = createQuizGame({ game: gameId, seed: SEED })!;
		startQuizGame(created);
		if (created.kind === 'population') created.game.startRound();
		return created;
	}

	it('«Правда чи міф?»: без відповіді питання стає розбором, але не «правильним»', () => {
		const created = started('myths');
		if (created.kind !== 'myths') throw new Error('не та гра');
		const question = created.game.current!;
		expect(question.answered, 'перевірка жива: відповіді ще не було').toBe(false);

		const settled = settledQuestion(question);
		expect(settled.answered).toBe(true);
		expect(settled.isCorrect).toBe(false);
		expect(settled.selectedTrue, 'вибору не було — і розбір про нього не вигадує').toBeNull();
	});

	it('«Правда чи міф?»: відповідь гравця лишається його відповіддю', () => {
		const created = started('myths');
		if (created.kind !== 'myths') throw new Error('не та гра');
		created.game.answer(created.game.current!.isTrue);
		const settled = settledQuestion(created.game.current!);
		expect(settled.isCorrect).toBe(true);
		expect(settled.selectedTrue).toBe(created.game.current!.isTrue);
	});

	it('«Хто з іншої родини?»: без вибору — розбір із правильною відповіддю, не «правильно»', () => {
		const created = started('family');
		if (created.kind !== 'family') throw new Error('не та гра');
		const settled = settledFamily(created.game);
		expect(settled.answered).toBe(true);
		expect(settled.chosen).toBeNull();
		expect(settled.isCorrect).toBe(false);
		expect(settled.round, 'розбір про той самий раунд').toBe(created.game.round);
	});

	it('«Де живем?»: розбір перевірений, а вибір — той, що був', () => {
		const created = started('habitat-continents');
		if (created.kind !== 'habitat') throw new Error('не та гра');
		const round = created.game.round!;
		created.game.toggle(round.correct[0]);

		const settled = settledHabitat(created.game);
		expect(settled.checked).toBe(true);
		expect(settled.selected).toEqual([round.correct[0]]);
		expect(settled.outcome).toBe(round.correct.length === 1 ? 'correct' : 'partial');
	});

	it('«Що їмо?»: не нагодував нічого — відповідь-ключ, а не «усе в смітнику»', () => {
		const created = started('feeding');
		if (created.kind !== 'feeding') throw new Error('не та гра');
		expect(created.game.fed, 'перевірка жива: ще не годували').toBe(false);

		const settled = settledFeeding(created.game);
		expect(settled.fed).toBe(true);
		expect(settled.verdicts.length).toBe(created.game.round!.foods.length);
		expect(
			settled.verdicts.every((verdict) => verdict.chosen === verdict.correct),
			'страва без місця не мусить опинятися в смітнику'
		).toBe(true);
	});

	it('«Що їмо?»: нагодував — розбір того, куди поклав гравець', () => {
		const created = started('feeding');
		if (created.kind !== 'feeding') throw new Error('не та гра');
		const round = created.game.round!;
		// Усе — першій тварині: частина страв там не на місці.
		for (const food of round.foods) created.game.moveTo(food, round.animals[0].id);
		created.game.feed();

		const settled = settledFeeding(created.game);
		expect(settled.verdicts.map((verdict) => verdict.chosen)).toEqual(
			round.foods.map(() => round.animals[0].id)
		);
	});

	it('«Кого більше?»: розбір перевірений і з правильним порядком', () => {
		const created = started('population');
		if (created.kind !== 'population') throw new Error('не та гра');
		const settled = settledPopulation(created.game);
		expect(settled.checked).toBe(true);
		expect(settled.correctOrder).toEqual(created.game.correctOrder);
		expect(settled.correctOrder.length).toBe(POPULATION_SLOTS);
	});
});
