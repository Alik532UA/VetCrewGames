import { describe, it, expect } from 'vitest';
import { LANGUAGES, type Language } from '$lib/i18n/routing';
import { uk } from './uk';
import { en } from './en';
import { de } from './de';
import { nl } from './nl';

/**
 * Словники як ДАНІ, а не як файли: тут перевіряється те, що справді зібралося в
 * об'єкт і поїде в бандл.
 *
 * ## Чому перелік виводиться з `LANGUAGES`, а не написаний рядком
 *
 * Доти в цьому файлі стояло `uk ↔ en` двома літералами — і це було правильно
 * рівно доти, доки мов було дві. `de` і `nl` увімкнули 2026-08-16, і жодна з
 * трьох перевірок нижче їх не побачила: паритет міряв пару, порожні значення
 * шукав у парі, і — головне — заборонений HTML шукав теж у парі. Половина
 * словників проєкту не перевірялася ніяк, а файл при цьому був зелений і
 * називався «parity».
 *
 * Тепер додати мову й не додати її сюди неможливо: `MISSING` нижче падає на
 * коді, який оголошений у `LANGUAGES` і не має тут словника. Це та сама
 * дисципліна, що вже стоїть у `src/i18n-completeness.test.ts`, лише з іншого
 * боку: там від оголошених мов до ФАЙЛІВ, тут — до зібраних ОБ'ЄКТІВ.
 *
 * ## Чому заборона HTML — це безпека, а не охайність
 *
 * `src/security.test.ts` дозволяє `{@html}` рівно з трьох джерел —
 * `formatFont()`, `formatPlain()`, `formatPopulation()` — і весь дозвіл
 * тримається на одному твердженні: «вони беруть рядок зі СТАТИЧНОГО словника».
 * `formatFont()` при іншому шрифті повертає вхідний рядок незміненим, тобто
 * значення словника йде у `{@html}` як розмітка. Таких місць у проєкті 240.
 *
 * Отже словник — це і є довірений вхід усієї моделі, і доти дві мови з чотирьох
 * до нього не входили: `<script>` у німецькому рядку не побачив би жоден гейт
 * проєкту.
 *
 * Зворотний експеримент (AI-AGENT-PITFALLS-v8 § 1.1): вписати `javascript:0` у
 * будь-яке значення `de/ui.ts` — перевірка мусить впасти й назвати мову та
 * ключ. Виконано: до цієї правки лишалася зеленою, після — падає.
 */

/** Зібрані словники за кодом мови. Джерело — ті самі модулі, що імпортує `i18n/index.ts`. */
const DICTIONARIES: Partial<Record<Language, Record<string, unknown>>> = { uk, en, de, nl };

/** Еталон, з якого писалося все інше. Той самий, що й у типі `TranslationKey`. */
const REFERENCE: Language = 'uk';

describe('перевірка жива', () => {
	it('кожна оголошена мова має тут словник', () => {
		// Канарка й заразом гейт: без цього рядка додана мова просто не потрапила б
		// у перевірки нижче, і вони лишилися б зеленими на неповному переліку.
		const missing = LANGUAGES.filter((lang) => !DICTIONARIES[lang]);
		expect(
			missing,
			`мова оголошена в LANGUAGES, а словника в перевірці немає — вона її не бачить: ${missing.join(', ')}`
		).toEqual([]);
		expect(LANGUAGES.length).toBeGreaterThan(1);
	});

	it('еталонний словник не порожній', () => {
		expect(Object.keys(DICTIONARIES[REFERENCE] ?? {}).length).toBeGreaterThan(100);
	});
});

describe('паритет ключів', () => {
	const referenceKeys = Object.keys(DICTIONARIES[REFERENCE] ?? {});

	for (const lang of LANGUAGES.filter((l) => l !== REFERENCE)) {
		it(`${REFERENCE} ↔ ${lang}: набір ключів той самий`, () => {
			const dict = DICTIONARIES[lang]!;
			const keys = Object.keys(dict);

			const missing = referenceKeys.filter((k) => !(k in dict));
			const extra = keys.filter((k) => !(k in DICTIONARIES[REFERENCE]!));

			expect(missing, `є в ${REFERENCE}, немає в ${lang}: ${missing.join(', ')}`).toEqual([]);
			expect(extra, `є в ${lang}, немає в ${REFERENCE}: ${extra.join(', ')}`).toEqual([]);
		});
	}
});

describe('значення', () => {
	for (const lang of LANGUAGES) {
		it(`${lang}: кожне значення — непорожній рядок`, () => {
			const bad: string[] = [];
			for (const [key, value] of Object.entries(DICTIONARIES[lang]!)) {
				if (typeof value !== 'string') bad.push(`${key}: ${typeof value}, а не рядок`);
				else if (value.trim().length === 0) bad.push(`${key}: порожній`);
			}
			expect(bad, `${lang}:\n${bad.join('\n')}`).toEqual([]);
		});
	}
});

describe('заборонений HTML у словниках (SECURITY-v8 § 5.3)', () => {
	/**
	 * Значення йдуть через `{@html formatFont(...)}`, тож будь-яка розмітка тут
	 * жива. Ловляться саме виконувані форми, а не кутові дужки взагалі:
	 * `<span>` у словнику законний і вживається (наголоси, переноси).
	 */
	const FORBIDDEN =
		/<script|<\/script|<iframe|<object|<embed|javascript:|data:text\/html|srcdoc\s*=|on(?:click|error|load|mouseover|mouseenter|focus|blur|submit|toggle|animationend)\s*=/i;

	for (const lang of LANGUAGES) {
		it(`${lang}: немає виконуваних конструкцій`, () => {
			const offenders: string[] = [];
			for (const [key, value] of Object.entries(DICTIONARIES[lang]!)) {
				if (typeof value === 'string' && FORBIDDEN.test(value)) {
					offenders.push(`${key} = ${JSON.stringify(value)}`);
				}
			}
			expect(offenders, `${lang}: заборонена розмітка\n${offenders.join('\n')}`).toEqual([]);
		});
	}

	it('регулярка справді щось ловить', () => {
		// Без цього рядка описка в регулярці зробила б усі перевірки вище зеленими
		// назавжди, і виглядало б це як «у словниках чисто».
		expect(FORBIDDEN.test('<script>alert(1)</script>')).toBe(true);
		expect(FORBIDDEN.test('<a href="javascript:0">x</a>')).toBe(true);
		expect(FORBIDDEN.test('<span style="color: red">Ї</span>')).toBe(false);
	});
});
