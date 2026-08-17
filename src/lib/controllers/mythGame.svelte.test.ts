import { beforeEach, describe, expect, it, vi } from 'vitest';
import { myths } from '$lib/config/myth-game';

/**
 * Логіка партії тепер тестується без монтування DOM (CODE-QUALITY-v8 § 3.1) —
 * до винесення в контролер вона жила в `+page.svelte` і не перевірялася нічим.
 *
 * Мок сховища, а не справжнє: контролер пише туди перелік показаних питань, і
 * саме цю поведінку треба бачити — не через `localStorage`, а прямо.
 */
const storageMock = {
	getJSON: vi.fn<(key: string) => unknown>(() => null),
	setJSON: vi.fn<(key: string, value: unknown) => boolean>(() => true)
};
const settingsMock = { addScore: vi.fn() };

vi.mock('$lib/services/storage', () => ({ storage: storageMock }));
vi.mock('$lib/services/settings.svelte', () => ({ settings: settingsMock }));

const { MythGameController } = await import('./mythGame.svelte');

describe('MythGameController', () => {
	beforeEach(() => {
		storageMock.getJSON.mockReset().mockReturnValue(null);
		storageMock.setJSON.mockReset().mockReturnValue(true);
		settingsMock.addScore.mockReset();
	});

	it('start() дає перше питання й запамʼятовує його як показане', () => {
		const game = new MythGameController();

		game.start();

		expect(game.current, 'питання не вибрано').not.toBeNull();
		expect(game.roundNumber).toBe(1);
		expect(storageMock.setJSON).toHaveBeenCalledWith('shown_myths', [game.current!.id]);
	});

	it('правильна відповідь піднімає обидва рахунки, неправильна — жодного', () => {
		const game = new MythGameController();
		game.start();

		game.answer(game.current!.isTrue);

		expect(game.sessionScore).toBe(1);
		expect(settingsMock.addScore).toHaveBeenCalledWith(1);
		expect(game.roundResults).toEqual(['correct']);

		game.nextRound();
		game.answer(!game.current!.isTrue);

		expect(game.sessionScore, 'помилка не має додавати очок').toBe(1);
		expect(settingsMock.addScore).toHaveBeenCalledTimes(1);
		expect(game.roundResults).toEqual(['correct', 'incorrect']);
	});

	it('повторна відповідь на те саме питання ігнорується', () => {
		const game = new MythGameController();
		game.start();

		game.answer(game.current!.isTrue);
		game.answer(game.current!.isTrue);

		expect(game.sessionScore, 'подвійний клік не має подвоювати рахунок').toBe(1);
		expect(game.roundResults).toHaveLength(1);
	});

	it('питання не повторюються в межах партії', () => {
		const game = new MythGameController(8);
		game.start();

		const seen = [game.current!.id];
		for (let i = 1; i < 8; i++) {
			game.nextRound();
			seen.push(game.current!.id);
		}

		expect(new Set(seen).size, `повтор у партії: ${seen.join(', ')}`).toBe(seen.length);
	});

	it('після останнього раунду гра завершується без питання на екрані', () => {
		const game = new MythGameController(2);
		game.start();
		game.nextRound();
		expect(game.gameOver).toBe(false);

		game.nextRound();

		expect(game.gameOver).toBe(true);
		expect(game.current, 'екран підсумку не має показувати картку').toBeNull();
	});

	it('reset() повертає партію до початку, зберігаючи памʼять про показані', () => {
		const game = new MythGameController(2);
		game.start();
		game.answer(game.current!.isTrue);
		game.nextRound();
		game.nextRound();
		expect(game.gameOver).toBe(true);

		game.reset();

		expect(game.roundNumber).toBe(1);
		expect(game.sessionScore).toBe(0);
		expect(game.roundResults).toEqual([]);
		expect(game.gameOver).toBe(false);
		expect(game.current, 'після скидання має бути нове питання').not.toBeNull();
	});

	/**
	 * Найтонше місце: колода скінчилася НЕ в цій партії, а взагалі. Тоді памʼять
	 * про попередні сесії скидається, інакше гра мовчки лишилася б без питань —
	 * і гравець побачив би порожній екран без жодної помилки.
	 */
	it('коли всі питання вже показувалися, памʼять про сесії скидається', () => {
		storageMock.getJSON.mockReturnValue(myths.map((m) => m.id));
		const game = new MythGameController();

		game.start();

		expect(game.current, 'колода мала початися з початку').not.toBeNull();
		expect(storageMock.setJSON).toHaveBeenCalledWith('shown_myths', []);
	});
});
