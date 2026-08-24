import { describe, expect, it } from 'vitest';
import { CREW_ANIMALS, crewNameKey } from './crewNames';
import { defaultIdentity } from './accountDefaults';

/**
 * ПІДСТАНОВКА В ПОРОЖНІЙ ПРОФІЛЬ: імʼя в грі й @нік — з одного ключа тварини.
 *
 * Головне, що тут стверджується, — @нік ЗАВЖДИ проходить правило бази. Інакше
 * новий гравець отримав би поле, яке не зберігається, і причину побачив би лише
 * після натиску «Зберегти».
 */

/** Те саме правило, що в `database.rules.json` і в умові збереження форми. */
const HANDLE = /^[a-z0-9_]{3,20}$/;

/** Перекладач-заглушка: віддає сам ключ, як і справжній до приїзду словника. */
const echo = (key: string) => key;

describe('підстановка в порожній профіль', () => {
	it('перевірка жива: імена команди є й вони латинські', () => {
		expect(CREW_ANIMALS.length).toBeGreaterThan(50);
		expect(CREW_ANIMALS.every((id) => /^[a-z0-9_]+$/.test(id))).toBe(true);
	});

	/**
	 * ГОЛОВНЕ: @нік проходить правило бази для КОЖНОЇ тварини.
	 *
	 * Найдовший ідентифікатор — `passenger_pigeon` (16), плюс підкреслення й три
	 * цифри дає рівно 20. Тварина з довшою назвою зламала б підстановку молча, і
	 * побачив би це не тест, а новий гравець.
	 */
	it('@нік проходить правило бази для кожної тварини', () => {
		for (const [index, animal] of CREW_ANIMALS.entries()) {
			const at = index / CREW_ANIMALS.length;
			const { handle } = defaultIdentity(echo, () => at);
			expect(HANDLE.test(handle), `${animal}: нік ${handle} не пройшов правило`).toBe(true);
		}
	});

	it('обидва поля з ОДНОГО ключа тварини', () => {
		const { name, handle } = defaultIdentity(echo, () => 0);
		const animal = CREW_ANIMALS[0];
		expect(name).toBe(crewNameKey(animal));
		expect(handle.startsWith(`${animal}_`)).toBe(true);
	});

	it('те саме джерело випадковості — та сама підстановка', () => {
		const first = defaultIdentity(echo, () => 0.42);
		expect(defaultIdentity(echo, () => 0.42)).toEqual(first);
	});

	it('різні числа дають різних тварин', () => {
		const low = defaultIdentity(echo, () => 0);
		const high = defaultIdentity(echo, () => 0.999999);
		expect(low.name).not.toBe(high.name);
	});

	it('цифровий хвіст — рівно три цифри, і без нуля попереду', () => {
		for (const value of [0, 0.25, 0.5, 0.75, 0.999999]) {
			const { handle } = defaultIdentity(echo, () => value);
			const suffix = handle.slice(handle.lastIndexOf('_') + 1);
			expect(suffix).toMatch(/^[1-9][0-9]{2}$/);
		}
	});
});
