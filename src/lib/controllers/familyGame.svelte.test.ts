import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BINARY_POINTS } from '$lib/config/scoring';
import { animals } from '$lib/config/population-game';
import { buildRound, familyPuzzles } from '$lib/config/family-game';
import { uk } from '$lib/i18n/translations/uk';

const settingsMock = { addScore: vi.fn() };
vi.mock('$lib/services/settings.svelte', () => ({ settings: settingsMock }));

const { FamilyGameController } = await import('./familyGame.svelte');

/**
 * Дані цієї гри перевіряються нарівні з логікою, і це не педантизм: набір, що
 * посилається на неіснуючу тварину, дав би картку без зображення й без назви,
 * а набір із двома однаковими тваринами — питання без відповіді. Ні те, ні те
 * не впало б ні на збірці, ні на типах.
 */
describe('набори «Хто з іншої родини?»', () => {
	const ids = new Set(animals.map((animal) => animal.id));

	it('перевірка жива: набори знайдено', () => {
		expect(familyPuzzles.length).toBeGreaterThan(3);
	});

	it('кожна тварина набору є в каталозі', () => {
		const missing = familyPuzzles.flatMap((puzzle) =>
			[...puzzle.groupIds, puzzle.oddId]
				.filter((id) => !ids.has(id))
				.map((id) => `${puzzle.id}: ${id}`)
		);
		expect(missing, `тварин немає в population-game.ts:\n${missing.join('\n')}`).toEqual([]);
	});

	it('у наборі чотири РІЗНІ тварини', () => {
		const bad = familyPuzzles
			.filter((puzzle) => new Set([...puzzle.groupIds, puzzle.oddId]).size !== 4)
			.map((puzzle) => puzzle.id);
		expect(bad, `дублікати всередині набору: ${bad.join(', ')}`).toEqual([]);
	});

	it('id наборів унікальні — інакше «показані» рахувалися б не ті', () => {
		const seen = familyPuzzles.map((puzzle) => puzzle.id);
		expect(new Set(seen).size).toBe(seen.length);
	});

	it('кожне пояснення існує у словнику', () => {
		const missing = familyPuzzles
			.filter((puzzle) => !(puzzle.explanationKey in uk))
			.map((puzzle) => puzzle.explanationKey);
		expect(missing, `ключів немає в перекладах: ${missing.join(', ')}`).toEqual([]);
	});

	it('buildRound() віддає чотири картки й правильну відповідь серед них', () => {
		// Порядок карток тут не перевіряється, перевіряється склад.
		const round = buildRound(familyPuzzles[0], Math.random);
		expect(round).not.toBeNull();
		expect(round!.cards).toHaveLength(4);
		expect(round!.cards.map((c) => c.id)).toContain(round!.oddAnimal.id);
	});

	it('buildRound() повертає null на невідомій тварині, а не картку-привида', () => {
		const round = buildRound(
			{
				id: 'broken',
				groupIds: ['cat', 'tiger', 'leopard'],
				oddId: 'дракон',
				explanationKey: 'family.felids.explanation'
			},
			Math.random
		);
		expect(round).toBeNull();
	});
});

describe('FamilyGameController', () => {
	beforeEach(() => settingsMock.addScore.mockReset());

	const odd = (game: InstanceType<typeof FamilyGameController>) => game.round!.oddAnimal;
	const notOdd = (game: InstanceType<typeof FamilyGameController>) =>
		game.round!.cards.find((c) => c.id !== game.round!.oddAnimal.id)!;

	it('start() дає раунд із чотирьох карток', () => {
		const game = new FamilyGameController();
		game.start();

		expect(game.round).not.toBeNull();
		expect(game.round!.cards).toHaveLength(4);
		expect(game.answered, 'до кліку відповіді немає').toBe(false);
	});

	it('правильний клік дає очко, неправильний — ні', () => {
		const game = new FamilyGameController();
		game.start();

		game.choose(odd(game));
		expect(game.isCorrect).toBe(true);
		expect(game.sessionScore).toBe(BINARY_POINTS);
		expect(settingsMock.addScore).toHaveBeenCalledWith(BINARY_POINTS);
		expect(game.roundResults).toEqual(['correct']);

		game.nextRound();
		game.choose(notOdd(game));
		expect(game.isCorrect).toBe(false);
		expect(game.sessionScore, 'помилка не додає очок').toBe(BINARY_POINTS);
		expect(game.roundResults).toEqual(['correct', 'incorrect']);
	});

	it('після відповіді дошка завмирає: другий клік нічого не змінює', () => {
		const game = new FamilyGameController();
		game.start();

		const first = notOdd(game);
		game.choose(first);
		game.choose(odd(game));

		expect(game.chosen!.id, 'вибір мав лишитися першим').toBe(first.id);
		expect(game.sessionScore).toBe(0);
		expect(game.roundResults).toHaveLength(1);
	});

	it('набори не повторюються в межах партії', () => {
		const game = new FamilyGameController(5);
		game.start();

		const seen = [game.round!.id];
		for (let i = 1; i < 5; i++) {
			game.nextRound();
			seen.push(game.round!.id);
		}
		expect(new Set(seen).size, `повтор набору: ${seen.join(', ')}`).toBe(seen.length);
	});

	it('перехід до наступного раунду знімає попередню відповідь', () => {
		const game = new FamilyGameController();
		game.start();
		game.choose(odd(game));
		expect(game.answered).toBe(true);

		game.nextRound();

		expect(game.answered, 'нова картка не має бути вже відповіданою').toBe(false);
		expect(game.chosen).toBeNull();
	});

	it('після останнього раунду гра завершується без картки на екрані', () => {
		const game = new FamilyGameController(2);
		game.start();
		game.nextRound();
		expect(game.gameOver).toBe(false);

		game.nextRound();

		expect(game.gameOver).toBe(true);
		expect(game.round).toBeNull();
	});

	/**
	 * Наборів менше, ніж максимальна кількість раундів. Показувати той самий
	 * набір удруге не можна — гравець уже знає відповідь, — тож партія має
	 * завершитися достроково, а не зациклитися й не показати порожній екран.
	 */
	it('коли набори вичерпано, партія завершується, а не зациклюється', () => {
		const game = new FamilyGameController(familyPuzzles.length + 5);
		game.start();

		for (let i = 0; i < familyPuzzles.length + 4; i++) game.nextRound();

		expect(game.gameOver).toBe(true);
		expect(game.round).toBeNull();
	});

	it('reset() повертає партію на початок', () => {
		const game = new FamilyGameController(2);
		game.start();
		game.choose(odd(game));
		game.nextRound();
		game.nextRound();
		expect(game.gameOver).toBe(true);

		game.reset();

		expect(game.roundNumber).toBe(1);
		expect(game.sessionScore).toBe(0);
		expect(game.roundResults).toEqual([]);
		expect(game.gameOver).toBe(false);
		expect(game.round).not.toBeNull();
	});
});
