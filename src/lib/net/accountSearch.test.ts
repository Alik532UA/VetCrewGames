import { describe, expect, it, vi } from 'vitest';

/**
 * ПОШУК ЛЮДЕЙ: лише ті, чий профіль НАЗИВАЄ знайдений псевдонім (аудит 2026-09-25).
 *
 * Запис у `find` міг лишитися від того, хто колись займав псевдонім, а потім пішов
 * далі. Доти пошук «h…» показував саме його — чужу людину замість справжнього
 * власника псевдоніма. Правило бази такий запис тепер дає прибрати й переписати;
 * тут — друга лінія: застарілий запис у видачу не потрапляє, навіть поки лежить.
 *
 * SDK підмінено на межі модуля, як у `reconnect.test.ts`: інтерфейсу транспорту в
 * `net/account.ts` немає. Профілі пошук читає тим самим SDK, що й запит, — і це не
 * лише ощадливість: доти кожен профіль вантажив SDK окремим імпортом, і в Vitest
 * другий із одночасних імпортів замоканого модуля отримував СПРАВЖНІЙ модуль
 * (див. памʼять проєкту про цю пастку) — застарілий профіль відпадав через виняток,
 * і перевірка псевдоніма лишалася неперевіреною. Це й показав зворотний
 * експеримент: перший варіант цього тесту зеленів без неї.
 *
 * Зворотний експеримент: прибрати перевірку `profile?.handle === handle` —
 * червоніє.
 */

type Node = { path: string };

const FOUND: Record<string, string> = { alive: 'uid-alive', squat: 'uid-moved-on' };
const PROFILES: Record<string, { name: string; handle: string }> = {
	'uid-alive': { name: 'Справжній', handle: 'alive' },
	// Той, хто займав `squat`, пішов далі: профіль уже називає інше.
	'uid-moved-on': { name: 'Зайда', handle: 'elsewhere' }
};

vi.mock('./firebase', () => ({
	connect: async () => ({ uid: 'uid-me', db: {} }),
	forget: () => {}
}));
vi.mock('$lib/services/logService.svelte', () => ({
	logService: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));
vi.mock('firebase/database', () => ({
	ref: (_db: unknown, path = '') => ({ path }),
	query: (node: Node) => node,
	orderByKey: () => ({}),
	startAt: () => ({}),
	endAt: () => ({}),
	limitToFirst: () => ({}),
	get: async (node: Node) => {
		if (node.path === 'find') return { exists: () => true, val: () => FOUND };
		const uid = /^users\/([^/]+)\/profile$/.exec(node.path)?.[1] ?? '';
		const profile = PROFILES[uid];
		return { exists: () => profile !== undefined, val: () => profile };
	}
}));

const { searchHandles } = await import('./account');

describe('пошук людей за псевдонімом', () => {
	it('застарілий запис у видачу не потрапляє — лише той, чий профіль його називає', async () => {
		const found = await searchHandles('a');
		expect(found, 'префікс коротший за два символи — пошуку немає').toEqual([]);

		const people = await searchHandles('al');

		expect(people.map((profile) => profile.uid)).toEqual(['uid-alive']);
	});
});
