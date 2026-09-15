// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * GATE-ANALYTICS — ANALYTICS-v9 § 2.1.1 (`AN-GUARD-TEST-TRAFFIC`) і § 5.2
 * (`AN-E2E-BLOCK`).
 *
 * Обидва правила ламаються МОВЧКИ й в один бік: аналітика починає приймати
 * тестовий трафік. Побачити це можна лише в самому GA4, де числа вже змішані, а
 * почистити їх заднім числом не можна взагалі.
 *
 * Чому перевірка читає ТЕКСТ, а не поведінку: «подія не пішла, бо гард
 * спрацював» і «подія не пішла, бо аналітику зламали» дають однаковий
 * результат. Поведінковий тест на це зелений в обох випадках — саме тому
 * дефект і прожив так довго.
 *
 * Дефект, через який гейт з'явився: E2E ганяються над `npm run preview`, тобто
 * production-збіркою, де `dev === false`. Гард `browser && !dev` пропускав туди
 * кожен прогін тестів.
 */

const SERVICE = 'src/lib/services/analytics.ts';
const E2E_DIR = 'tests';
const FIXTURES = join(E2E_DIR, 'fixtures.ts').replace(/\\/g, '/');

const service = readFileSync(SERVICE, 'utf8');
const fixtures = readFileSync(FIXTURES, 'utf8');

/** Усі файли, які Playwright виконує як тести: специфікації та сетап-проєкти. */
function specFiles(dir: string, acc: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const full = join(dir, name).replace(/\\/g, '/');
		if (statSync(full).isDirectory()) specFiles(full, acc);
		else if (/\.(spec|setup)\.ts$/.test(full)) acc.push(full);
	}
	return acc;
}

describe('перевірка жива', () => {
	it('джерела прочитано і специфікації знайдено', () => {
		expect(service, 'сервіс аналітики порожній або переїхав').toContain('enabled');
		expect(
			specFiles(E2E_DIR).length,
			'жодної специфікації — обхід тек перестав знаходити файли'
		).toBeGreaterThan(0);
	});
});

describe('AN-GUARD-TEST-TRAFFIC — гард відсікає dev, preview і автоматизований браузер', () => {
	it('`dev` перевіряється', () => {
		expect(/!dev\b/.test(service), 'локальні кліки летять у продакшн-ресурс').toBe(true);
	});

	it('`isTestOrLocal()` перевіряється — preview віддає збірку, де dev === false', () => {
		expect(
			/!isTestOrLocal\(\)/.test(service),
			'без цього кожен прогін E2E шле справжні події в бойовий GA4'
		).toBe(true);
	});

	it('`isTestOrLocal` дивиться і на хост, і на прапорець автоматизації', () => {
		// Хост ловить `npm run preview` і ручний перегляд збірки, webdriver —
		// Playwright на будь-якій адресі, зокрема на справжньому домені.
		expect(service).toContain('localhost');
		expect(service).toContain('127.0.0.1');
		expect(service).toContain('navigator.webdriver');
	});

	it('`enabled` — функція, а не константа модуля', () => {
		// Константа обчислюється на імпорті, тобто до першої навігації: хост тоді
		// ще не той, а при prerender `window` немає взагалі.
		expect(/const enabled\s*=\s*\(\)\s*=>/.test(service), '`enabled` перестала бути функцією').toBe(
			true
		);
	});
});

describe('AN-E2E-BLOCK — мережу в E2E глушить фікстура', () => {
	it('модуль фікстур не містить тестів', () => {
		// Інакше перший же імпорт звідти зареєструє їх удруге — вже в проєкті
		// файлу-споживача.
		expect(/^\s*(test|setup)\s*\(/m.test(fixtures), `${FIXTURES} містить тест`).toBe(false);
	});

	it('глушилка вішається на `context`, а не на `page`', () => {
		// `page.route()` живе на одному об'єкті Page; context покриває і сторінки,
		// відкриті пізніше, і спливні вікна.
		expect(fixtures).toContain('blockAnalytics(context)');
	});

	it('кожен власний `browser.newContext()` глушиться окремо', () => {
		// Фікстура перевизначає ТОЙ контекст, який Playwright дає тесту. Контекст,
		// створений усередині тесту руками, — інший об'єкт, і маршрутів на ньому
		// немає. Саме там сиділа б остання щілина другого рівня.
		const unguarded: string[] = [];
		for (const file of specFiles(E2E_DIR)) {
			const text = readFileSync(file, 'utf8');
			for (const [, name] of text.matchAll(/const (\w+) = await browser\.newContext\(/g)) {
				if (!text.includes(`blockAnalytics(${name})`)) unguarded.push(`${file}: ${name}`);
			}
		}
		expect(unguarded, 'контекст створено руками й не заглушено').toEqual([]);
	});

	it('жодна специфікація не бере `test` напряму з @playwright/test', () => {
		const leaks = specFiles(E2E_DIR).filter((file) =>
			/import\s+(?:type\s+)?\{[^}]*\btest\b[^}]*\}\s+from\s+['"]@playwright\/test['"]/.test(
				readFileSync(file, 'utf8')
			)
		);
		expect(leaks, 'ці файли обходять фікстуру, тож їхні сторінки ходять у GA4').toEqual([]);
	});
});
