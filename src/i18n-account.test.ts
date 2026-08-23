import { describe, expect, it } from 'vitest';
import { account as uk } from '$lib/i18n/account/uk';
import { account as en } from '$lib/i18n/account/en';
import { account as de } from '$lib/i18n/account/de';
import { account as nl } from '$lib/i18n/account/nl';

/**
 * СЛОВНИК АКАУНТА: чотири мови, один набір ключів.
 *
 * ## Чому окремий тест, а не `check:i18n`
 *
 * Ці рядки навмисно НЕ входять у зібраний словник: усі чотири мови лежать у
 * бандлі кореневого layout, а сторінку акаунта відкриє далеко не кожен —
 * подробиці в `i18n/account/index.ts`. Ціна виносу саме та, що `check:i18n` їх
 * більше не бачить, і без цього файлу мова могла б лишитися без рядка.
 *
 * ## Що дає забутий ключ
 *
 * Не падіння. Завантажувач віддає САМ КЛЮЧ, тож на екрані стояло б
 * «account.errorWeak» замість поради. Це видно оком, але лише тому, хто відкрив
 * саму цю сторінку саме тією мовою.
 */

const LANGUAGES = { uk, en, de, nl } as Record<string, Record<string, string>>;

describe('словник акаунта', () => {
	const keys = Object.keys(uk);

	it('перевірка жива: ключі й мови знайдено', () => {
		// Число не з голови: стільки рядків має сторінка акаунта. Нуль означав би,
		// що тест дивиться не туди й зеленіє на порожньому місці.
		expect(keys.length).toBeGreaterThan(20);
		expect(Object.keys(LANGUAGES)).toHaveLength(4);
	});

	it('усі ключі починаються з `account.`', () => {
		// Виніс має бути ПОВНИЙ: ключ іншого розділу тут означав би, що він зник із
		// головного словника, і `check:i18n` перестав би його стерегти молча.
		expect(keys.filter((key) => !key.startsWith('account.'))).toEqual([]);
	});

	it('у кожній мові той самий набір ключів', () => {
		const problems: string[] = [];
		for (const [lang, dict] of Object.entries(LANGUAGES)) {
			for (const key of keys) {
				const value = dict[key];
				if (typeof value !== 'string' || value.trim() === '') problems.push(`${lang}: бракує ${key}`);
			}
			for (const key of Object.keys(dict)) {
				if (!keys.includes(key)) problems.push(`${lang}: зайвий ${key}`);
			}
		}
		expect(problems, problems.join('\n')).toEqual([]);
	});

	/**
	 * В українських рядках немає латиниці всередині слів.
	 *
	 * Та сама перевірка, що в `i18n-font.test.ts` для головного словника, і з тієї
	 * самої причини: латинська «i» в перекладі ламає те, чого око не бачить —
	 * пошук по сторінці, копіювання й читалку. Замінювати символ можна лише на
	 * показі.
	 */
	it('в українських рядках немає змішаних алфавітів', () => {
		const problems: string[] = [];
		for (const value of Object.values(uk)) {
			for (const word of value.split(/[^\p{L}]+/u)) {
				if (/\p{Script=Cyrillic}/u.test(word) && /\p{Script=Latin}/u.test(word)) {
					problems.push(`«${word}»`);
				}
			}
		}
		expect(problems, `кирилиця з латиницею в одному слові: ${problems.join(', ')}`).toEqual([]);
	});
});
