import { describe, expect, it, vi } from 'vitest';
import { LocalRoom } from '$lib/net/localRoom';
import type { Member, RoomInfo } from '$lib/net/roomTypes';
import {
	GAME_FLAG_PREFIX,
	ONLINE_GAMES,
	QUIZ_STEPS,
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
 * Головне, що тут доводиться, інше, ніж у «Знайди пару». Там — «дошка є чистою
 * функцією від журналу». Тут дошки в кожного своя, тож доводиться два інших
 * твердження:
 *
 *  1. ПРОГРАМА однакова в усіх, бо виводиться з зерна кімнати;
 *  2. РАХУНОК не подвоюється від повторного надсилання того самого кроку.
 *
 * Друге — єдине місце, де база не захищає: правило «лише створити» стереже НОМЕР
 * ходу, а повторний результат приїжджає з іншим номером.
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
		expect(QUIZ_STEPS).toBeGreaterThan(1);
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
		const seeds = quizProgramme(SEED, ONLINE_GAMES.map((game) => game.id)).map((s) => s.seed);
		expect(new Set(seeds).size).toBe(seeds.length);
	});
});

describe('рахунок спільної вікторини', () => {
	it('обидва бачать однакову програму', () => {
		const { host, guest, stop } = table();
		expect(host.programme).toEqual(guest.programme);
		expect(host.programme).toHaveLength(QUIZ_STEPS);
		stop();
	});

	it('закритий крок додає очки й рухає гравця далі', async () => {
		const { host, guest, stop } = table();
		expect(host.myStep).toBe(0);

		await host.finishStep(3);

		expect(host.myStep, 'мій крок зрушив').toBe(1);
		expect(host.myScore).toBe(3);
		expect(guest.progress[HOST], 'і гість бачить те саме').toEqual({ step: 1, score: 3 });
		stop();
	});

	/**
	 * ПОВТОРНИЙ РЕЗУЛЬТАТ ТОГО САМОГО КРОКУ НЕ ЗАРАХОВУЄТЬСЯ.
	 *
	 * Це єдине місце, де база не допоможе: правило «лише створити» стереже номер
	 * ходу, а повторне надсилання приїжджає з іншим номером. Без перевірки в
	 * застосуванні гравець, чий запис не доїхав із першого разу, отримав би
	 * подвійні очки — і виглядало б це не як зловживання, а як щедрий підрахунок.
	 */
	it('той самий крок, дописаний двічі, не подвоює очок', async () => {
		const { room, host, guest, stop } = table();
		await host.finishStep(5);

		// Руками, з тим самим номером кроку: саме так виглядав би повтор.
		await room.transport().append({
			seq: 2,
			by: HOST,
			type: 'step',
			payload: { step: 0, points: 5 }
		});

		expect(host.myScore, 'очки не подвоїлися').toBe(5);
		expect(host.myStep).toBe(1);
		expect(guest.progress[HOST]).toEqual({ step: 1, score: 5 });
		stop();
	});

	it('крок не з черги відкидається', async () => {
		const { room, host, stop } = table();

		// Третій крок, коли не закритий перший: пропуск нічого не означає.
		await room.transport().append({
			seq: 1,
			by: HOST,
			type: 'step',
			payload: { step: 2, points: 9 }
		});

		expect(host.myStep).toBe(0);
		expect(host.myScore).toBe(0);
		stop();
	});

	it('партія скінчилася, коли всі пройшли програму', async () => {
		const { host, guest, stop } = table();
		expect(host.over).toBe(false);

		for (let step = 0; step < QUIZ_STEPS; step++) await host.finishStep(1);
		expect(host.over, 'один закінчив — партія ще йде').toBe(false);
		expect(host.playing).toBe(1);

		for (let step = 0; step < QUIZ_STEPS; step++) await guest.finishStep(2);

		expect(host.over).toBe(true);
		expect(host.playing).toBe(0);
		expect(guest.myScore).toBe(2 * QUIZ_STEPS);
		stop();
	});

	it('після програми крок більше не приймається', async () => {
		const { host, stop } = table();
		for (let step = 0; step < QUIZ_STEPS; step++) await host.finishStep(1);
		const before = host.myScore;

		await host.finishStep(100);

		expect(host.myScore, 'зайвий крок нічого не додав').toBe(before);
		stop();
	});
});
