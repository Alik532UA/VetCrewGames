import { describe, expect, it, vi } from 'vitest';
import { LocalRoom } from '$lib/net/localRoom';
import type { Member, RoomInfo } from '$lib/net/roomTypes';
import {
	GAME_FLAG_PREFIX,
	ONLINE_GAMES,
	QUIZ_ROUNDS,
	answerPoints,
	roundLimitMs,
	configToGames,
	gamesToConfig,
	quizProgramme,
	distinctProgramme,
	roomFitsGames,
	DEFAULT_PACE,
	REVEAL_PACE,
	ROUND_PACE,
	quizConfig
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

	/**
	 * ФІЛЬТР СПИСКУ: набір кімнати мусить УКЛАДАТИСЯ у вибране.
	 *
	 * Не перетин, і різниця тут не теоретична. Перетин («хоч одна спільна») пускав
	 * би в список кімнату з усіма шістьма іграми за будь-якого фільтра: вибравши
	 * одні «Міфи», людина потрапила б у партію, де пʼять раундів із шести — те, що
	 * вона щойно зняла. Тобто фільтр працював би, а результат був би той самий.
	 *
	 * Зворотний експеримент (§ 1.1): замінити `every` на `some` у `roomFitsGames` —
	 * червоніє перший же випадок.
	 */
	it('фільтр пускає кімнату, набір якої вкладається у вибране', () => {
		const [first, second] = ONLINE_GAMES;
		const roomTwo = gamesToConfig([first.id, second.id]);

		expect(roomFitsGames(roomTwo, [first.id]), 'зайва гра — не показуємо').toBe(false);
		expect(roomFitsGames(roomTwo, [first.id, second.id])).toBe(true);
		expect(roomFitsGames(gamesToConfig([first.id]), [first.id, second.id])).toBe(true);
	});

	/**
	 * Кімната, яка НАБОРУ НЕ ОГОЛОСИЛА, читається як «будь-які ігри».
	 *
	 * Такі є в базі: запис переліку, зроблений до появи поля. Показувати їх при
	 * звуженому фільтрі означало б обіцяти те, чого ніхто не обіцяв, — тож вони
	 * видні, поки вибрані всі, і ховаються разом із першим звуженням.
	 */
	it('кімната без оголошеного набору видна лише за повного вибору', () => {
		const all = ONLINE_GAMES.map((game) => game.id);
		expect(roomFitsGames(undefined, all)).toBe(true);
		expect(roomFitsGames(undefined, [ONLINE_GAMES[0].id])).toBe(false);
	});
});

/**
 * НАБІР ІГОР ПРАВИТЬ ГОСПОДАР, І ЛИШЕ В ЛОБІ.
 *
 * Доти набір після створення кімнати не міняло ніщо — автор попросив саме цього:
 * «можна налаштувати поміняти саме тут, у кімнаті». Дві межі цієї правки й
 * перевіряються: хто (господар) і коли (доки партія не почалася).
 *
 * Друга важливіша за першу й не є обережністю: програма раундів — чиста функція
 * від (зерна, набору), тож зміна набору посеред партії перемалювала б УЖЕ ЗІГРАНІ
 * раунди. Зворотний експеримент (§ 1.1): прибрати `this.status !== 'lobby'` із
 * `setGames` — червоніє «в партії набір не міняється».
 */
describe('зміна набору ігор', () => {
	const twoGames = [ONLINE_GAMES[0].id, ONLINE_GAMES[1].id];

	it('господар міняє набір у лобі, і його бачать обоє', async () => {
		const { host, guest, stop } = table(info({ status: 'lobby' }));

		await host.setGames(twoGames);

		expect(host.games).toEqual(twoGames);
		expect(guest.games, 'набір лежить у кімнаті, тобто він у всіх один').toEqual(twoGames);
		stop();
	});

	it('гість набору не міняє', async () => {
		const { host, guest, stop } = table(info({ status: 'lobby' }));
		const before = [...host.games];

		await guest.setGames(twoGames);

		expect(host.games).toEqual(before);
		stop();
	});

	it('у партії набір не міняється', async () => {
		const { host, stop } = table(info({ status: 'playing' }));
		const before = [...host.games];

		await host.setGames(twoGames);

		expect(host.games, 'інакше перемалювалися б уже зіграні раунди').toEqual(before);
		stop();
	});
});

/**
 * ШВИДКІСТЬ КІМНАТИ: два незалежні налаштування.
 *
 * Прохання автора: «треба, щоб у кімнаті це можна було налаштовувати… поточні
 * значення будуть використовуватися в швидкому режимі… і ці дві — час на раунд і
 * час на перегляд відповіді — окремі налаштування, наприклад можна поставити „час
 * на раунд“ повільний, а „час на перегляд відповіді“ швидкий».
 *
 * Найважливіший пункт тут — останній. `setConfig` пише обʼєкт налаштувань
 * ПОВНІСТЮ, тож зміна швидкості легко стирає набір ігор, а зміна набору — швидкість.
 * Це та поломка, якої не видно на екрані: вибрані ігри просто вертаються до всіх, і
 * виглядає це як «кімната сама себе перенастроїла».
 *
 * Зворотні експерименти (AI-AGENT-PITFALLS-v8 § 1.1) — чотири, кожен червонив рівно
 * свій пункт: `DEFAULT_PACE` змінено на `fast`; `ROUND_PACE.slow` зведено до 1;
 * `REVEAL_PACE` прибрано з `settleMs`; у `setPace` набір ігор замінено на порожній.
 * Усі чотири зроблені.
 */
describe('швидкість кімнати', () => {
	it('типова швидкість — стандартна, і саме її має кімната без налаштування', () => {
		const { host, stop } = table(info({ config: {} }));
		expect(host.roundPace).toBe('normal');
		expect(host.revealPace).toBe('normal');
		expect(DEFAULT_PACE, 'типова швидкість перестала бути стандартною').toBe('normal');
		stop();
	});

	it('швидкий режим — рівно те, що було до налаштування', () => {
		// Автор попросив саме цього; будь-яке інше число тут тихо змінило б гру тим,
		// кому вона й так підходила.
		expect(ROUND_PACE.fast).toBe(1);
		expect(REVEAL_PACE.fast).toBe(1);
	});

	it('швидкості вибираються НЕЗАЛЕЖНО одна від одної', async () => {
		const { host, stop } = table(info({ status: 'lobby' }));

		await host.setPace('slow', 'fast');

		expect(host.roundPace).toBe('slow');
		expect(host.revealPace, 'один рівень на дві потреби').toBe('fast');
		stop();
	});

	it('швидкість масштабує ВСІ три числа, а не одне', async () => {
		const { room, host, stop } = table(info({ status: 'lobby' }));
		const fast = { round: 0, settle: 0, reveal: 0 };

		await host.setPace('fast', 'fast');
		await room.transport().setStatus('playing');
		await host.startRound(0);
		fast.round = host.limitMs;
		fast.settle = host.settleMs;
		fast.reveal = host.revealMs;

		const slow = table(info({ status: 'lobby', config: quizConfig(host.games, 'slow', 'slow') }));
		await slow.room.transport().setStatus('playing');
		await slow.host.startRound(0);

		expect(slow.host.limitMs, 'час раунду не залежить від швидкості').toBeGreaterThan(fast.round);
		expect(slow.host.settleMs, '«побач свою відповідь» не залежить').toBeGreaterThan(fast.settle);
		expect(slow.host.revealMs, 'табло не залежить').toBeGreaterThan(fast.reveal);
		slow.stop();
		stop();
	});

	it('зміна швидкості не стирає набір ігор, і навпаки', async () => {
		const { host, stop } = table(info({ status: 'lobby' }));
		const two = [ONLINE_GAMES[0].id, ONLINE_GAMES[1].id];

		await host.setGames(two);
		await host.setPace('slow', 'slow');
		expect(host.games, 'швидкість стерла вибір ігор').toEqual(two);

		await host.setGames(two);
		expect(host.roundPace, 'набір ігор стер швидкість').toBe('slow');
		expect(host.revealPace).toBe('slow');
		stop();
	});

	it('гість швидкості не міняє, і в партії вона не міняється', async () => {
		/*
		 * Друга половина — не обережність: очки залежать від того, скільки тривав
		 * раунд, а рахунок перепрогонюється з журналу цілком. Зміна швидкості посеред
		 * партії перерахувала б уже зіграні раунди — минуле змінилося б заднім числом.
		 */
		const lobby = table(info({ status: 'lobby' }));
		await lobby.guest.setPace('slow', 'slow');
		expect(lobby.host.roundPace).toBe('normal');
		lobby.stop();

		const playing = table(info({ status: 'playing' }));
		await playing.host.setPace('slow', 'slow');
		expect(playing.host.roundPace, 'минуле змінилося заднім числом').toBe('normal');
		playing.stop();
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

/**
 * ПЕРЕВІРКА В ЗАПОВІДНИКУ: пʼять кроків — пʼять РІЗНИХ ігор.
 *
 * Автор попросив прямо: «кожне з питань з різних міні ігор». Доти перевірка
 * «зробити самому» брала одну гру на всі пʼять раундів, і причина, записана в
 * компоненті, спиралася на різну ціну раунду — але поріг рахується від
 * набраного максимуму, тож пропорція не зсувається.
 */
describe('програма перевірки: різні ігри', () => {
	it('те саме зерно — та сама програма', () => {
		expect(distinctProgramme(SEED, 5)).toEqual(distinctProgramme(SEED, 5));
	});

	it('інше зерно дає інший порядок', () => {
		// Без цього пункту зелений результат попереднього нічого не вартий:
		// функція, що завжди віддає один список, теж «детермінована».
		expect(distinctProgramme(SEED, 5)).not.toEqual(distinctProgramme(SEED + 1, 5));
	});

	it('пʼять кроків — пʼять різних ігор', () => {
		/*
		 * Реверсний експеримент (AI-AGENT-PITFALLS-v8 § 1.1): підмінено виклик на
		 * `quizProgramme(seed, ONLINE_GAMES.map(g => g.id), 5)` — той вибирає з
		 * повтореннями, і пункт червоніє вже на першому зерні з десяти.
		 */
		for (let seed = SEED; seed < SEED + 10; seed++) {
			const games = distinctProgramme(seed, 5).map((step) => step.game);
			expect(new Set(games).size, `зерно ${seed}: ${games.join(', ')}`).toBe(5);
		}
	});

	it('усі ігри — зі списку доступних онлайн', () => {
		const ids = new Set(ONLINE_GAMES.map((game) => game.id));
		for (const step of distinctProgramme(SEED, 5)) expect(ids.has(step.game)).toBe(true);
	});

	it('кроки мають різні зерна', () => {
		const seeds = distinctProgramme(SEED, 5).map((step) => step.seed);
		expect(new Set(seeds).size).toBe(seeds.length);
	});

	/**
	 * Кроків більше, ніж ігор — колода перемішується заново.
	 *
	 * Без цього `deck.pop()` віддав би `undefined`, і крок став би грою, якої
	 * немає: `createQuizGame` повернув би `null`, а дошка показала б «гра з
	 * новішої збірки» посеред перевірки.
	 */
	it('більше кроків, ніж ігор — усі кроки заповнені', () => {
		const steps = distinctProgramme(SEED, ONLINE_GAMES.length + 3);
		expect(steps).toHaveLength(ONLINE_GAMES.length + 3);
		const ids = new Set(ONLINE_GAMES.map((game) => game.id));
		for (const step of steps) expect(ids.has(step.game)).toBe(true);
		// Перші шість — це повна колода без повторів.
		const first = steps.slice(0, ONLINE_GAMES.length).map((step) => step.game);
		expect(new Set(first).size).toBe(ONLINE_GAMES.length);
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
		expect(host.phase(last + host.settleMs - 1)).toBe('round');
		expect(host.phase(last + host.settleMs)).toBe('reveal');
		stop();
	});

	it('наступний раунд — через показ табла, не раніше', async () => {
		const { host, stop } = table();
		await host.startRound(0);
		const deadline = host.deadlineAt() as number;

		expect(host.nextDue(deadline)).toBe(false);
		expect(host.nextDue(deadline + host.revealMs - 1)).toBe(false);
		expect(host.nextDue(deadline + host.revealMs)).toBe(true);
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
		expect(host.phase(mine + host.settleMs)).toBe('reveal');
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
	 * СМУГА СТОЇТЬ, коли відповіли всі, — а не добігає й не стрибає.
	 *
	 * Тут стояла протилежна перевірка: «смуга скорочується разом із дедлайном». Вона
	 * закривала справжній дефект — смуга бігла далі на екрані, де раунд уже
	 * скінчився, тобто показувала час, якого немає. Але лікувала його не тим:
	 * дедлайн, щойно відповіли всі, переїжджає на секунду після останньої відповіді,
	 * і смуга разом із ним ПЕРЕСТРИБУВАЛА з половини на майже нуль.
	 *
	 * Автор сказав про це прямо: «логіка правильна, але візуально нехай таймер
	 * зупиняється де був на момент відповіді останнього гравця». Тому обидві
	 * властивості перевіряються разом: смуга не рухається (те, за що стояла стара
	 * перевірка) і не стрибає (те, чого вона вимагала).
	 */
	it('смуга стоїть на місці, коли відповіли всі', async () => {
		const { room, host, stop } = table();
		host.present = [HOST];
		await host.startRound(0);
		const start = host.startedAt[0];
		expect(host.leftMs(start)).toBe(host.limitMs);

		await host.answer(1);
		const at = host.answers[0][HOST].at;
		const frozen = host.leftMs(at);

		expect(frozen, 'смуга стрибнула на кінець замість зупинитися').toBe(
			host.limitMs - (at - start)
		);
		expect(host.leftMs(at + 500), 'смуга рухається після останньої відповіді').toBe(frozen);
		expect(host.deadlineAt(at), 'правило зникло разом зі стрибком').toBe(at + host.settleMs);
		room.tick(0);
		stop();
	});

	/**
	 * ВІДПОВІДЬ У КІНЦІ РАУНДУ ВСТИГАЄ ПОКАЗАТИСЯ.
	 *
	 * Скарга автора про автовідповідь: «відповідь зʼявляється на мікросекунду, а
	 * потім вже табло результатів». Причина була в тому, що затримка після останньої
	 * відповіді вміла лише СКОРОЧУВАТИ раунд (`Math.min`): відповідь, що прийшла за
	 * триста мілісекунд до межі, діставала на розбір рівно ці триста.
	 *
	 * Тепер правило одне на два боки — не раніше, ніж через `SETTLE_MS` після
	 * останньої відповіді, — і має стелю, щоб кімната на дванадцять гравців не
	 * розтягувала раунд на дванадцять секунд.
	 */
	it('відповідь під кінець розтягує раунд, але не безмежно', async () => {
		const { room, host, guest, stop } = table();
		host.present = [HOST, GUEST];
		await host.startRound(0);
		const start = host.startedAt[0];

		// Відповідає ОДИН, і аж під кінець: другий ще думає, тобто «відповіли всі» не
		// спрацьовує й раунд тримається межею часу.
		room.tick(host.limitMs - 100);
		await guest.answer(1);
		const at = host.answers[0][GUEST].at;

		expect(host.everyoneAnswered, 'відповіли не всі — умова іншої гілки').toBe(false);
		expect(host.deadlineAt(at), 'розбір знову зникає за мілісекунди').toBeGreaterThanOrEqual(
			at + host.settleMs - 1
		);
		expect(host.deadlineAt(at), 'продовження без стелі').toBeLessThanOrEqual(
			start + host.limitMs + host.settleMs
		);
		room.tick(0);
		stop();
	});

	/**
	 * ДВОЄ ВІДПОВІЛИ ОДНОЧАСНО — ЗАРАХОВАНО ОБОМ.
	 *
	 * Скарга автора: «двоє вибрали і не натиснули кнопку „підтвердити“ — бали
	 * нарахувалися тільки одному». Причина не в автовідповіді, а в тому, що вона
	 * зробила рідке звичайним: хід — окрема дитина `moves/{seq}`, номер брався один
	 * раз, і другий запис того самого номера відкидала база. Двоє людей рідко тицяють
	 * у той самий проміжок; двоє таймерів, що рахують від тієї самої серверної
	 * позначки, — завжди.
	 *
	 * Перевірка можлива саме тому, що підставний транспорт відмовляє на зайнятому
	 * номері так само, як правило «лише створити»: добріша підставка доводила б не
	 * те, що треба.
	 */
	/**
	 * СМУГА НА ТАБЛІ: скільки чекати наступний раунд.
	 *
	 * Скарга автора: «між раундами, там де показує рахунок, немає таймера —
	 * невідомо, скільки чекати наступний раунд; очікуваний результат — є таймер (по
	 * прикладу як під час раунду)».
	 *
	 * Число для цього вже існувало, але лише як УМОВА: `nextDue` відповідає «пора чи
	 * ні». Тут перевіряється, що залишок і ця умова — те саме правило з двох боків,
	 * а не два незалежні відліки: два відліки на одному екрані розійшлися б
	 * обовʼязково, і розійшлися б непомітно.
	 *
	 * Зворотні експерименти (AI-AGENT-PITFALLS-v8 § 1.1): `revealMs` прибрано з
	 * `revealLeftMs` — червоніє «повна тривалість на початку»; `Math.max(0, …)`
	 * прибрано — червоніє «після кінця нуль, а не відʼємне». Обидва зроблені.
	 */
	it('на початку табла лишається повна його тривалість, у кінці — нуль', async () => {
		const { room, host, stop } = table();
		host.present = [HOST];
		await host.startRound(0);
		await host.answer(1);

		const deadline = host.deadlineAt(0) as number;

		expect(host.revealLeftMs(deadline), 'смуга починається не з повної').toBe(host.revealMs);
		expect(host.revealLeftMs(deadline + host.revealMs / 2)).toBe(host.revealMs / 2);
		expect(host.revealLeftMs(deadline + host.revealMs), 'у кінці не нуль').toBe(0);
		expect(host.revealLeftMs(deadline + host.revealMs * 2), 'пішло у відʼємне').toBe(0);

		// І те саме правило з другого боку: нуль настає рівно тоді, коли пора далі.
		expect(host.nextDue(deadline + host.revealMs - 1)).toBe(false);
		expect(host.nextDue(deadline + host.revealMs)).toBe(true);
		room.tick(0);
		stop();
	});

	it('раунду немає — смуги табла немає', async () => {
		// Нуль тут означає «нема чого показувати», і саме тому екран не малює смуги:
		// повна смуга на порожньому місці читалася б як «чекайте, зараз почнеться».
		const { room, host, stop } = table(info({ status: 'lobby' }));
		expect(host.revealLeftMs(0)).toBe(0);
		room.tick(0);
		stop();
	});

	it('номер уже зайнятий — відповідь однаково доходить', async () => {
		/*
		 * ЯК ТУТ ВІДТВОРЕНО ЗБІГ, і чому не `Promise.all`.
		 *
		 * У живій кімнаті двоє клієнтів беруть номер зі СВОГО, однаково свіжого знімка:
		 * обидва бачать той самий журнал, обидва рахують той самий номер, і базі
		 * дістається двічі той самий ключ. Підставний транспорт застосовує знімок
		 * синхронно, тож `Promise.all` цього не дає — другий виклик уже бачить чужий
		 * хід, і збігу не буває. Перевірка зеленіла б і без виправлення; це зміряно
		 * зворотним експериментом, а не припущено.
		 *
		 * Тому знання про журнал робиться застарілим навмисно: слухач знімається, чужий
		 * хід займає наш номер, і ми пишемо, не знаючи про це. Механічно це РІВНО той
		 * самий стан — «мій номер зайняли, поки я його ніс», — і саме його лікує
		 * боротьба за номер.
		 */
		const room = new LocalRoom(info(), members());
		const host = new QuizMatch(HOST, room.transport());
		let off = host.listen();
		host.present = [HOST];
		await host.startRound(0);

		off();
		await room
			.transport()
			.append({ seq: host.applied + 1, by: GUEST, type: 'goon', payload: { round: 0 } });

		await host.answer(1);

		off = host.listen();
		expect(host.answers[0]?.[HOST], 'відповідь зникла разом із номером').toBeDefined();
		expect(host.answers[0][HOST].correct).toBe(1);
		room.tick(0);
		off();
	});

	/**
	 * НОМЕР ВИВОДИТЬСЯ З НАЙБІЛЬШОГО, А НЕ З КІЛЬКОСТІ.
	 *
	 * Це властивість, а не сценарій: журнал нижче зібраний штучно. Але дірки в ньому
	 * стали можливі саме через боротьбу за номер — спроба з новим номером після
	 * приїзду знімка може перескочити один, — і поводитися з ними кімната мусить
	 * правильно. З номером від КІЛЬКОСТІ кожна дірка з'їдає одну спробу, і після
	 * четвертої кімната перестає приймати ходи взагалі: «гра зламалася без причини».
	 */
	/**
	 * СКІЛЬКИ ВЖЕ ЗІГРАНО — своїми результатами, для смужок прогресу.
	 *
	 * Скарга автора: «між раундами не видно, скільки вже було ігор і скільки ще
	 * залишилось». Індикатор для цього в проєкті вже є; йому потрібен перелік, і це
	 * він.
	 *
	 * Три пункти в одному, і кожен — рішення, а не арифметика:
	 *
	 *  * частка перетворюється на три стани, а не на два: «Де живем?» і «Хто
	 *    численніший?» дають частковий успіх за побудовою, і зводити його до
	 *    «неправильно» означало б не відрізняти «майже знав» від «не знав»;
	 *  * раунд без моєї відповіді — `incorrect`, а не порожнеча: «не встиг» коштує
	 *    стільки ж, скільки «схибив». Порожнеча читалася б як «ще не зіграно»;
	 *  * довжина — рівно число ЗІГРАНИХ раундів. Поточний і майбутні домальовує сам
	 *    індикатор, і тримати їх тут означало б вирішувати за нього.
	 *
	 * Зворотні експерименти (AI-AGENT-PITFALLS-v8 § 1.1): межу `>= 1` замінено на
	 * `> 0` — червоніє «частковий успіх видно окремо»; гілку `undefined` прибрано —
	 * червоніє «пропущений раунд». Обидва зроблені.
	 */
	it('свої результати за раундами: правильно, частково, пропущено', async () => {
		const { room, host, stop } = table();
		host.present = [HOST];

		await host.startRound(0);
		await host.answer(1);
		await host.startRound(1);
		await host.answer(0.5);
		await host.startRound(2);
		// Третій раунд лишається без відповіді — «не встиг».
		await host.startRound(3);

		expect(host.myRounds).toEqual(['correct', 'partial', 'incorrect']);
		expect(host.myRounds, 'у переліку є ще не зіграні раунди').toHaveLength(3);
		room.tick(0);
		stop();
	});

	it('журнал із дірками не спиняє кімнату', async () => {
		const { room, host, stop } = table();
		const raw = room.transport();
		// П'ять ходів, які починаються з номера 5: кількість дорівнює 5, тобто
		// номер-від-кількості показував би рівно на зайняте.
		for (let seq = 5; seq <= 9; seq += 1) {
			await raw.append({ seq, by: GUEST, type: 'goon', payload: { round: 0 } });
		}
		expect(host.applied, 'журнал не приїхав').toBe(5);

		await host.startRound(0);

		expect(host.startedAt[0], 'раунд не почався: номер уперся в зайняте').toBeDefined();
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

/**
 * ПАУЗА ОЧІКУВАННЯ: раунд не витрачається, поки вікно перекриває питання.
 *
 * Вимога автора: «поки чекаєте гравця, то у грі зупиняється таймер і до таймера
 * додається +3 секунди, бо це відволікаючий фактор для гравців і треба це
 * компенсувати».
 *
 * Таймера тут немає навмисно — час приходить аргументом, тож «пауза» це зсув
 * дедлайну. Умову паузи складає екран (`utils/awayWait`), контролер бере з неї
 * лише «так» або «ні».
 *
 * Зворотний експеримент (AI-AGENT-PITFALLS-v8 § 1.1): прибрати `heldMs` із
 * `deadlineAt` — червоніють обидві перевірки нижче.
 */
describe('пауза очікування', () => {
	it('поки чекаємо, до кінця раунду лишається стільки ж', async () => {
		const { host, stop } = table();
		await host.startRound(0);
		const start = host.deadlineAt(0) as number;

		host.setHold(true, 1_000);

		// Минуло 5 секунд чекання — дедлайн мусить поїхати на ті самі 5 секунд.
		expect(host.deadlineAt(6_000)).toBe(start + 5_000);
		expect(host.leftMs(6_000)).toBe(host.leftMs(1_000));
		stop();
	});

	it('після чекання додаються три секунди', async () => {
		const { host, stop } = table();
		await host.startRound(0);
		const start = host.deadlineAt(0) as number;

		host.setHold(true, 1_000);
		host.setHold(false, 5_000);

		// 4 секунди чекання + 3 секунди надбавки, і далі час іде як звичайно.
		expect(host.deadlineAt(9_000)).toBe(start + 4_000 + 3_000);
		expect(host.deadlineAt(20_000)).toBe(start + 7_000);
		stop();
	});

	/**
	 * ПАУЗА НАЛЕЖИТЬ СВОЄМУ РАУНДОВІ, і не переїжджає в наступні.
	 *
	 * Дефект, який автор побачив: «таймер візуально не працює і прогружає
	 * оновлений стан тільки після вибору відповіді». Причина була рівно тут.
	 *
	 * `heldMs` брала `Math.max(recorded, pending)`, де `recorded` — з журналу
	 * ЗА РАУНД, а `pending` — одне число на всю партію. Тобто пауза з першого
	 * раунду додавалася до дедлайну КОЖНОГО наступного.
	 *
	 * Наслідків два, і оба видно на екрані:
	 *
	 *  * `leftMs` більша за `limitMs`, тож смуга таймера отримує ширину понад
	 *    100% і СТОЇТЬ повною, поки зайвий час не витече;
	 *  * `nextDue` теж відсунутий, тож господар не оголошує наступний раунд — і
	 *    партія рухається лише тоді, коли відповіли всі (тоді дедлайн переїжджає
	 *    на `last + SETTLE_MS`). Це і є «оновлюється тільки після відповіді».
	 *
	 * Зворотний експеримент (AI-AGENT-PITFALLS-v8 § 1.1): повернути `#pending`
	 * одним числом замість переліку за раундами — обидві перевірки нижче
	 * червоніють. Зроблено.
	 */
	it('пауза першого раунду не з’їдає таймер наступного', async () => {
		const { host, guest, stop } = table();
		await host.startRound(0);

		/*
		 * ЧЕКАННЯ В ГОСТЯ ДОВШЕ, ніж у господаря, — і це не штучний випадок, а
		 * звичайний: присутність доїжджає до двох клієнтів у різні миті, тож умова
		 * паузи в них вимикається не одночасно. Пише журнал ЛИШЕ господар.
		 */
		host.setHold(true, 1_000);
		guest.setHold(true, 1_000);
		host.setHold(false, 6_000);
		guest.setHold(false, 21_000);

		await host.startRound(1);
		const start = guest.startedAt[1];
		expect(start, 'раунд не почався').toBeDefined();

		expect(guest.heldMs(start as number), 'пауза переїхала в наступний раунд').toBe(0);
		expect(guest.leftMs(start as number), 'на початку раунду лишається рівно межа').toBe(
			guest.limitMs
		);
		stop();
	});

	it('смуга таймера не буває понад сто відсотків', async () => {
		const { host, guest, stop } = table();
		await host.startRound(0);
		host.setHold(true, 1_000);
		guest.setHold(true, 1_000);
		host.setHold(false, 6_000);
		guest.setHold(false, 21_000);
		await host.startRound(1);

		const start = guest.startedAt[1] as number;
		// Саме це число йде в `width: {…}%` (`QuizRound`).
		for (const at of [start, start + 500, start + guest.limitMs - 1]) {
			expect(guest.leftMs(at), `на ${at - start} мс від початку`).toBeLessThanOrEqual(
				guest.limitMs
			);
		}
		stop();
	});

	it('господар не оголошує наступний раунд лише через чужу стару паузу', async () => {
		/*
		 * Друга половина скарги: «прогружає оновлений стан тільки після вибору
		 * відповіді». Дедлайн, зсунутий чужою старою паузою, відсуває й `nextDue` —
		 * тобто раунд не міняється сам, і партія рухається лише відповідями.
		 */
		const { host, guest, stop } = table();
		await host.startRound(0);
		host.setHold(true, 1_000);
		guest.setHold(true, 1_000);
		host.setHold(false, 6_000);
		guest.setHold(false, 21_000);
		await host.startRound(1);

		const start = guest.startedAt[1] as number;
		const wellPast = start + guest.limitMs + 10_000;
		expect(guest.nextDue(wellPast), 'раунд не закінчується сам').toBe(true);
		stop();
	});

	it('надбавка додається раз на чекання, а не на кожен виклик', async () => {
		const { host, stop } = table();
		await host.startRound(0);
		const start = host.deadlineAt(0) as number;

		host.setHold(true, 1_000);
		host.setHold(false, 2_000);
		host.setHold(false, 3_000);
		host.setHold(false, 4_000);

		expect(host.deadlineAt(9_000)).toBe(start + 1_000 + 3_000);
		stop();
	});
});

/**
 * ПАУЗА В ЖУРНАЛІ: у всіх однакова, включно з тим, хто повернувся.
 *
 * Дефект, який описав автор: «всі окрім гравця що підключився мають бонус до
 * таймеру +3 секунди, розсинхронний таймер». Так і було — пауза жила в памʼяті
 * кожного клієнта, а той, кого не було, її не бачив. Я цю межу назвав раніше як
 * «розбіжність на дрижання присутності», і недооцінив: дедлайни ставали різні.
 *
 * Тепер тривалість паузи дописує ГОСПОДАР, і всі беруть її з журналу — тобто з
 * одного числа. Заразом там же їде витрачена пільга.
 *
 * Зворотний експеримент (§ 1.1): прибрати `#writeHeld` — червоніє «гість бачить ту
 * саму паузу, що господар».
 */
describe('пауза однакова в усіх', () => {
	it('гість бачить ту саму паузу, що господар', async () => {
		const { host, guest, stop } = table();
		await host.startRound(0);
		const before = host.deadlineAt(0) as number;

		host.setHold(true, 1_000);
		host.setHold(false, 5_000);
		await Promise.resolve();
		await Promise.resolve();

		// 4 секунди чекання + 3 надбавки — і в господаря, і в гостя.
		expect(host.deadlineAt(9_000)).toBe(before + 7_000);
		expect(guest.deadlineAt(9_000)).toBe(before + 7_000);
		stop();
	});

	it('витрачена пільга видна обом', async () => {
		const { host, guest, stop } = table();
		await host.startRound(0);

		// Господар бачить, що гість зник, і відпускає паузу через 4 секунди.
		host.present = [HOST];
		host.setHold(true, 1_000);
		host.setHold(false, 5_000);
		await Promise.resolve();
		await Promise.resolve();

		expect(host.graceSpent(GUEST), 'витрачене мусить бути в журналі').toBe(4_000);
		expect(guest.graceSpent(GUEST), 'і однакове в усіх').toBe(4_000);
		stop();
	});

	it('гість паузу не пише: число мусить бути одне', async () => {
		const { host, guest, stop } = table();
		await host.startRound(0);
		const before = host.deadlineAt(0) as number;

		guest.setHold(true, 1_000);
		guest.setHold(false, 5_000);
		await Promise.resolve();
		await Promise.resolve();

		// У самого гостя пауза лишається місцевою (щоб смуга не стрибнула назад),
		// а в господаря її немає: журнал чистий.
		expect(host.deadlineAt(9_000)).toBe(before);
		stop();
	});
});

/**
 * ПАУЗА: легальний спосіб спинити партію.
 *
 * Доти його не було, і це не «забули кнопку»: пауза в грі БУЛА, але дістатися до
 * неї можна було лише зникнувши — тобто закривши вкладку. Автор назвав це прямо:
 * «гравець може вийти, щоб зупинити гру».
 *
 * Пауза бере ту саму механіку, що зникнення: той самий запас часу, те саме вікно,
 * те саме голосування. Різниця в двох речах, і кожна тут перевіряється: автор
 * знімає паузу САМ і одразу, а після зняття не може ставити її хвилину.
 *
 * Зворотний експеримент (§ 1.1): прибрати перевірку `pausedBy[round] !== move.by` у
 * перепрогоні — червоніє «чужу паузу не зняти».
 */
describe('пауза', () => {
	it('ставиться й видна обом', async () => {
		const { host, guest, stop } = table();
		await host.startRound(0);

		await guest.pause();

		expect(guest.pausedBy).toBe(GUEST);
		expect(host.pausedBy, 'пауза — це хід у журналі, тобто вона в усіх').toBe(GUEST);
		stop();
	});

	it('автор знімає свою', async () => {
		const { host, guest, stop } = table();
		await host.startRound(0);
		await guest.pause();

		await guest.resume();

		expect(guest.pausedBy).toBeNull();
		expect(host.pausedBy).toBeNull();
		stop();
	});

	/**
	 * Чужу паузу не зняти кнопкою — для цього є голосування присутніх. Правило бази
	 * цього не знає (вона не знає, хто ставив), тож стереже перепрогін.
	 */
	it('чужу паузу не зняти', async () => {
		const { room, host, guest, stop } = table();
		await host.startRound(0);
		await guest.pause();

		// Кнопкою — не виходить: контролер не дасть.
		await host.resume();
		expect(guest.pausedBy, 'кнопка чужу паузу не знімає').toBe(GUEST);

		/*
		 * І ПІДРОБЛЕНИМ ХОДОМ — теж. Пишемо в журнал напряму, тобто робимо те, що
		 * може зробити змінений клієнт: правило бази цього не спинить, бо вона не
		 * знає, ХТО ставив паузу. Стереже перепрогін, і саме він тут перевіряється.
		 */
		await room.transport().append({
			seq: 99,
			by: HOST,
			type: 'resume',
			payload: { round: 0 }
		});

		expect(guest.pausedBy, 'підроблений хід не мусить нічого означати').toBe(GUEST);
		stop();
	});

	it('двічі підряд паузу не поставити', async () => {
		const { host, guest, stop } = table();
		await host.startRound(0);
		await guest.pause();
		await host.pause();

		expect(guest.pausedBy, 'перша пауза виграє').toBe(GUEST);
		stop();
	});

	/**
	 * ВИТРИМКА ХВИЛИНУ після зняття своєї — щоб кнопкою не смикали партію. До
	 * зняття витримки немає: людина ще нічого не витратила.
	 */
	it('після зняття своєї — витримка хвилину', async () => {
		const { guest, host, stop } = table();
		await host.startRound(0);
		expect(guest.pauseReadyAt(GUEST), 'доти витримки немає').toBe(0);

		await guest.pause();
		await guest.resume();

		expect(guest.pauseReadyAt(GUEST)).toBeGreaterThan(0);
		expect(guest.pauseReadyAt(HOST), 'витримка своя в кожного').toBe(0);
		stop();
	});
});
