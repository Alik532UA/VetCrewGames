import { describe, it, expect } from 'vitest';
import { uk } from './uk';
import { en } from './en';

describe('translations: uk ↔ en parity', () => {
	it('uk and en have the same set of keys', () => {
		const ukKeys = Object.keys(uk).sort();
		const enKeys = Object.keys(en).sort();

		const missingInEn = ukKeys.filter((k) => !(k in en));
		const missingInUk = enKeys.filter((k) => !(k in uk));

		expect(missingInEn, `Keys present in uk but missing in en: ${missingInEn.join(', ')}`).toEqual(
			[]
		);
		expect(missingInUk, `Keys present in en but missing in uk: ${missingInUk.join(', ')}`).toEqual(
			[]
		);
	});

	it('every value is a non-empty string in both locales', () => {
		for (const [k, v] of Object.entries(uk)) {
			expect(typeof v, `uk.${k} must be string`).toBe('string');
			expect((v as string).length, `uk.${k} must be non-empty`).toBeGreaterThan(0);
		}
		for (const [k, v] of Object.entries(en)) {
			expect(typeof v, `en.${k} must be string`).toBe('string');
			expect((v as string).length, `en.${k} must be non-empty`).toBeGreaterThan(0);
		}
	});
});

describe('translations: XSS-safety guard', () => {
	// Ці значення йдуть через {@html formatFont(...)} — додаткова гарантія, що
	// у файлах перекладу не з'явиться небезпечний HTML / javascript URI.
	const FORBIDDEN =
		/<script|<\/script|javascript:|on(?:click|error|load|mouseover|focus|blur|submit)\s*=/i;

	for (const [locale, dict] of Object.entries({ uk, en })) {
		it(`${locale}: no forbidden HTML patterns in any translation value`, () => {
			const offenders: string[] = [];
			for (const [k, v] of Object.entries(dict)) {
				if (typeof v === 'string' && FORBIDDEN.test(v)) {
					offenders.push(`${k} = ${JSON.stringify(v)}`);
				}
			}
			expect(offenders, `Found forbidden HTML in ${locale}: ${offenders.join('; ')}`).toEqual([]);
		});
	}
});
