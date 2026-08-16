import { ESLint } from 'eslint';
import { readFileSync } from 'node:fs';
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
	'svelte/require-each-key',
	'svelte/valid-compile',
	'svelte/prefer-svelte-reactivity'
] as const;

/**
 * Два правила свідомо ВИМКНЕНІ для шару UI, і тому їх немає у списку вище.
 * Це не борг і не недогляд — у кожного є заміна, СТРОГІША за саме правило.
 * Список тут, щоб «його просто прибрали зі списку» не стало тихим способом
 * зняти гейт: наступна перевірка вимагає, щоб заміна існувала й працювала.
 */
const REPLACED_BY_INVARIANT = [
	{
		rule: 'svelte/no-at-html-tags',
		// Правило дивиться на ФАЙЛ; інваріант — на ВИРАЗ усередині `{@html}`.
		invariant: 'src/security.test.ts',
		proof: 'SAFE_HTML_SOURCES'
	},
	{
		rule: 'svelte/no-navigation-without-resolve',
		// Правило не бачить `resolve()` крізь `langPath()`; інваріант ловить
		// справжню помилку — склеювання шляху з `base` вручну.
		invariant: 'src/structure.test.ts',
		proof: 'base` вручну'
	}
] as const;

/**
 * Файл-зразок мусить бути `.svelte`: частина правил (`svelte/*`) живе лише в
 * overrides-блоці для цього розширення, і на `.ts` їх у зібраному конфігу немає.
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

	it.each(REPLACED_BY_INVARIANT)(
		'$rule вимкнене — але заміна на місці й справді щось перевіряє',
		({ rule, invariant, proof }) => {
			// Зібраний конфіг віддає рівень числом `0`, а не рядком `'off'` — обидві
			// форми означають те саме, і покладатися лише на одну крихко.
			expect(
				levelOf(rules[rule]),
				'правило мало б бути вимкненим для шару UI'
			).toSatisfy((level) => level === 'off' || level === 0);

			// Заміна перевіряється не за фактом існування файлу, а за тим, що в
			// ньому є та сама сутність, заради якої правило й знімали. Інакше
			// «інваріант є» перетворилося б на порожню обіцянку.
			const source = readFileSync(invariant, 'utf8');
			expect(source, `${invariant} не містить «${proof}»`).toContain(proof);
		}
	);

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
