import { describe, expect, it } from 'vitest';
import { LANGUAGES as ALL_LANGUAGES } from '$lib/i18n/routing';
import { loadAccountText } from '$lib/i18n/account';
import { account as uk } from '$lib/i18n/account/uk';

/**
 * СЛОВНИК АКАУНТА: 42 мови, один набір ключів.
 */

describe('словник акаунта', () => {
	const keys = Object.keys(uk);

	it('перевірка жива: ключі й мови знайдено', () => {
		expect(keys.length).toBeGreaterThan(20);
		expect(ALL_LANGUAGES).toHaveLength(42);
	});

	it('усі ключі починаються з `account.`', () => {
		expect(keys.filter((key) => !key.startsWith('account.'))).toEqual([]);
	});

	it('у кожній мові той самий набір ключів', async () => {
		const problems: string[] = [];
		for (const lang of ALL_LANGUAGES) {
			const dict = await loadAccountText(lang);
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
