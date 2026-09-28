import { describe, expect, it } from 'vitest';
import { PLAYABLE_ROUTES, pickRandomRoute } from './randomGame';
import type { RouteRest } from '$lib/i18n/routing';
import { QUIZ_GAMES } from '$lib/config/menu-games';

/**
 * «ВИПАДКОВА ГРА» — ЛИШЕ ГРА З МЕНЮ ВІКТОРИНИ.
 *
 * Дефект (скарга автора 2026-09-28): кнопка вела в заповідник, у вікно входу чи на іншу
 * випадкову сторінку. Перелік тоді рахувався як «усі адреси сайту, крім винятків», і цей
 * файл перевіряв рівно те саме — «усі, крім винятків», — тож нові сторінки проходили
 * крізь обидва: і крізь код, і крізь тест. Тепер тест тримає ОБІЦЯНКУ кнопки, а не
 * спосіб, яким її рахує код.
 *
 * Зворотні експерименти: повернути в `randomGame.ts` перелік винятків — червоніють
 * «рівно шість», «адреси, які кнопка давала доти», «поза іграми меню» й «жодного меню»;
 * не розгортати гру з підрежимами — червоніють «рівно шість» і «жодного меню».
 */

/** Шість варіантів: пʼять ігор меню, і «Де живем?» — двома підрежимами. */
const SIX: RouteRest[] = [
	'game-mythbusters',
	'game-population',
	'game-habitat/continents',
	'game-habitat/biomes',
	'game-family',
	'game-feeding'
];

/** Звідки прийшла скарга: ці адреси кнопка давала, хоч вони не ігри вікторини. */
const LEAKED: RouteRest[] = [
	'account',
	'play',
	'online',
	'quiz/online',
	'pairs/online',
	'reserve',
	'reserve/forest',
	'reserve/tundra',
	'reserve/savanna',
	'reserve/rainforest'
];

describe('випадкова гра', () => {
	it('рівно шість ігор: пʼять із меню, «Де живем?» — двома підрежимами', () => {
		expect([...PLAYABLE_ROUTES].sort()).toEqual([...SIX].sort());
	});

	it('жодна з адрес, які кнопка давала доти: заповідник, акаунт, меню, кімнати', () => {
		for (const route of LEAKED) {
			expect(PLAYABLE_ROUTES, `${route} — не гра вікторини`).not.toContain(route);
		}
	});

	/**
	 * Головна властивість, і саме її не мав старий перелік: адреса, якої немає в меню під
	 * кнопкою, не випадає, хоч би коли її додали (як заповідник і акаунт). Кожен варіант —
	 * гра меню або її підрежим.
	 */
	it('жодної адреси поза іграми меню й їхніми підрежимами', () => {
		const menu = QUIZ_GAMES.map((game) => game.route);
		const outside = PLAYABLE_ROUTES.filter(
			(route) => !menu.some((game) => route === game || route.startsWith(`${game}/`))
		);
		expect(outside).toEqual([]);
	});

	/**
	 * Кнопка обіцяє ГРУ. Сторінка вибору підрежиму — ще один вибір, тож «Де живем?» випадає
	 * лише підрежимами; так само й меню («Грати», «Вікторина», головна).
	 */
	it('жодного меню й жодного вибору підрежиму серед варіантів', () => {
		for (const menu of ['', 'play', 'quiz', 'quiz/play', 'pairs', 'online', 'game-habitat']) {
			expect(PLAYABLE_ROUTES, `${menu || '(головна)'} — це меню, а не гра`).not.toContain(menu);
		}
	});

	it('кожна гра меню досяжна — сама чи підрежимом', () => {
		for (const game of QUIZ_GAMES) {
			const reachable = PLAYABLE_ROUTES.some(
				(route) => route === game.route || route.startsWith(`${game.route}/`)
			);
			expect(reachable, `${game.route} ніколи не випадає`).toBe(true);
		}
	});

	/**
	 * «Знайди пару» живе у власному розділі, а «Випадкова гра» — усередині вікторини, тобто
	 * пропонує саме її ігри. Службова сторінка (чеклист) — теж не гра.
	 */
	it('«Знайди пару» й чеклист не випадають', () => {
		expect(PLAYABLE_ROUTES).not.toContain('game-memory');
		expect(PLAYABLE_ROUTES).not.toContain('beta-test-checklists');
	});

	it('вибрана гра — та, що є в переліку', () => {
		for (const value of [0, 0.5, 0.999]) {
			expect(PLAYABLE_ROUTES).toContain(pickRandomRoute(() => value));
		}
	});

	it('кожна досяжна принаймні раз', () => {
		const seen = new Set(
			PLAYABLE_ROUTES.map((_, i) => pickRandomRoute(() => i / PLAYABLE_ROUTES.length))
		);
		expect(seen.size).toBe(PLAYABLE_ROUTES.length);
	});
});
