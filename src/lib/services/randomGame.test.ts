import { describe, expect, it } from 'vitest';
import { PLAYABLE_ROUTES, pickRandomRoute } from './randomGame';
import { LANGUAGE_ROUTES } from '$lib/i18n/routing';

describe('випадкова гра', () => {
	/**
	 * Перелік виводиться з маршрутів, а другий список розійшовся б із першим на
	 * наступній грі. Перевірка стежить саме за тим, а не за вмістом.
	 */
	it('це всі маршрути, крім головної та вибору режиму', () => {
		const games = Object.keys(LANGUAGE_ROUTES).filter(
			(route) => route !== '' && route !== 'game-habitat'
		);
		expect([...PLAYABLE_ROUTES].sort()).toEqual(games.sort());
	});

	/**
	 * Кнопка обіцяє ГРУ. Головна й вибір підрежиму — це меню: випасти вони не
	 * мають, інакше «випадкова гра» приводить у ще один вибір.
	 */
	it('меню серед варіантів немає', () => {
		expect(PLAYABLE_ROUTES).not.toContain('');
		expect(PLAYABLE_ROUTES, 'це екран вибору, а не гра').not.toContain('game-habitat');
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
