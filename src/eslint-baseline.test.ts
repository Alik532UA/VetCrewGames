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
	// DEBUGGING-v8 § 4. У списку разом із рештою, бо клас той самий: AGENTS.md
	// забороняє `console.*` текстом, і поки правило вимкнене, заборона тримається
	// лише на тому, що текст прочитають.
	'no-console',
	// STORAGE-NAMESPACE-v8, Крок 3, CRITICAL. Origin спільний із шістьма сусідніми
	// застосунками, тож ключ повз фасад — це чужі дані під `clear()`. Правил два, і
	// друге не зайве: `no-restricted-globals` НЕ ловить `window.localStorage`, а
	// саме ця форма й трапилася в сусідньому проєкті тричі поспіль.
	'no-restricted-globals',
	'no-restricted-properties',
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

/**
 * Борг у режимі `warn` — число, яке ЛИШЕ спадає (CODE-QUALITY-v8 § 6.4.3).
 *
 * ## Навіщо ще одна перевірка поруч із попередньою
 *
 * Та вище доводить, що правило не `off`. Вона нічого не каже про КІЛЬКІСТЬ, а
 * саме кількість і є боргом: `warn` лишає порушення у звіті рівно для того, щоб
 * за ним можна було стежити. Без гейта стежити нічим — і це не гіпотеза. У
 * `DigitalWorkshop`, єдиному проєкті, де цей ратчет уже стояв, числа перед тим
 * розійшлися з дійсністю двічі в одному файлі: 17 проти реальних 16 і 66 проти
 * 65. Клас, який AI-AGENT-PITFALLS-v8 § 5.5 називає прямо: «число зі звіту
 * старіє саме тоді, коли робота йде добре».
 *
 * ## Чому мапа порожня — і чому це найцінніший випадок
 *
 * `npm run lint` у цьому проєкті віддає 0 помилок і 0 попереджень при 334
 * перевірених файлах. Ратчет тут не стежить за боргом — він тримає НУЛЬ: перша
 * ж поява попередження валить прогін з іменем правила, замість тихо додати
 * рядок у звіт, який ніхто не порівнює з попереднім.
 *
 * ## Чому саме РІВНІСТЬ, а не «не більше»
 *
 * «Не більше» ловить зростання й пропускає застарівання: виправив три місця —
 * число лишилося старим, і наступний читач бачить борг, якого немає. Рівність
 * змушує опустити число тим самим комітом, яким борг скоротили.
 *
 * ## Чому перебір у тілі `it`, а не `it.each`
 *
 * `it.each` над ПОРОЖНЬОЮ мапою не падає — він створює нуль перевірок і
 * звітує зелено. Тобто в проєкті з нульовим боргом ратчет виглядав би робочим
 * і не перевіряв нічого: рівно та тест-заглушка, яку пакет називає CRITICAL.
 * Перебір у тілі одного `it` дає той самий звіт і не має цього стану.
 */
const DEBT: Readonly<Record<string, number>> = {};

describe('борг ESLint — число, що лише спадає (CODE-QUALITY-v8 § 6.4.3)', () => {
	let counts: Record<string, number>;
	let errors = 0;
	let linted = 0;

	beforeAll(async () => {
		// Той самий прохід, що й `npm run lint`, тільки через Node API: запуск
		// `.cmd` без `shell: true` з Node 22+ падає з EINVAL, а `shell: true`
		// дає DEP0190. Запас за таймаутом навмисний — плаваючий гейт гірший за
		// відсутній, бо на нього перестають дивитися.
		const results = await new ESLint().lintFiles(['.']);
		counts = {};
		linted = results.length;
		for (const result of results) {
			for (const message of result.messages) {
				const rule = message.ruleId ?? '(без правила)';
				counts[rule] = (counts[rule] ?? 0) + 1;
				if (message.severity === 2) errors++;
			}
		}
	}, 120_000);

	it('перевірка жива: lint пройшов по джерелах проєкту', () => {
		/*
		 * Межа не нуль, і це різні твердження.
		 *
		 * `> 0` ловить лише повністю мертвий прохід. Але гейт так само міряє
		 * порожнечу, коли `eslint.config` почав ігнорувати майже все: один
		 * узятий файл дасть нуль попереджень, мапа боргу зійдеться, і це
		 * прочитається як «боргу немає».
		 *
		 * 513 — заміряно прогоном на момент коміту. Межа вдвічі нижча: не
		 * падає на звичайному рості й скороченні дерева, але порожнечу називає.
		 * Взято з `adoptananimal` (`bfaa531`), де цей клас і знайшли.
		 */
		expect(linted, 'ESLint не взяв жодного файлу — гейт міряє порожнечу').toBeGreaterThan(
			250
		);
	});

	it('помилок немає — борг це попередження, а не поламана збірка', () => {
		expect(errors, 'lint червоний: це вже не борг, а зламаний гейт').toBe(0);
	});

	it('борг не зріс і жодне число не застаріло', () => {
		const drift: string[] = [];
		for (const [rule, declared] of Object.entries(DEBT)) {
			const actual = counts[rule] ?? 0;
			if (actual > declared) {
				drift.push(
					`${rule}: борг ВИРІС — ${actual} проти записаних ${declared}. ` +
						'Правило в режимі warn лише для того, щоб число спадало.'
				);
			} else if (actual < declared) {
				drift.push(
					`${rule}: борг скоротився до ${actual}, а в DEBT досі ${declared}. ` +
						'Опустіть число тим самим комітом — інакше воно застаріє мовчки.'
				);
			}
		}
		expect(drift, drift.join('\n')).toEqual([]);
	});

	it('немає боргу без записаного числа', () => {
		const unlisted = Object.keys(counts).filter((rule) => !(rule in DEBT));
		expect(
			unlisted,
			`правило дає попередження, а числа для нього немає:\n${unlisted.join('\n')}`
		).toEqual([]);
	});

	it('сума боргу дорівнює тому, що звітує lint', () => {
		const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
		const declared = Object.values(DEBT).reduce((sum, n) => sum + n, 0);
		expect(total, 'сума в DEBT розійшлася з прогоном').toBe(declared);
	});
});
