import { describe, expect, it, vi } from 'vitest';
import { LocalRoom } from '$lib/net/localRoom';
import type { Member, RoomInfo } from '$lib/net/roomTypes';
import {
	GAME_FLAG_PREFIX,
	ONLINE_GAMES,
	QUIZ_ROUNDS,
	REVEAL_MS,
	SETTLE_MS,
	answerPoints,
	roundLimitMs,
	configToGames,
	gamesToConfig,
	quizProgramme
} from '$lib/config/quizOnline';

/*
 * Налаштування підмінені, як і в решті тестів контролерів: справжній синглтон у
 * конструкторі питає `window.matchMedia`, якого в jsdom немає.
 */
vi.mock('$lib/services/settings.svelte', () => ({
	settings: { addScore: vi.fn(), locale: 'uk' }
}));

const { QuizMatch } = await import('./quizMatch.svelte');

/**
 * Спільна вікторина — на двох учасниках в одному процесі.
 *
 * Доводиться чотири твердження, і третє з них — головне:
 *
 *  1. ПРОГРАМА однакова в усіх, бо виводиться з зерна кімнати;
 *  2. одна відповідь на раунд: повтор не подвоює очок;
 *  3. РАХУНОК — чиста функція від журналу. Ніхто не оголошує своїх очок; він
 *     оголошує лише правильність, а швидкість рахується з двох СЕРВЕРНИХ
 *     позначок часу. Тому та сама відповідь, надіслана пізніше, коштує менше —
 *     і підробити це клієнт не може;
 *  4. фази раунду залежать від переданого часу, а не від справжнього годинника.
 *
 * Час тут рухає `room.tick()`, а не `Date.now()`: перевірка, яка чекає реальні
 * секунди, або довга, або зеленіє випадково.
 */

const HOST = 'uid-host';
const GUEST = 'uid-guest';
const SEED = 20260824;

const info = (over: Partial<RoomInfo> = {}): RoomInfo => ({
	gameId: 'quiz',
	rulesVersion: 1,
	seed: SEED,
	status: 'playing',
	hostUid: HOST,
	config: gamesToConfig(ONLINE_GAMES.map((game) => game.id)),
	...over
});

const members = (): Member[] => [
	{ uid: HOST, name: 'Лідер', role: 'player', order: 1 },
	{ uid: GUEST, name: 'Гість', role: 'player', order: 2 }
];

function table(roomInfo: RoomInfo = info()) {
	const room = new LocalRoom(roomInfo, members());
	const host = new QuizMatch(HOST, room.transport());
	const guest = new QuizMatch(GUEST, room.transport());
	const stop = [host.listen(), guest.listen()];
	return { room, host, guest, stop: () => stop.forEach((off) => off()) };
}

describe('набір ігор у кімнаті', () => {
	it('перевірка жива: ігри онлайн є', () => {
		expect(ONLINE_GAMES.length).toBeGreaterThan(0);
		expect(QUIZ_ROUNDS).toBeGreaterThan(1);
	});

	/**
	 * Вибір їде прапорцями, бо схема бази інакшого не приймає.
	 *
	 * `info.config` — це `Record<string, number>`, і правило дозволяє в ньому лише
	 * числа. Саме тому спільна вікторина НЕ вимагає нової редакції правил: вона
	 * вкладається в наявний конверт.
	 */
	it('вибір ігор перетворюється в числа й читається назад', () => {
		const only = [ONLINE_GAMES[0].id];
		const config = gamesToConfig(only);

		for (const value of Object.values(config)) {
			expect(value === 0 || value === 1, 'у конфізі бувають лише числа 0 і 1').toBe(true);
		}
		expect(config[`${GAME_FLAG_PREFIX}${ONLINE_GAMES[0].id}`]).toBe(1);
		expect(configToGames(config)).toEqual(only);
	});

	/**
	 * Порожній набір трактується як «усі», а не як «жодної».
	 *
	 * Партія, що не почалася через порожній вибір, виглядала б як поломка. А
	 * порожній набір у ДАНИХ можливий: кімната старішої збірки або чужі руки.
	 */
	it('кімната без жодного прапорця дає всі ігри', () => {
		expect(configToGames({})).toEqual(ONLINE_GAMES.map((game) => game.id));
	});
});

describe('програма партії', () => {
	it('те саме зерно — та сама програма', () => {
		const games = ONLINE_GAMES.map((game) => game.id);
		expect(quizProgramme(SEED, games)).toEqual(quizProgramme(SEED, games));
	});

	/**
	 * Різне зерно — різна програма.
	 *
	 * Без цієї перевірки зелений результат попередньої нічого не вартий: функція,
	 * яка завжди віддає той самий список, теж «детермінована».
	 */
	it('інше зерно дає іншу програму', () => {
		const games = ONLINE_GAMES.map((game) => game.id);
		expect(quizProgramme(SEED, games)).not.toEqual(quizProgramme(SEED + 1, games));
	});

	it('у програмі лише вибрані ігри', () => {
		const only = [ONLINE_GAMES[0].id];
		for (const step of quizProgramme(SEED, only)) {
			expect(step.game).toBe(ONLINE_GAMES[0].id);
		}
	});

	/**
	 * Зерна кроків РІЗНІ, і це не дрібниця.
	 *
	 * Сусідні зерна в лінійному генераторі дають схожі послідовності, тож два
	 * кроки тієї самої гри показали б майже ті самі питання. Тому крок бере
	 * наступне число потоку, а не `seed + index`.
	 */
	it('кроки мають різні зерна', () => {
		const seeds = quizProgramme(
			SEED,
			ONLINE_GAMES.map((game) => game.id)
		).map((s) => s.seed);
		expect(new Set(seeds).size).toBe(seeds.length);
	});
});

describe('рахунок спільної вікторини', () => {
	it('обидва бачать однакову програму', () => {
		const { host, guest, stop } = table();
		expect(host.programme).toHaveLength(QUIZ_ROUNDS);
		expect(host.programme).toEqual(guest.programme);
		stop();
	});

	/**
	 * ШВИДКІСТЬ РАХУЄТЬСЯ З ЖУРНАЛУ, і це головне твердження всього файлу.
	 *
	 * Двоє дають ОДНАКОВО правильну відповідь на той самий раунд, але з різницею
	 * в часі — і очки виходять різні. Жоден із них числа очок не надсилав: у
	 * журналі лежить `correct: 1`, а решту порахував контролер із двох серверних
	 * позначок.
	 *
	 * Саме цього не могла зробити попередня модель: там у журнал їхало готове
	 * число, тобто швидкість була ОГОЛОШЕНОЮ, і 100 замість 62 виглядало як
	 * швидка відповідь.
	 */
	it('та сама відповідь пізніше коштує менше', async () => {
		const { room, host, guest, stop } = table();
		await host.startRound(0);

		await host.answer(1);
		room.tick(Math.round(host.limitMs * 0.8));
		await guest.answer(1);

		const scores = host.scores;
		expect(scores[HOST]).toBeGreaterThan(scores[GUEST]);
		// Миттєва відповідь — стеля; найповільніша — підлога. Числа з конфігу.
		expect(scores[HOST]).toBe(100);
		expect(scores[GUEST]).toBeLessThan(100);
		expect(scores[GUEST]).toBeGreaterThanOrEqual(50);
		stop();
	});

	it('хибна відповідь не дає очок, навіть найшвидша', async () => {
		const { host, stop } = table();
		await host.startRound(0);
		await host.answer(0);
		expect(host.scores[HOST]).toBe(0);
		stop();
	});

	it('часткова правильність дає частку очок', async () => {
		const { host, stop } = table();
		await host.startRound(0);
		await host.answer(2 / 3);
		// Миттєва відповідь дала б 100 за повну правильність; дві третини — 67.
		expect(host.scores[HOST]).toBe(67);
		stop();
	});

	/**
	 * Одна відповідь на раунд — єдине місце, де база не захищає.
	 *
	 * Правило «лише створити» стереже НОМЕР ходу, а повторна відповідь приїжджає
	 * з іншим номером. Без цієї перевірки повтор надсилання давав би подвійні
	 * очки, і виглядало б це як щедрий баг, а не як дірка.
	 */
	it('повторна відповідь на той самий раунд не додає очок', async () => {
		const { room, host, stop } = table();
		await host.startRound(0);
		await host.answer(1);
		const once = host.scores[HOST];

		// Обходимо власну перевірку контролера й пишемо в журнал напряму — саме так
		// вчинив би той, хто відкрив консоль.
		await room.transport().append({
			seq: host.applied + 1,
			by: HOST,
			type: 'answer',
			payload: { round: 0, correct: 1 }
		});

		expect(host.scores[HOST]).toBe(once);
		stop();
	});

	/**
	 * Раунд оголошує ЛИШЕ господар.
	 *
	 * Правило бази цього не тримає: підписати хід чужим `uid` не можна, але
	 * оголосити раунд від СЕБЕ може будь-хто. Без перевірки при застосуванні гість
	 * перескочив би раунд — і в усіх поїхала б програма.
	 */
	it('раунд, оголошений гостем, відкидається', async () => {
		const { host, guest, stop } = table();
		await guest.startRound(0);
		expect(host.round).toBe(-1);
		expect(guest.round).toBe(-1);
		stop();
	});

	it('хто відповів — видно, а що відповів — ні', async () => {
		const { host, guest, stop } = table();
		await host.startRound(0);
		await guest.answer(1);

		expect(host.answered).toEqual([GUEST]);
		expect(host.iAnswered).toBe(false);
		expect(host.everyoneAnswered).toBe(false);

		await host.answer(0);
		expect(host.everyoneAnswered).toBe(true);
		// Факт відповіді однаковий для правильної й хибної: у переліку лише uid.
		expect(host.answered.slice().sort()).toEqual([GUEST, HOST].sort());
		stop();
	});
});

describe('фази раунду', () => {
	it('поки час іде — раунд; коли вийшов — табло', async () => {
		const { room, host, stop } = table();
		await host.startRound(0);
		const start = host.startedAt[0];

		expect(host.phase(start)).toBe('round');
		expect(host.phase(start + host.limitMs - 1)).toBe('round');
		expect(host.phase(start + host.limitMs)).toBe('reveal');
		room.tick(0);
		stop();
	});

	/**
	 * Коли відповіли всі, раунд кінчається РАНІШЕ — але не в ту саму мить.
	 *
	 * Секунда потрібна останньому: без неї табло вискакує тоді, коли він щойно
	 * відпустив кнопку, і власної відповіді на дошці він не бачить.
	 */
	it('усі відповіли — табло за секунду, а не одразу', async () => {
		const { room, host, guest, stop } = table();
		await host.startRound(0);
		await host.answer(1);
		room.tick(500);
		await guest.answer(1);

		const last = host.answers[0][GUEST].at;
		expect(host.phase(last)).toBe('round');
		expect(host.phase(last + SETTLE_MS - 1)).toBe('round');
		expect(host.phase(last + SETTLE_MS)).toBe('reveal');
		stop();
	});

	it('наступний раунд — через показ табла, не раніше', async () => {
		const { host, stop } = table();
		await host.startRound(0);
		const deadline = host.deadlineAt() as number;

		expect(host.nextDue(deadline)).toBe(false);
		expect(host.nextDue(deadline + REVEAL_MS - 1)).toBe(false);
		expect(host.nextDue(deadline + REVEAL_MS)).toBe(true);
		stop();
	});

	it('партія скінчилася, коли раунди програми вичерпані', async () => {
		const { host, stop } = table();
		for (let round = 0; round < QUIZ_ROUNDS; round++) await host.startRound(round);
		expect(host.over).toBe(false);
		await host.startRound(QUIZ_ROUNDS);
		expect(host.over).toBe(true);
		expect(host.phase(0)).toBe('over');
		stop();
	});
});

describe('приріст за раунд', () => {
	/**
	 * Табло між раундами показує «+90», а не лише суму — тобто приріст мусить
	 * рахуватися з журналу так само чесно, як і сам рахунок.
	 */
	it('дає кожному стільки, скільки цей раунд і коштував', async () => {
		const { room, host, guest, stop } = table();
		await host.startRound(0);
		await host.answer(1);
		room.tick(2000);
		await guest.answer(1);

		const start = host.startedAt[0];
		const limit = host.limitMs;
		const gains = host.roundGains;

		expect(gains[HOST]).toBe(answerPoints(host.answers[0][HOST].at, start, limit, 1));
		expect(gains[GUEST]).toBe(answerPoints(host.answers[0][GUEST].at, start, limit, 1));
		// Пізніша відповідь коштує менше — те саме правило, що й у сумі.
		expect(gains[GUEST]).toBeLessThan(gains[HOST]);
		stop();
	});

	it('той, хто не відповів, має нуль, а не порожнеч', async () => {
		const { room, host, stop } = table();
		await host.startRound(0);
		await host.answer(1);
		expect(host.roundGains[GUEST]).toBe(0);
		room.tick(0);
		stop();
	});

	it('до першого раунду приріст нульовий в усіх', () => {
		const { host, stop } = table();
		expect(Object.values(host.roundGains)).toEqual([0, 0]);
		stop();
	});
});

describe('той, хто зник із кімнати', () => {
	/**
	 * ГОЛОВНЕ ТУТ: партія не чекає на того, кого немає.
	 *
	 * `members` не прибираються ніколи — кожен пише лише про себе, — тож гравець,
	 * що закрив вкладку, лишається у складі назавжди. Доти це замерзало партію:
	 * «усі відповіли» не ставало правдою, і кожен раунд крутив таймер до кінця.
	 */
	it('раунд закінчується без відповіді того, кого немає онлайн', async () => {
		const { room, host, stop } = table();
		host.present = [HOST];
		await host.startRound(0);
		await host.answer(1);

		expect(host.away.map((member) => member.uid)).toEqual([GUEST]);
		expect(host.everyoneAnswered).toBe(true);

		const mine = host.answers[0][HOST].at;
		expect(host.phase(mine + SETTLE_MS)).toBe('reveal');
		room.tick(0);
		stop();
	});

	/**
	 * ПОРОЖНЯ ПРИСУТНІСТЬ — це «ще не приїхала», а не «нікого немає».
	 *
	 * Підписка встає за такт після входу. Якби порожнеча означала «нікого», перший
	 * же раунд закінчився б сам собою, до першої відповіді.
	 */
	it('поки присутність не приїхала — чекаємо всіх', async () => {
		const { room, host, stop } = table();
		await host.startRound(0);
		await host.answer(1);

		expect(host.present).toEqual([]);
		expect(host.away).toEqual([]);
		expect(host.everyoneAnswered).toBe(false);
		room.tick(0);
		stop();
	});

	/** Якщо не стало НІКОГО — раунд теж не вважається закінченим. */
	it('порожня кімната не закінчує раунд сама собою', async () => {
		const { room, host, stop } = table();
		host.present = ['uid-somebody-else'];
		await host.startRound(0);
		await host.answer(1);

		expect(host.awaited).toHaveLength(2);
		expect(host.everyoneAnswered).toBe(false);
		room.tick(0);
		stop();
	});

	/**
	 * Смуга таймера показує ДЕДЛАЙН, а не межу часу.
	 *
	 * Доти вона рахувалася від `start + limitMs` і бігла далі на екрані, де раунд
	 * уже фактично закінчився — тобто показувала час, якого немає.
	 */
	it('смуга таймера скорочується разом із дедлайном', async () => {
		const { room, host, stop } = table();
		host.present = [HOST];
		await host.startRound(0);
		const start = host.startedAt[0];
		expect(host.leftMs(start)).toBe(host.limitMs);

		await host.answer(1);
		const left = host.leftMs(host.answers[0][HOST].at);
		expect(left).toBeLessThanOrEqual(SETTLE_MS);
		expect(left).toBeGreaterThan(0);
		room.tick(0);
		stop();
	});
});

describe('очки за відповідь — чиста функція', () => {
	it('перевірка жива: межі беруться з конфігу', () => {
		expect(roundLimitMs('myths')).toBeGreaterThan(0);
		expect(roundLimitMs('myths', 5)).toBe(roundLimitMs('myths') * 5);
		// Невідома гра не валить рахунок: беремо найкоротший раунд.
		expect(roundLimitMs('гри-такої-немає')).toBeGreaterThan(0);
	});

	it('миттєва відповідь — стеля, остання мілісекунда — підлога', () => {
		expect(answerPoints(1000, 1000, 7000, 1)).toBe(100);
		expect(answerPoints(8000, 1000, 7000, 1)).toBe(50);
		expect(answerPoints(4500, 1000, 7000, 1)).toBe(75);
	});

	/**
	 * Відповідь ПОЗА вікном оцінюється як найповільніша, а не як нульова.
	 *
	 * Від'ємна різниця можлива: `at` ставить сервер із вікном у пʼять секунд, і
	 * хід міг отримати позначку раніше за старт раунду. Нуль очок за це був би
	 * покаранням за розсинхрон годинників.
	 */
	it('час поза вікном не дає ні нуля, ні понад стелю', () => {
		expect(answerPoints(0, 1000, 7000, 1)).toBe(100);
		expect(answerPoints(99999, 1000, 7000, 1)).toBe(50);
	});
});
