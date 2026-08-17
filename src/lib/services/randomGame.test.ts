import { describe, expect, it } from 'vitest';
import { PLAYABLE_ROUTES, pickRandomRoute } from './randomGame';
import { LANGUAGE_ROUTES } from '$lib/i18n/routing';

describe('випадкова гра', () => {
	/**
	 * Перелік виводиться з маршрутів, а другий список розійшовся б із першим на
	 * наступній грі. Перевірка стежить саме за тим, а не за вмістом: вона знає
	 * лише те, що виключено, і вимагає рівно решту.
	 */
	const MENUS = ['', 'quiz', 'quiz/play', 'pairs', 'game-habitat'];
	const OWN_SECTION = ['game-memory'];
	/** Службові сторінки: чеклист бета-тестування — не гра й не меню. */
	const SERVICE = ['beta-test'];

	it('це всі маршрути, крім меню, розділів із власною грою й службових', () => {
		const games = Object.keys(LANGUAGE_ROUTES).filter(
			(route) =>
				!MENUS.includes(route) && !OWN_SECTION.includes(route) && !SERVICE.includes(route)
		);
		expect([...PLAYABLE_ROUTES].sort()).toEqual(games.sort());
	});

	/**
	 * Окремо й прямо: кнопка «Випадкова гра», яка приводить у чеклист перевірок, —
	 * це зламана обіцянка, а не жарт.
	 */
	it('службові сторінки не випадають', () => {
		for (const route of SERVICE) {
			expect(PLAYABLE_ROUTES, `${route} — службова сторінка`).not.toContain(route);
		}
	});

	/**
	 * Кнопка обіцяє ГРУ. Кожен пункт нижче — екран вибору: якби він випав,
	 * «випадкова гра» привела б у ще одне меню.
	 */
	it('жодного меню серед варіантів', () => {
		for (const menu of MENUS) {
			expect(PLAYABLE_ROUTES, `${menu || '(головна)'} — це меню, а не гра`).not.toContain(menu);
		}
	});

	/**
	 * «Знайди пару» живе у власному розділі, а «Випадкова гра» — усередині
	 * вікторини, тобто пропонує саме її п'ятірку.
	 */
	it('«Знайди пару» не випадає з вікторини', () => {
		expect(PLAYABLE_ROUTES).not.toContain('game-memory');
	});

	/**
	 * Підрежими «Де живем?» тепер повноцінні адреси, тож випадають нарівні з
	 * рештою — і жодного окремого механізму для них більше не треба. Доти режим
	 * передавався модульною змінною повз адресу саме тому, що адреси не було.
	 */
	it('підрежими «Де живем?» випадають нарівні з іншими іграми', () => {
		expect(PLAYABLE_ROUTES).toContain('game-habitat/continents');
		expect(PLAYABLE_ROUTES).toContain('game-habitat/biomes');
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
