import { describe, expect, it } from 'vitest';
import {
	CREW_ANIMALS,
	CREW_NAME_COUNT,
	CREW_NAME_KEYS,
	CREW_ONLY,
	crewNameKey,
	randomCrewName
} from './crewNames';
import { animals } from './population-game';
import { crew as uk } from '$lib/i18n/crew/uk';
import { crew as en } from '$lib/i18n/crew/en';
import { crew as de } from '$lib/i18n/crew/de';
import { crew as nl } from '$lib/i18n/crew/nl';

/**
 * Імена команди — дані, і в них є межа, яку ставить НЕ код.
 *
 * `database.rules.json` перевіряє `name` учасника: `newData.isString() &&
 * newData.val().length <= 48`. Довше імʼя база просто ВІДКИДАЄ, і виглядає це
 * як «не вдалося зайти в кімнату» — тобто найдорожчий різновид дефекту, бо
 * причина лежить у словнику, а падає мережа. Жоден інший гейт цієї пари не
 * бачить: `check:i18n` звіряє ключі, а не довжину, а правила бази не знають про
 * словник.
 *
 * МЕЖА БУЛА 24, і саме вона диктувала, які імена можна вигадати: німецьке
 * «Tollpatschiges Flusspferd» (25) доводилося різати до «Tapsiges Flusspferd».
 * Тепер 48 — і число тут мусить іти за правилом, а не жити своїм життям: якби
 * воно лишилося 24, тест стверджував би заборону, якої вже немає.
 *
 * Друга перевірка — на пусте місце. `td()` віддає САМ КЛЮЧ, коли перекладу
 * немає, тож забутий `pairs.crew.wombat` у німецькій показався б гравцеві
 * рядком «pairs.crew.wombat» замість імені. Паритет ключів у `check:i18n` це
 * вловив би лише якби ключ був відсутній у ВСІХ мовах, а не в одній.
 */
const LANGUAGES = { uk, en, de, nl } as Record<string, Record<string, string>>;

/** Межа з `database.rules.json`, а не з голови. */
const NAME_MAX = 48;

describe('імена команди', () => {
	const keys = CREW_NAME_KEYS;

	it('перевірка жива: ключі й мови знайдено', () => {
		expect(keys.length).toBeGreaterThan(50);
		expect(keys).toHaveLength(CREW_NAME_COUNT);
		expect(Object.keys(LANGUAGES)).toHaveLength(4);
	});

	/**
	 * КОЖНА ТВАРИНА ГРИ МАЄ ІМʼЯ — властивість, якої доти не було чим стверджувати.
	 *
	 * Ключі були `pairs.crew1…crew24`, тобто номер не казав нічого про тварину.
	 * Додану в гру тварину список просто не помічав, і про це ніщо не
	 * повідомляло: імен ставало менше, ніж тварин, а виглядало це як «так і
	 * задумано».
	 *
	 * Тест імпортує `animals` із `population-game.ts` — тобто джерело правди про
	 * склад гри, а не власну копію переліку.
	 */
	it('кожна тварина гри має імʼя', () => {
		const named = new Set(CREW_ANIMALS);
		const missing = animals.map((animal) => animal.id).filter((id) => !named.has(id));
		expect(
			missing,
			`тварини в грі є, а імені немає: ${missing.join(', ')}\n` +
				'Додати ключ `pairs.crew.<id>` у всі чотири мови та id у `CREW_ANIMALS`.'
		).toEqual([]);
	});

	/**
	 * Імена БЕЗ тварини дозволені — але тільки названі.
	 *
	 * Автор попросив тримати Вомбата в списку заздалегідь: тварина запланована, а
	 * підпис гравця від її відсутності не ламається. Без цієї перевірки список міг
	 * би тихо обростати іменами тварин, яких ніхто не планує, — і «всі тварини
	 * гри» перестало б означати щось певне.
	 */
	it('поза грою — рівно ті імена, які названі', () => {
		const inGame = new Set(animals.map((animal) => animal.id));
		const outside = CREW_ANIMALS.filter((id) => !inGame.has(id));
		expect(outside.slice().sort()).toEqual(CREW_ONLY.slice().sort());
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
	 * Підставний перекладач: «Імʼя chicken», «Імʼя cow», …
	 *
	 * Справжній словник тут не потрібен і не бажаний: перевіряється поведінка
	 * вибору, а не текст. Саме тому `crewNames.ts` навмисно не імпортує
	 * `$lib/i18n` — див. докблок модуля.
	 */
	const fake = (key: string) => `Імʼя ${key.replace('pairs.crew.', '')}`;

	/**
	 * ТОЧНІ межі вибору, а не сотня кидків.
	 *
	 * Джерело випадковості передається, тож поведінку можна стверджувати
	 * однозначно — і саме на межах, де живе класична помилка на одиницю: `0`
	 * мусить дати перший елемент, майже одиниця — останній. Той самий спосіб, що
	 * в тесті `pickOne` у `utils/seededRandom`.
	 */
	it('вибір не виходить за межі списку', () => {
		expect(randomCrewName(fake, () => 0)).toBe(fake(crewNameKey(CREW_ANIMALS[0])));
		expect(randomCrewName(fake, () => 0.999999)).toBe(
			fake(crewNameKey(CREW_ANIMALS[CREW_NAME_COUNT - 1]))
		);
	});

	/**
	 * ВЛАСТИВІСТЬ КНОПКИ «інше імʼя»: вона мусить МІНЯТИ імʼя завжди.
	 *
	 * Перебираються ВСІ позиції генератора, а не випадкові: наївна реалізація
	 * «кинь випадковий» промахується рівно в одному кидку з `CREW_NAME_COUNT`,
	 * тобто ймовірнісний тест був би зеленим у 99% прогонів — гірше за відсутній,
	 * бо червонів би раз на місяць і виглядав би як плаваючий.
	 */
	it('кнопка «інше імʼя» не віддає те саме ні за якого кидка', () => {
		const excluded = fake(crewNameKey(CREW_ANIMALS[0]));

		for (let step = 0; step < CREW_NAME_COUNT; step += 1) {
			// Рівно в середину кожного відрізка: так перевіряється кожен можливий вибір.
			const at = (step + 0.5) / CREW_NAME_COUNT;
			expect(randomCrewName(fake, () => at, [excluded]), `кидок ${at}`).not.toBe(excluded);
		}
	});

	/**
	 * ЗАЙНЯТІ ІМЕНА НЕ ВИДАЮТЬСЯ — те, про що просив автор.
	 *
	 * Два однакових підписи в переліку кімнат нічого не ламають (особу несе
	 * `uid`), але роблять неможливим вибір «до кого зайти»: два рядки «Мудра
	 * Сова» — це два різних незнайомці, яких ніяк не розрізнити.
	 *
	 * Перебираються всі позиції генератора з тієї самої причини, що вище: один
	 * промах на список залишився б непоміченим у майже кожному прогоні.
	 */
	it('жодне зайняте імʼя не видається ні за якого кидка', () => {
		// Перші десять — «уже онлайн». Число довільне, важлива лише множинність:
		// доти виключити можна було рівно одне імʼя.
		const taken = CREW_ANIMALS.slice(0, 10).map((id) => fake(crewNameKey(id)));

		for (let step = 0; step < CREW_NAME_COUNT; step += 1) {
			const at = (step + 0.5) / CREW_NAME_COUNT;
			expect(taken, `кидок ${at}`).not.toContain(randomCrewName(fake, () => at, taken));
		}
	});

	/**
	 * Межовий випадок: коли зайнято ВСЕ, повторюємося — а не віддаємо порожнє.
	 *
	 * Реалізація фільтрує список; на повністю зайнятому фільтр дає порожній масив,
	 * `pickOne` віддає `null` — і в поле імені потрапило б «null», яке поїхало б у
	 * базу як імʼя гравця. На живих даних до цього краю не дійти (вісімдесят імен
	 * проти двадцяти кімнат у переліку), тим паче він мусить бути рішенням.
	 */
	it('коли зайнято все, віддає імʼя зі списку, а не порожнє', () => {
		const all = CREW_NAME_KEYS.map(fake);
		const got = randomCrewName(fake, () => 0.5, all);
		expect(all).toContain(got);
	});

	it('перелік ключів збігається з оголошеною кількістю', () => {
		expect(CREW_NAME_KEYS).toHaveLength(CREW_NAME_COUNT);
		expect(new Set(CREW_NAME_KEYS).size).toBe(CREW_NAME_COUNT);
		expect(new Set(CREW_ANIMALS).size, 'id не повторюються').toBe(CREW_NAME_COUNT);
	});

	it('імена в межах однієї мови не повторюються', () => {
		const dupes: string[] = [];
		for (const [lang, dict] of Object.entries(LANGUAGES)) {
			const seen = new Map<string, string>();
			for (const key of keys) {
				const value = dict[key] ?? '';
				const first = seen.get(value);
				// Повтор не ламає гру, але робить список меншим за обіцяний: виключення
				// зайнятих працює за ЗНАЧЕННЯМ, тож два однакових рядки — це на один
				// варіант менше, ніж каже `CREW_NAME_COUNT`.
				if (first) dupes.push(`${lang}: ${first} і ${key} — обидва «${value}»`);
				else seen.set(value, key);
			}
		}
		expect(dupes, dupes.join('\n')).toEqual([]);
	});
});
