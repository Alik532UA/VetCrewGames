// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { install as uk } from '$lib/i18n/install/uk';
import { install as en } from '$lib/i18n/install/en';
import { install as de } from '$lib/i18n/install/de';
import { install as nl } from '$lib/i18n/install/nl';
import { GUIDES } from '$lib/pwa/installGuide';

/**
 * Паритет ЛІНИВОГО словника вікна «На весь екран».
 *
 * `check:i18n` звіряє зібрані словники, а цей довантажується окремо — тобто без цієї
 * перевірки нова мова або новий ключ розійшлися б непомітно, і на екрані стояв би сам
 * ключ. Та сама форма, що в `i18n-awaited.test.ts`, плюс звірка з тим, хто ці ключі читає:
 * інструкціями (`installGuide.ts`) і самим вікном.
 */

const WINDOWS = [
	'src/lib/components/FullscreenOffer.svelte',
	'src/lib/components/FullscreenAlready.svelte'
];

/** Ключі, які читають вікно й інструкції. */
function usedKeys(): Set<string> {
	const keys = new Set<string>();
	for (const guide of Object.values(GUIDES)) {
		keys.add(guide.title);
		keys.add(guide.note);
		if (guide.warning) keys.add(guide.warning);
		for (const step of guide.steps) keys.add(step.text);
	}
	for (const path of WINDOWS) {
		for (const match of readFileSync(path, 'utf8').matchAll(/'(install\.[\w.]+)'/g)) {
			keys.add(match[1]);
		}
	}
	return keys;
}

describe('словник вікна «На весь екран»', () => {
	const dicts = { uk, en, de, nl };

	it('перевірка жива: ключі є', () => {
		expect(Object.keys(uk).length).toBeGreaterThan(20);
		expect(usedKeys().size).toBeGreaterThan(20);
	});

	it('однаковий набір ключів у всіх мовах', () => {
		const keys = Object.keys(uk).sort();
		for (const [lang, dict] of Object.entries(dicts)) {
			expect(Object.keys(dict).sort(), `${lang}: набір ключів розійшовся`).toEqual(keys);
		}
	});

	it('жодного порожнього рядка', () => {
		for (const [lang, dict] of Object.entries(dicts)) {
			const empty = Object.entries(dict)
				.filter(([, value]) => value.trim() === '')
				.map(([key]) => key);
			expect(empty, `${lang}: порожні рядки`).toEqual([]);
		}
	});

	it('усі ключі починаються з install.', () => {
		expect(Object.keys(uk).filter((key) => !key.startsWith('install.'))).toEqual([]);
	});

	it('кожен ключ, який читають вікно й інструкції, у словнику є — і зайвих немає', () => {
		const used = usedKeys();
		expect([...used].filter((key) => !(key in uk)).sort(), 'ключа немає в словнику').toEqual([]);
		expect(
			Object.keys(uk)
				.filter((key) => !used.has(key))
				.sort(),
			'ключ ніхто не читає'
		).toEqual([]);
	});
});
