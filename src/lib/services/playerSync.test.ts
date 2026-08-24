import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * СИНХРОНІЗАЦІЯ РАХУНКУ: злиття при вході, живий обмін і межа «без акаунта».
 *
 * Перевіряється рівно те, що ламається тихо:
 *
 *  1. **Вхід зливає, а не заміняє.** Анонімний доробок мусить доїхати в акаунт —
 *     інакше «увійти» означало б «почати з нуля».
 *  2. **Кола записів немає.** Власний запис вертається підпискою, і другого
 *     запису викликати не мусить.
 *  3. **Без акаунта в базу не йде нічого.** Прапорця немає — немає й запиту.
 *
 * Зворотний експеримент (AI-AGENT-PITFALLS-v8 § 1.1): порівняти злите з тим, що
 * ми відсилали, замість того, що прийшло, — червоніє «прийшло більше за наше»;
 * прибрати перевірку `linked` із `pushSoon` — червоніє «без акаунта в базу нічого
 * не їде».
 */

const net = {
	readPlay: vi.fn(),
	writePlay: vi.fn(),
	watchPlay: vi.fn()
};

vi.mock('$lib/net/play', async (importOriginal) => {
	// `mergePlay` лишається СПРАВЖНЬОЮ: підмінити її означало б перевіряти
	// підміну. Мокаються рівно три функції, яким потрібна база.
	const actual = await importOriginal<typeof import('$lib/net/play')>();
	return { ...actual, ...net };
});

/** Системна тема має бути детермінованою: `Settings` читає її в конструкторі. */
function stubMatchMedia() {
	vi.stubGlobal(
		'matchMedia',
		vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
	);
}

function makeStorage(seed: Record<string, string> = {}): Storage {
	const data = new Map<string, string>(Object.entries(seed));
	return {
		get length() {
			return data.size;
		},
		key: (i: number) => [...data.keys()][i] ?? null,
		getItem: (k: string) => data.get(k) ?? null,
		setItem: (k: string, v: string) => void data.set(k, v),
		removeItem: (k: string) => void data.delete(k),
		clear: () => data.clear()
	} as Storage;
}

async function load(seed: Record<string, string> = {}) {
	vi.resetModules();
	vi.stubGlobal('localStorage', makeStorage(seed));
	stubMatchMedia();
	const sync = await import('./playerSync');
	const { playerData } = await import('./playerData.svelte');
	return { sync, playerData };
}

/** Підписка віддає слухача назовні: далі ним і подають дані «з іншого пристрою». */
function captureListener() {
	const sink: { push?: (data: unknown) => void } = {};
	net.watchPlay.mockImplementation((onData: (data: unknown) => void) => {
		sink.push = onData;
		return Promise.resolve(() => {});
	});
	return sink;
}

beforeEach(() => {
	net.readPlay.mockReset().mockResolvedValue(null);
	net.writePlay.mockReset().mockResolvedValue(true);
	net.watchPlay.mockReset().mockResolvedValue(() => {});
});

describe('синхронізація рахунку', () => {
	it('вхід в акаунт ЗЛИВАЄ анонімний доробок із хмарним', async () => {
		const { sync, playerData } = await load({ vetcrewgames_score: '120' });
		net.readPlay.mockResolvedValue({ score: 30, games: { memory: { best: 9, plays: 2 } } });

		await sync.mergeOnSignIn();

		expect(playerData.score, 'анонімний рахунок мусить доїхати в акаунт').toBe(120);
		expect(playerData.recordOf('memory')).toEqual({ best: 9, plays: 2 });
		expect(net.writePlay).toHaveBeenCalledWith({
			score: 120,
			games: { memory: { best: 9, plays: 2 } }
		});
	});

	it('вхід ставить прапорець акаунта й підписку', async () => {
		const { sync, playerData } = await load();

		await sync.mergeOnSignIn();

		expect(playerData.linked).toBe(true);
		expect(net.watchPlay).toHaveBeenCalledTimes(1);
	});

	it('без акаунта в базу нічого не їде', async () => {
		vi.useFakeTimers();
		const { playerData } = await load();

		// `onChange` ставить лише `startPlaySync`, тож поза акаунтом його немає
		// зовсім — але навіть покликаний напряму, запис не піде.
		playerData.addScore(10);
		vi.runAllTimers();

		expect(net.writePlay, 'запис без акаунта означав би зайве під’єднання').not.toHaveBeenCalled();
		vi.useRealTimers();
	});

	it('після входу зміна рахунку доходить до бази однією відкладеною відправкою', async () => {
		vi.useFakeTimers();
		const { sync, playerData } = await load();
		await sync.mergeOnSignIn();
		net.writePlay.mockClear();

		playerData.addScore(5);
		playerData.addScore(5);
		playerData.finishGame('memory', 3);
		vi.runAllTimers();

		expect(net.writePlay, 'три зміни — один запит').toHaveBeenCalledTimes(1);
		expect(net.writePlay).toHaveBeenCalledWith({
			score: 10,
			games: { memory: { best: 3, plays: 1 } }
		});
		vi.useRealTimers();
	});

	it('дані з другого пристрою зливаються, а не заміняють', async () => {
		const sink = captureListener();
		const { sync, playerData } = await load({ vetcrewgames_score: '10' });
		await sync.mergeOnSignIn();
		net.writePlay.mockClear();

		sink.push?.({ score: 60, games: { family: { best: 4, plays: 1 } } });

		expect(playerData.score).toBe(60);
		expect(playerData.recordOf('family')).toEqual({ best: 4, plays: 1 });
		expect(net.writePlay, 'прийшло більше за наше — відсилати нічого').not.toHaveBeenCalled();
	});

	it('свій рахунок відсилається назад, коли хмарний відстав', async () => {
		const sink = captureListener();
		const { sync, playerData } = await load({ vetcrewgames_score: '200' });
		await sync.mergeOnSignIn();
		net.writePlay.mockClear();

		sink.push?.({ score: 50, games: {} });

		expect(playerData.score).toBe(200);
		expect(net.writePlay).toHaveBeenCalledWith({ score: 200, games: {} });
	});

	it('зупинка знімає підписку й глушить відкладений запис', async () => {
		vi.useFakeTimers();
		const unwatch = vi.fn();
		net.watchPlay.mockResolvedValue(unwatch);
		const { sync, playerData } = await load();
		await sync.mergeOnSignIn();
		net.writePlay.mockClear();

		playerData.addScore(5);
		sync.stopPlaySync();
		vi.runAllTimers();

		expect(unwatch, 'підписка лишалася б жити після демонтажу').toHaveBeenCalled();
		expect(net.writePlay, 'запис після зупинки — це запит із мертвого екрана').not.toHaveBeenCalled();
		vi.useRealTimers();
	});

	it('друга підписка не з’являється', async () => {
		const { sync } = await load();

		await sync.startPlaySync();
		await sync.startPlaySync();

		expect(net.watchPlay, 'дві підписки дали б два злиття на кожну зміну').toHaveBeenCalledTimes(
			1
		);
	});

	it('вихід стирає місцеве й знімає підписку', async () => {
		const unwatch = vi.fn();
		net.watchPlay.mockResolvedValue(unwatch);
		const { sync, playerData } = await load({ vetcrewgames_score: '42' });
		await sync.mergeOnSignIn();

		sync.signedOut();

		expect(unwatch).toHaveBeenCalled();
		expect(playerData.score).toBe(0);
		expect(playerData.linked).toBe(false);
	});
});
