import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * CODE-QUALITY-v8 § 6.4.2 — базовий набір ESLint увімкнений.
 *
 * Чому цей тест існує. До 2026-08-14 `eslint.config.js` цього проєкту починався
 * блоком із семи `'off'`: `no-explicit-any`, `no-unused-vars`, `ban-ts-comment`,
 * `svelte/no-at-html-tags`, `svelte/require-each-key`,
 * `svelte/prefer-svelte-reactivity`, `svelte/no-navigation-without-resolve`.
 * Тобто рівно те, чим пакет виражає власні CRITICAL і HIGH. `npm run lint` давав
 * нуль попереджень — і цей нуль ішов у звіт про якість нарівні з нулем у
 * проєкті, де ті самі правила увімкнені.
 *
 * Тест читає ЗІБРАНИЙ конфіг (`calculateConfigForFile`), а не текст файлу:
 * правило може зникнути через зміну пресету, і в тексті цього не видно.
 *
 * Правила з боргом (`warn`) навмисно проходять перевірку: борг у звіті — це не
 * те саме, що вимкнене правило. Тест ловить лише `off`.
 */
const BASELINE = [
	'no-restricted-imports',
	'no-eval',
	'no-implied-eval',
	'no-new-func',
	'no-script-url',
	'no-restricted-syntax',
	'@typescript-eslint/no-explicit-any',
	'@typescript-eslint/no-unused-vars',
	'@typescript-eslint/ban-ts-comment',
	'svelte/no-at-html-tags',
	'svelte/require-each-key',
	'svelte/valid-compile',
	'svelte/prefer-svelte-reactivity',
	'svelte/no-navigation-without-resolve'
] as const;

/**
 * Файл-зразок мусить бути `.svelte`: частина правил (`svelte/*`) живе лише в
 * overrides-блоці для цього розширення, і на `.ts` їх у зібраному конфігу немає.
 * Файли зі списку винятків для `svelte/no-at-html-tags` для зразка не годяться.
 */
const SAMPLE = 'src/lib/components/RoundIndicator.svelte';

function levelOf(entry: unknown): string | number | undefined {
	return Array.isArray(entry) ? (entry[0] as string | number) : (entry as string | number);
}

describe('базовий набір ESLint (CODE-QUALITY-v8 § 6.4.1)', () => {
	// Node API замість `npx eslint --print-config`: з Node 22+ спроба запустити
	// `.cmd` без `shell: true` падає з EINVAL, а `shell: true` дає DEP0190.
	// Через API це той самий зібраний конфіг, тільки без підпроцесу й швидше.
	let rules: Record<string, unknown>;

	beforeAll(async () => {
		const config = (await new ESLint().calculateConfigForFile(SAMPLE)) as {
			rules: Record<string, unknown>;
		};
		rules = config.rules;
		// 30 c, а не типові 5: розвʼязання конфігу тягне пресети svelte та
		// typescript-eslint і в найбільшому з проєктів займає 3,5 c. Під
		// паралельним прогоном у CI типового ліміту не вистачає — файл падав
		// з 14 пропущеними перевірками, тобто гейт червонів без порушення.
	}, 30_000);

	it.each(BASELINE)('%s не вимкнене', (rule) => {
		const level = levelOf(rules[rule]);
		expect(
			level,
			'правило відсутнє у зібраному конфігу — звіт lint не покриває цей клас порушень'
		).toBeDefined();
		expect(level, 'правило вимкнене — зелений lint нічого не доводить').not.toBe('off');
		expect(level, 'правило вимкнене — зелений lint нічого не доводить').not.toBe(0);
	});
});
