import { afterEach, describe, expect, it, vi } from 'vitest';
import { devPanel } from './devPanel.svelte';

/**
 * Службове меню розробника — рівно один спільний прапорець.
 *
 * Перевіряється те, чого не видно на екрані: у ПРОДАКШНІ меню не відкривається
 * взагалі. `dev` — константа збірки, і саме тому `if (!dev) return` дає збирачеві
 * прибрати й меню, і його код; але якщо цю умову колись приберуть, у релізі
 * зʼявиться службове табло з журналом і станом партії — і жоден інший гейт
 * цього не побачить, бо в dev-режимі все працює як завжди.
 *
 * Обидва режими в одному файлі: типовий мок `$app/environment` дає `dev: false`
 * (тобто продакшн), а другий екземпляр модуля піднімається з `dev: true`.
 */
describe('devPanel', () => {
	afterEach(() => {
		devPanel.close();
		vi.doUnmock('$app/environment');
		vi.resetModules();
	});

	it('перевірка жива: спочатку меню закрите', () => {
		expect(devPanel.open).toBe(false);
	});

	/** ГОЛОВНЕ: у релізі кнопка версії нічого не відкриває. */
	it('у продакшні toggle() не відкриває меню', () => {
		devPanel.toggle();
		expect(devPanel.open, 'службове меню відкрилося в релізній збірці').toBe(false);
	});

	it('close() закриває, навіть коли меню й так закрите', () => {
		devPanel.close();
		expect(devPanel.open).toBe(false);
	});

	it('у dev-режимі toggle() перемикає туди й назад', async () => {
		vi.resetModules();
		vi.doMock('$app/environment', () => ({ browser: true, dev: true }));
		const { devPanel: panel } = await import('./devPanel.svelte');

		panel.toggle();
		expect(panel.open).toBe(true);

		panel.toggle();
		expect(panel.open).toBe(false);

		panel.toggle();
		panel.close();
		expect(panel.open).toBe(false);
	});
});
