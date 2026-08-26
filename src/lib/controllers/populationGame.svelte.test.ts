import { beforeEach, describe, expect, it, vi } from 'vitest';
import { maxSessionPoints, PERFECT_BONUS } from '$lib/config/scoring';
import type { Animal } from '$lib/config/population-game';

/**
 * Правила дошки до цього не перевірялися нічим: вони жили в `+page.svelte`
 * упереміш із обробниками `DragEvent` і `TouchEvent`, тобто дістатися до них
 * без браузера було неможливо (CODE-QUALITY-v8 § 3.1).
 *
 * Найцінніше тут — обмін місцями. У ньому чотири напрямки (ряд↔ряд, ряд↔дошка,
 * дошка↔ряд, дошка↔дошка), кожен зі своїм рядком коду, і жоден із них не видно
 * оком у розмітці.
 */

/*
 * Рахунок і рекорди живуть у `playerData`, і мокається саме він: доти тут
 * стояв мок `settings`, бо рахунок був полем налаштувань. Переїзд перевіряти
 * тут нічого — важливо, що контролер кличе `addScore` і `finishGame` рівно
 * тоді, коли треба.
 */
const playerMock = { addScore: vi.fn(), finishGame: vi.fn() };
vi.mock('$lib/services/playerData.svelte', () => ({ playerData: playerMock }));

/** Детермінований розклад: інакше тест перевіряв би `Math.random`. */
const DECK: Animal[] = [
	{ id: 'ant', nameKey: 'animal.ant', population: 300, factKey: 'fact.ant', image: 'ant.webp' },
	{ id: 'bee', nameKey: 'animal.bee', population: 200, factKey: 'fact.bee', image: 'bee.webp' },
	{ id: 'cat', nameKey: 'animal.cat', population: 100, factKey: 'fact.cat', image: 'cat.webp' }
];
vi.mock('$lib/config/population-game', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/config/population-game')>()),
	getRandomAnimals: (count: number) => DECK.slice(0, count)
}));

const { PopulationGameController } = await import('./populationGame.svelte');

/** Компактний знімок дошки: `null` → `.` */
const board = (list: (Animal | null)[]) => list.map((a) => a?.id ?? '.').join(',');

function started(slotCount = 3, totalRounds = 10) {
	const game = new PopulationGameController(slotCount, totalRounds);
	game.startRound();
	return game;
}

describe('PopulationGameController', () => {
	beforeEach(() => {
		playerMock.addScore.mockReset();
		playerMock.finishGame.mockReset();
	});

	it('startRound() роздає картки й рахує правильний порядок за зростанням', () => {
		const game = started();

		expect(board(game.sourceAnimals)).toBe('ant,bee,cat');
		expect(board(game.slots)).toBe('.,.,.');
		expect(
			game.correctOrder.map((a) => a.id),
			'від найменшої популяції'
		).toEqual(['cat', 'bee', 'ant']);
		expect(game.checked).toBe(false);
	});

	it('картка з ряду переїжджає в порожню комірку і зникає з ряду', () => {
		const game = started();

		game.select(DECK[0], { type: 'source', index: 0 });
		expect(game.dropOnSlot(1)).toBe(true);

		expect(board(game.slots)).toBe('.,ant,.');
		expect(board(game.sourceAnimals), 'місце в ряду має спорожніти').toBe('.,bee,cat');
		expect(game.picked, 'після ходу вибір знімається').toBeNull();
	});

	it('обмін: у зайняту комірку — попередня картка їде туди, звідки прийшла нова', () => {
		const game = started();
		game.select(DECK[0], { type: 'source', index: 0 });
		game.dropOnSlot(0);

		game.select(DECK[1], { type: 'source', index: 1 });
		game.dropOnSlot(0);

		expect(board(game.slots)).toBe('bee,.,.');
		expect(board(game.sourceAnimals), 'ant повернувся на місце bee').toBe('.,ant,cat');
		expect(game.isSwapping, 'анімація має знати, що це був обмін').toBe(true);
	});

	it('обмін двох карток усередині дошки', () => {
		const game = started();
		game.select(DECK[0], { type: 'source', index: 0 });
		game.dropOnSlot(0);
		game.select(DECK[1], { type: 'source', index: 1 });
		game.dropOnSlot(2);

		game.select(DECK[0], { type: 'slot', index: 0 });
		game.dropOnSlot(2);

		expect(board(game.slots)).toBe('bee,.,ant');
	});

	it('клік по вже вибраній картці знімає вибір, а не робить хід', () => {
		const game = started();

		game.select(DECK[0], { type: 'source', index: 0 });
		expect(game.picked?.id).toBe('ant');

		expect(game.select(DECK[0], { type: 'source', index: 0 })).toBe(false);
		expect(game.picked).toBeNull();
		expect(board(game.slots), 'дошка не мала змінитися').toBe('.,.,.');
	});

	it('подвійний клік із ряду кладе картку в першу вільну комірку', () => {
		const game = started();

		game.sendToFreeSpot(DECK[1], { type: 'source', index: 1 });

		expect(board(game.slots)).toBe('bee,.,.');
		expect(board(game.sourceAnimals)).toBe('ant,.,cat');
	});

	it('подвійний клік із дошки повертає картку на її РІДНЕ місце в ряду', () => {
		const game = started();
		game.select(DECK[2], { type: 'source', index: 2 });
		game.dropOnSlot(0);
		expect(board(game.sourceAnimals)).toBe('ant,bee,.');

		game.sendToFreeSpot(DECK[2], { type: 'slot', index: 0 });

		expect(board(game.sourceAnimals), 'cat мав повернутися саме в третю позицію').toBe(
			'ant,bee,cat'
		);
		expect(board(game.slots)).toBe('.,.,.');
	});

	it('правильний порядок дає очко за кожну позицію і статус correct', () => {
		const game = started();
		game.moveTo(DECK[2], 'slot', 0); // cat — 100
		game.moveTo(DECK[1], 'slot', 1); // bee — 200
		game.moveTo(DECK[0], 'slot', 2); // ant — 300

		expect(game.allSlotsFilled).toBe(true);
		game.check();

		expect(game.slotResults).toEqual([true, true, true]);
		// Повний ряд дістає надбавку понад очко за слот (config/scoring.ts).
		expect(game.sessionScore).toBe(3 + PERFECT_BONUS);
		expect(playerMock.addScore).toHaveBeenCalledWith(3 + PERFECT_BONUS);
		expect(game.roundResults).toEqual(['correct']);
	});

	it('частково правильний порядок дає статус partial і очки лише за влучання', () => {
		const game = started();
		game.moveTo(DECK[2], 'slot', 0); // cat — на місці
		game.moveTo(DECK[0], 'slot', 1); // ant — не на місці
		game.moveTo(DECK[1], 'slot', 2); // bee — не на місці

		game.check();

		expect(game.slotResults).toEqual([true, false, false]);
		expect(game.sessionScore).toBe(1);
		expect(game.roundResults).toEqual(['partial']);
	});

	it('після перевірки дошка замерзає: ходи більше не приймаються', () => {
		const game = started();
		game.moveTo(DECK[2], 'slot', 0);
		game.moveTo(DECK[1], 'slot', 1);
		game.moveTo(DECK[0], 'slot', 2);
		game.check();
		const frozen = board(game.slots);

		game.select(DECK[0], { type: 'slot', index: 2 });
		game.dropOnSlot(0);
		game.sendToFreeSpot(DECK[0], { type: 'slot', index: 2 });
		game.moveTo(DECK[0], 'source', 0);
		game.check();

		expect(board(game.slots)).toBe(frozen);
		expect(game.sessionScore, 'повторна перевірка не має нараховувати вдруге').toBe(
			3 + PERFECT_BONUS
		);
		expect(game.roundResults).toHaveLength(1);
	});

	it('nextRound() роздає новий раунд, а після останнього завершує гру', () => {
		const game = started(3, 2);
		game.moveTo(DECK[0], 'slot', 0);

		game.nextRound();
		expect(game.roundNumber).toBe(2);
		expect(board(game.slots), 'новий раунд починається з порожньої дошки').toBe('.,.,.');

		game.nextRound();
		expect(game.gameOver).toBe(true);
	});

	/**
	 * РЕКОРД ГРИ пишеться в кінці партії, і рівно один раз.
	 *
	 * Це те, чого доти не існувало зовсім: у хмару їхав лише наскрізний рахунок,
	 * тобто «скільки всього», без жодного «скільки за одну партію». Двічі
	 * записаний рекорд зіпсував би `plays` — число партій, яких не було.
	 */
	it('кінець партії записує рекорд гри — один раз', () => {
		const game = started(3, 1);
		game.moveTo(DECK[0], 'slot', 0);
		game.check();

		game.nextRound();
		game.nextRound();

		expect(playerMock.finishGame).toHaveBeenCalledTimes(1);
		expect(playerMock.finishGame).toHaveBeenCalledWith('population', game.sessionScore);
	});

	/**
	 * Максимум — З ПРАВИЛА РАХУНКУ, а не з числа слотів.
	 *
	 * Попередня редакція цього тесту стверджувала `30` для трьох слотів і десяти
	 * раундів — і кодувала помилку: раунд без жодної хиби дає ще й `PERFECT_BONUS`,
	 * тобто 3 + 1 = 4, а не 3. Екран підсумку через це показував знаменник, менший
	 * за досяжний максимум, і зелений тест це підтверджував.
	 *
	 * Тепер очікуване значення НЕ вписане цифрою: воно береться з того самого
	 * `maxSessionPoints`, що й у контролері. Тест не повторює реалізацію — він
	 * стверджує, що контролер бере число саме звідти, а не з власної арифметики.
	 */
	it('maxScore приходить із правила рахунку, а не з числа слотів', () => {
		expect(started(3, 10).maxScore).toBe(maxSessionPoints(3, 10));
		expect(started(4, 5).maxScore).toBe(maxSessionPoints(4, 5));
		// І це справді більше за «по очку за слот»: різниця — надбавка за раунд.
		expect(started(3, 10).maxScore).toBeGreaterThan(3 * 10);
	});

	/**
	 * ГОЛОВНА перевірка цього блока, і саме її просив автор: «якщо на всі
	 * відповіді дати правильну — чи збігається число?»
	 *
	 * Формула може бути правильною сама собою й усе одно не дорівнювати тому, що
	 * реально можна набрати: досить, щоб раунд нараховував очки інакше. Тому тут
	 * грається БЕЗДОГАННА партія, і рахунок мусить зійтися з максимумом до одиниці.
	 */
	it('бездоганна партія набирає РІВНО максимум', () => {
		const game = started(3, 4);

		for (let round = 1; round <= 4; round += 1) {
			// Розкладаємо в правильному порядку — його контролер знає сам.
			for (const [index, animal] of game.correctOrder.entries()) {
				game.moveTo(animal, 'slot', index);
			}
			game.check();
			game.nextRound();
		}

		expect(game.gameOver).toBe(true);
		expect(game.sessionScore).toBe(game.maxScore);
	});

	/**
	 * ЧАС ВИЙШОВ — ЗАРАХУЙ ТЕ, ЩО СТОЇТЬ.
	 *
	 * Скарга автора про онлайн-вікторину: «фіксується відповідь, що була на момент
	 * закінчення таймера, тобто кінець таймера замість гравця натискає кнопку
	 * „ПЕРЕВІРИТИ“ — щоб гравець, який відповів, але забув чи не встиг натиснути,
	 * отримав бали за поточну свою відповідь».
	 *
	 * Тут перевіряється рівно та частина, що живе в правилах: `force`. Обидві
	 * половини обовʼязкові — дозвіл мусить діяти, і мусить лишатися ЯВНИМ, бо кнопка
	 * на дошці має бути вимкненою, доки ряд не повний.
	 *
	 * Зворотні експерименти (AI-AGENT-PITFALLS-v8 § 1.1): умову `!force` прибрано —
	 * червоніє «без дозволу недороблений ряд не зараховується»; `force` знято з
	 * умови зовсім — червоніє «з дозволом зараховується те, що стоїть». Обидва
	 * зроблені.
	 */
	describe('час вийшов', () => {
		it('з дозволом зараховується те, що стоїть', () => {
			const game = started(3, 1);
			// Дві картки з трьох, і саме на своїх місцях: `correctOrder` — від більшої.
			game.moveTo(game.correctOrder[0], 'slot', 0);
			game.moveTo(game.correctOrder[1], 'slot', 1);

			game.check(true);

			expect(game.checked, 'ряд не зарахований').toBe(true);
			expect(game.roundResults, 'дві з трьох — це не «нічого»').toEqual(['partial']);
			expect(game.sessionScore, 'бали за те, що гравець знав, не нараховано').toBeGreaterThan(0);
		});

		it('без дозволу недороблений ряд не зараховується', () => {
			// Умова існує для людини: випадковий дотик не мусить витрачати раунд.
			const game = started(3, 1);
			game.moveTo(game.correctOrder[0], 'slot', 0);

			game.check();

			expect(game.checked).toBe(false);
			expect(game.roundResults).toEqual([]);
		});

		it('порожній ряд із дозволом дає нуль, а не вигадані бали', () => {
			const game = started(3, 1);
			game.check(true);
			expect(game.roundResults).toEqual(['incorrect']);
			expect(game.sessionScore).toBe(0);
		});
	});

	it('reset() повертає партію на початок', () => {
		const game = started(3, 1);
		game.moveTo(DECK[0], 'slot', 0);
		game.nextRound();
		expect(game.gameOver).toBe(true);

		game.reset();

		expect(game.roundNumber).toBe(1);
		expect(game.sessionScore).toBe(0);
		expect(game.roundResults).toEqual([]);
		expect(game.gameOver).toBe(false);
		expect(board(game.slots)).toBe('.,.,.');
	});
});
