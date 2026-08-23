import { describe, expect, it } from 'vitest';
import { CREW_NAME_COUNT, CREW_NAME_KEYS, crewNameKey, randomCrewName } from './crewNames';
import { uk } from '$lib/i18n/translations/uk';
import { en } from '$lib/i18n/translations/en';
import { de } from '$lib/i18n/translations/de';
import { nl } from '$lib/i18n/translations/nl';

/**
 * Імена команди — дані, і в них є межа, яку ставить НЕ код.
 *
 * `database.rules.json` перевіряє `name` учасника: `newData.isString() &&
 * newData.val().length <= 24`. Довше імʼя база просто ВІДКИДАЄ, і виглядає це
 * як «не вдалося зайти в кімнату» — тобто найдорожчий різновид дефекту, бо
 * причина лежить у словнику, а падає мережа. Жоден гейт цієї пари не бачив:
 * `check:i18n` звіряє ключі, а не довжину, а правила бази не знають про словник.
 *
 * Друга перевірка — на пусте місце. `td()` віддає САМ КЛЮЧ, коли перекладу
 * немає, тож забутий `pairs.crew13` у німецькій показався б гравцеві рядком
 * «pairs.crew13» замість імені. Паритет ключів у `check:i18n` це вловив би лише
 * якби ключ був відсутній у ВСІХ мовах, а не в одній.
 */
const LANGUAGES = { uk, en, de, nl } as Record<string, Record<string, string>>;

/** Межа з `database.rules.json`, а не з голови. */
const NAME_MAX = 24;

describe('імена команди', () => {
	const keys = Array.from({ length: CREW_NAME_COUNT }, (_, i) => crewNameKey(i + 1));

	it('перевірка жива: ключі й мови знайдено', () => {
		expect(keys).toHaveLength(24);
		expect(Object.keys(LANGUAGES)).toHaveLength(4);
	});

	it('кожне імʼя існує в кожній мові', () => {
		const missing: string[] = [];
		for (const [lang, dict] of Object.entries(LANGUAGES)) {
			for (const key of keys) {
				const value = dict[key];
				if (typeof value !== 'string' || value.trim() === '') missing.push(`${lang} ${key}`);
			}
		}
		expect(missing, `бракує перекладу: ${missing.join(', ')}`).toEqual([]);
	});

	it('кожне імʼя вміщається в межу, яку ставить база', () => {
		const tooLong: string[] = [];
		for (const [lang, dict] of Object.entries(LANGUAGES)) {
			for (const key of keys) {
				const value = dict[key] ?? '';
				if (value.length > NAME_MAX) {
					tooLong.push(`${lang} ${key}: ${value.length} символів — «${value}»`);
				}
			}
		}
		expect(
			tooLong,
			`довше за ${NAME_MAX} символів, база відкине запис:\n${tooLong.join('\n')}`
		).toEqual([]);
	});

	/**
	 * Підставний перекладач: «Імʼя 1» … «Імʼя 24».
	 *
	 * Справжній словник тут не потрібен і не бажаний: перевіряється поведінка
	 * вибору, а не текст. Саме тому `crewNames.ts` навмисно не імпортує
	 * `$lib/i18n` — див. докблок модуля.
	 */
	const fake = (key: string) => `Імʼя ${key.replace('pairs.crew', '')}`;

	/**
	 * ТОЧНІ межі вибору, а не сотня кидків.
	 *
	 * Джерело випадковості передається, тож поведінку можна стверджувати
	 * однозначно — і саме на межах, де живе класична помилка на одиницю: `0`
	 * мусить дати перший елемент, майже одиниця — останній. Той самий спосіб, що
	 * в тесті `pickOne` у `utils/seededRandom`.
	 */
	it('вибір не виходить за межі списку', () => {
		expect(randomCrewName(fake, () => 0)).toBe('Імʼя 1');
		expect(randomCrewName(fake, () => 0.999999)).toBe(`Імʼя ${CREW_NAME_COUNT}`);
	});

	/**
	 * ВЛАСТИВІСТЬ КНОПКИ «інше імʼя»: вона мусить МІНЯТИ імʼя завжди.
	 *
	 * Перебираються ВСІ двадцять чотири позиції генератора, а не випадкові: наївна
	 * реалізація «кинь випадковий» промахується рівно в одному кидку з двадцяти
	 * чотирьох, тобто ймовірнісний тест був би зеленим у 96% прогонів — гірше
	 * за відсутній, бо червонів би раз на місяць і виглядав би як плаваючий.
	 */
	it('кнопка «інше імʼя» не віддає те саме ні за якого кидка', () => {
		const excluded = fake(crewNameKey(1));

		for (let step = 0; step < CREW_NAME_COUNT; step += 1) {
			// Рівно в середину кожного відрізка: так перевіряється кожен можливий вибір.
			const at = (step + 0.5) / CREW_NAME_COUNT;
			expect(randomCrewName(fake, () => at, excluded), `кидок ${at}`).not.toBe(excluded);
		}
	});

	/**
	 * Межовий випадок: коли міняти нема на що, повертається те саме, а не
	 * порожнє.
	 *
	 * Реалізація фільтрує список і бере випадковий елемент; на списку з одного
	 * імені фільтр дає порожній масив, `pickOne` віддає `null` — і в поле імені
	 * потрапило б «null», яке поїхало б у базу як імʼя гравця.
	 */
	it('коли всі імена однакові, віддає його, а не порожнє', () => {
		const single = () => 'Весела Корова';
		expect(randomCrewName(single, () => 0.5, 'Весела Корова')).toBe('Весела Корова');
	});

	it('перелік ключів збігається з оголошеною кількістю', () => {
		expect(CREW_NAME_KEYS).toHaveLength(CREW_NAME_COUNT);
		expect(new Set(CREW_NAME_KEYS).size).toBe(CREW_NAME_COUNT);
	});

	it('імена в межах однієї мови не повторюються', () => {
		const dupes: string[] = [];
		for (const [lang, dict] of Object.entries(LANGUAGES)) {
			const seen = new Map<string, string>();
			for (const key of keys) {
				const value = dict[key] ?? '';
				const first = seen.get(value);
				// Повтор не ламає гру, але робить список меншим за обіцяний: кнопка
				// «інше імʼя» виключає ЗНАЧЕННЯ, тож два однакових рядки — це двадцять три
				// варіанти там, де в коді стоїть двадцять чотири.
				if (first) dupes.push(`${lang}: ${first} і ${key} — обидва «${value}»`);
				else seen.set(value, key);
			}
		}
		expect(dupes, dupes.join('\n')).toEqual([]);
	});
});
