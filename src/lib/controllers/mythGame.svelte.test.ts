import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BINARY_POINTS } from '$lib/config/scoring';
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
	setJSON: vi.fn<(key: string, value: unknown) => boolean>(() => true),
	/*
	 * `get`/`set`/`remove` цей контролер не кличе — їх кличе `playerData`, який
	 * тепер стоїть у його графі (рекорд гри пишеться в кінці партії). Порожній мок
	 * замість них означав би `storage.get is not a function` ще на імпорті, тобто
	 * сюїта не збиралася б.
	 */
	get: vi.fn<(key: string) => string | null>(() => null),
	set: vi.fn<(key: string, value: string) => boolean>(() => true),
	remove: vi.fn<(key: string) => void>()
};
/*
 * Рахунок і рекорди живуть у `playerData`, і мокається саме він: доти тут
 * стояв мок `settings`, бо рахунок був полем налаштувань. Переїзд перевіряти
 * тут нічого — важливо, що контролер кличе `addScore` і `finishGame` рівно
 * тоді, коли треба.
 */
const playerMock = { addScore: vi.fn(), finishGame: vi.fn() };

/*
 * ЧАСТКОВИЙ мок, а не повна заміна модуля.
 *
 * Доти тут стояло `() => ({ storage: storageMock })`, тобто модуль сховища
 * підмінявся ЦІЛКОМ — разом із `sessionStore`, якого мок не називав. Поки
 * контролер тягнув лише `storage`, це працювало; щойно в його графі з'явився
 * `logService` (він читає журнал зі `sessionStore`), сюїта перестала навіть
 * збиратися. Помилка при цьому вказувала на `logService`, а не на цей рядок.
 *
 * `importOriginal` лишає модулю всі інші експорти — тобто наступний імпорт у
 * графі не ламає цей тест.
 */
vi.mock('$lib/services/storage', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/services/storage')>()),
	storage: storageMock
}));
vi.mock('$lib/services/playerData.svelte', () => ({ playerData: playerMock }));

const { MythGameController } = await import('./mythGame.svelte');

describe('MythGameController', () => {
	beforeEach(() => {
		storageMock.getJSON.mockReset().mockReturnValue(null);
		storageMock.setJSON.mockReset().mockReturnValue(true);
		playerMock.addScore.mockReset();
		playerMock.finishGame.mockReset();
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

		expect(game.sessionScore).toBe(BINARY_POINTS);
		expect(playerMock.addScore).toHaveBeenCalledWith(BINARY_POINTS);
		expect(game.roundResults).toEqual(['correct']);

		game.nextRound();
		game.answer(!game.current!.isTrue);

		expect(game.sessionScore, 'помилка не має додавати очок').toBe(BINARY_POINTS);
		expect(playerMock.addScore).toHaveBeenCalledTimes(1);
		expect(game.roundResults).toEqual(['correct', 'incorrect']);
	});

	it('повторна відповідь на те саме питання ігнорується', () => {
		const game = new MythGameController();
		game.start();

		game.answer(game.current!.isTrue);
		game.answer(game.current!.isTrue);

		expect(game.sessionScore, 'подвійний клік не має подвоювати рахунок').toBe(BINARY_POINTS);
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
	/**
	 * Бездоганна партія набирає РІВНО максимум.
	 *
	 * Перевіряється не формула, а її збіг із дійсністю: до цієї правки всі п’ять
	 * ігор показували знаменником число раундів, і жоден тест цього не бачив, бо
	 * ніхто не грав партію до кінця правильно.
	 */
	it('бездоганна партія набирає РІВНО максимум', () => {
		const game = new MythGameController(4);
		game.start();
		for (let round = 1; round <= 4; round += 1) {
			game.answer(game.current!.isTrue);
			game.nextRound();
		}
		expect(game.gameOver).toBe(true);
		expect(game.sessionScore).toBe(game.maxScore);
	});
});
