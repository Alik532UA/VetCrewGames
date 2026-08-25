// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
	AVATAR_COLORS,
	AVATAR_ICONS,
	AVATAR_MAX,
	DEFAULT_AVATAR,
	formatAvatar,
	isAvatar,
	isCustomAvatar,
	parseAvatar
} from './avatars';

/**
 * АВАТАР ЯК ЗНАЧЕННЯ: що можна намалювати й що варто показувати.
 *
 * ## Два різні питання, і саме на цьому був дефект
 *
 * `isAvatar` відповідає «чи можна це намалювати», `isCustomAvatar` — «чи є що
 * показувати в рядку імені». Доти другого не існувало, і в списку гравців
 * онлайн-партії типова плитка стояла в КОЖНОГО, хто аватарки не вибирав: вона не
 * казала нічого й лише розсувала прапор та імʼя. Автор попросив показувати лише
 * те, що відрізняється від типового.
 *
 * ## Чому це перевіряється тут, а не в компоненті
 *
 * Правило про значення, а не про розмітку: `Avatar` лише питає його. Тест на
 * компонент вимагав би рендера, а межа тут проходить рівно по цих чотирьох
 * випадках — порожньо, зіпсовано, типовий, власний.
 */
describe('аватар як значення', () => {
	it('перевірка жива: списки не порожні, а типовий аватар із них', () => {
		expect(AVATAR_ICONS.length).toBeGreaterThan(1);
		expect(AVATAR_COLORS.length).toBeGreaterThan(1);
		expect(isAvatar(DEFAULT_AVATAR), 'типовий мусить бути чинним значенням').toBe(true);
	});

	it('чинним є лише відома пара «значок:колір»', () => {
		expect(isAvatar(formatAvatar(AVATAR_ICONS[0], AVATAR_COLORS[0]))).toBe(true);
		// Формі відповідає, а намалювати нічим: такого значка в переліку немає.
		expect(isAvatar('dragon:gold')).toBe(false);
		expect(isAvatar('')).toBe(false);
		expect(isAvatar(null)).toBe(false);
		expect(isAvatar('a'.repeat(AVATAR_MAX + 1))).toBe(false);
	});

	/**
	 * ГОЛОВНЕ ТУТ: типовий аватар — НЕ власний.
	 *
	 * Зворотний експеримент (§ 1.1): прибрати `&& value !== DEFAULT_AVATAR` із
	 * `isCustomAvatar` — червоніє другий рядок, а в списку гравців знову
	 * зʼявиться однакова плитка в кожного.
	 */
	it('власним є лише те, що відрізняється від типового', () => {
		const mine = formatAvatar('cat', 'violet');
		expect(isCustomAvatar(mine)).toBe(true);
		expect(isCustomAvatar(DEFAULT_AVATAR)).toBe(false);
	});

	it('порожнє й зіпсоване власним не вважається', () => {
		expect(isCustomAvatar('')).toBe(false);
		expect(isCustomAvatar(null)).toBe(false);
		expect(isCustomAvatar(undefined)).toBe(false);
		expect(isCustomAvatar('dragon:gold')).toBe(false);
	});

	/**
	 * Показ невідомого значення лишається типовим — і це НЕ суперечить правилу
	 * вище: `parseAvatar` відповідає на питання «чим малювати, якщо вже малюємо»,
	 * а вирішує «чи малювати» саме `isCustomAvatar`.
	 */
	it('невідоме значення розбирається як типовий аватар', () => {
		expect(parseAvatar('dragon:gold')).toEqual(parseAvatar(DEFAULT_AVATAR));
		expect(parseAvatar(null)).toEqual(parseAvatar(DEFAULT_AVATAR));
	});
});
