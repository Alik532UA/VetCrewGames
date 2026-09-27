// @vitest-environment node
// Перевірка лише читає файли — DOM їй не потрібен.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EMULATOR_COMMAND, EMULATOR_PORTS, EMULATOR_PROJECT } from '$lib/net/emulator';

/**
 * DEV НА ЕМУЛЯТОРІ FIREBASE (прохання автора 2026-09-27) — ЧОТИРИ МІСЦЯ, ЯКІ МУСЯТЬ ЗБІГАТИСЯ.
 *
 * Порти dev-емулятора записані в `firebase.dev.json` (їх займає емулятор), у
 * `net/emulator.ts` (туди під'єднується застосунок) і в CSP `svelte.config.js` (без них
 * браузер не пустить до емулятора). Розійдуться — dev мовчки ходитиме в порожнечу, а
 * тост казатиме «запустіть емулятор» людині, в якої він запущений.
 *
 * Друге правило — порти dev ≠ порти `check:rules` (`firebase.json`): інакше запущений
 * dev-емулятор валив би гейт відмовою «порт зайнятий», а прибирання гейта — dev.
 *
 * Що прапорець не доживає до збірки, доводить `check:build` на зібраному сайті; тут —
 * лише те, що видно в джерелах.
 *
 * Зворотні експерименти (прогнано): поміняти порт бази в `firebase.dev.json` — червоніє
 * «порти застосунку»; дати dev порт 9010 — «жоден порт не збігається»; прибрати
 * `--config firebase.dev.json` зі скрипта — «піднімає саме dev-конфіг».
 */

const dev = JSON.parse(readFileSync('firebase.dev.json', 'utf8'));
const gate = JSON.parse(readFileSync('firebase.json', 'utf8'));
const config = readFileSync('svelte.config.js', 'utf8');
const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts as Record<string, string>;
const flag = readFileSync('src/lib/net/emulator.ts', 'utf8');

const ports = (file: { emulators: Record<string, unknown> }) =>
	Object.values(file.emulators)
		.filter((value): value is { port: number } => typeof value === 'object' && value !== null)
		.map((value) => value.port)
		.filter(Number.isInteger);

describe('dev на емуляторі', () => {
	it('перевірка жива: обидва конфіги прочитано', () => {
		expect(ports(dev).length).toBeGreaterThanOrEqual(4);
		expect(ports(gate).length).toBeGreaterThanOrEqual(4);
	});

	it('порти застосунку — ті самі, що займає dev-емулятор', () => {
		expect(dev.emulators.database.port).toBe(EMULATOR_PORTS.database);
		expect(dev.emulators.auth.port).toBe(EMULATOR_PORTS.auth);
	});

	it('жоден порт dev-емулятора не збігається з портами check:rules', () => {
		expect(ports(dev).filter((port) => ports(gate).includes(port))).toEqual([]);
	});

	it('dev-емулятор бере ті самі правила, що гейт і викладка', () => {
		expect(dev.database.rules).toBe(gate.database.rules);
	});

	it('CSP знає саме ці адреси — і лише поза production-збіркою', () => {
		expect(config).toMatch(/process\.env\.NODE_ENV === 'production'\s*\?\s*\[\]/);
		for (const source of [
			`http://127.0.0.1:${EMULATOR_PORTS.database}`,
			`ws://127.0.0.1:${EMULATOR_PORTS.database}`,
			`http://127.0.0.1:${EMULATOR_PORTS.auth}`
		]) {
			expect(config, source).toContain(source);
		}
	});

	it('`npm run emulators` піднімає саме dev-конфіг і демо-проєкт', () => {
		expect(EMULATOR_COMMAND).toBe('npm run emulators');
		expect(scripts.emulators).toContain('--config firebase.dev.json');
		expect(scripts.emulators).toContain(`--project ${EMULATOR_PROJECT}`);
	});

	it('прапорець — з `import.meta.env.DEV`: збірка підставляє `false`', () => {
		expect(flag).toMatch(/export const EMULATOR: boolean = import\.meta\.env\.DEV &&/);
		expect(scripts['dev:live'], 'dev на справжній базі — окремою командою').toBe(
			'vite dev --mode live'
		);
	});
});
