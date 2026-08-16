// @vitest-environment node
// Перевірка читає файли — DOM їй не потрібен.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Версіонування за VERSIONING-v8.
 *
 * Найдорожче тут — остання перевірка, і вона з'явилася після справжнього
 * випадку: версія простояла на 0.0.61 тридцять комітів поспіль. Гачок був
 * написаний, `husky` стояв у залежностях, скрипт бампа працював — не працював
 * рядок, який їх з'єднує. `"prepare": "svelte-kit sync || echo '' ; husky"` —
 * це синтаксис POSIX-шелла, а npm на Windows виконує скрипти через `cmd.exe`,
 * де `;` не розділяє команди. `prepare` падав із кодом 1, до `husky` не
 * доходило, гачок не встановлювався жодного разу.
 *
 * Не сказав про це ніхто: `npm install` не кричить, а гачок, якого немає,
 * мовчить за визначенням. Побачив користувач — за однаковою версією на проді
 * й на dev.
 */
const IGNORED = new Set(['node_modules', '.svelte-kit', 'build', 'dist']);

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		if (IGNORED.has(entry)) continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full, out);
		else if (/\.(ts|svelte)$/.test(entry)) out.push(full.replace(/\\/g, '/'));
	}
	return out;
}

const sources = walk('src');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

describe('версіонування', () => {
	it('перевірка жива: джерела знайдено', () => {
		expect(sources.length).toBeGreaterThan(0);
	});

	it('версія ніде не захардкоджена (§ анти-патерни)', () => {
		const bad = sources
			.filter((file) => !file.endsWith('version.test.ts'))
			.filter((file) =>
				/const\s+\w*VERSION\w*\s*=\s*['"]v?\d+\.\d+\.\d+['"]/.test(readFileSync(file, 'utf8'))
			);
		expect(bad, `хардкод версії: ${bad.join(', ')}`).toEqual([]);
	});

	it('app-version.json містить лише версію (§ 1.4)', () => {
		const raw = JSON.parse(readFileSync('static/app-version.json', 'utf8'));
		expect(Object.keys(raw), 'дані моменту збірки дописуються при збірці, а не комітяться').toEqual(
			['version']
		);
	});

	it('файл версії не розходиться з package.json', () => {
		const raw = JSON.parse(readFileSync('static/app-version.json', 'utf8'));
		expect(raw.version.replace(/^v/, '')).toBe(pkg.version);
	});

	/**
	 * Скрипти `package.json` виконуються і в `sh`, і в `cmd.exe` — залежно від
	 * того, хто клонував репозиторій. Спільного в них менше, ніж здається:
	 * `&&` розуміють обидва, а `;`, `||` з порожньою командою, лапки `'…'` і
	 * підстановка `$(…)` — ні.
	 *
	 * Тому все, складніше за `a && b`, виноситься у `scripts/*.mjs`: Node
	 * однаковий скрізь.
	 */
	it('скрипти package.json не залежать від POSIX-шелла', () => {
		const posixOnly = /;|\|\||\$\(|'/;
		const bad = Object.entries(pkg.scripts as Record<string, string>)
			.filter(([, command]) => posixOnly.test(command))
			.map(([name, command]) => `${name}: ${command}`);
		expect(
			bad,
			`на Windows такий скрипт мовчки не виконається — винести в scripts/*.mjs:\n${bad.join('\n')}`
		).toEqual([]);
	});
});
