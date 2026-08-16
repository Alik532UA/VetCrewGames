import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

/**
 * Базовий набір за CODE-QUALITY-v8 § 6.4.1.
 *
 * До цього три правила зі списку стояли в `'off'` без коментаря, і `npm run
 * lint` давав нуль порушень. Порожній звіт означав не «порушень немає», а
 * «ніхто не питав».
 *
 * Проєкт найменший із семи, і це видно: борг виявився мізерним і його закрито
 * тим самим комітом, а не відкладено в `warn`. Єдиний виняток — навігація:
 * шість посилань міняти без ручної перевірки не варто.
 */
export default ts.config(
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs['flat/recommended'],
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
				// Інжектується Vite через `define` (VERSIONING-v8 § 2, підхід A).
				// Для TypeScript це оголошено в `src/app.d.ts`, але ESLint читає
				// власний список — і без цього рядка `no-undef` у `.svelte`-файлах
				// звітує про змінну, яка на етапі збірки цілком реальна.
				__APP_VERSION__: 'readonly'
			}
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				parser: ts.parser
			}
		}
	},
	{
		rules: {
			// --- Анти-патерни SVELTE-CORE-v8 § 6: ідіоми Svelte 4 та SvelteKit < 2.12.
			// Нуль звернень зараз; без правила наступний `writable()` дав би зелену збірку.
			'no-restricted-imports': [
				'error',
				{
					paths: [
						{
							name: 'svelte/store',
							importNames: ['writable', 'readable', 'derived'],
							message:
								'Svelte 5: стан — $state/$derived у класі-контролері (.svelte.ts). SVELTE-CORE-v8, анти-патерни.'
						},
						{
							name: '$app/stores',
							message:
								'Deprecated із SvelteKit 2.12: `import { page } from "$app/state"`. SVELTE-CORE-v8 § 1.8.'
						}
					]
				}
			],

			// --- SECURITY-v8 § 13. CSP цих конструкцій не дозволяє, тож помилка
			// виявилася б лише в рантаймі у відвідувача. Нуль звернень.
			'no-eval': 'error',
			'no-implied-eval': 'error',
			'no-new-func': 'error',
			'no-script-url': 'error',

			// --- I18N-v8 § 4.3, HIGH. Без аргументу метод бере локаль СИСТЕМИ, а не
			// мову сайту. Одне звернення — у звіті логів — виправлено окремим комітом.
			'no-restricted-syntax': [
				'error',
				{
					selector:
						'CallExpression[arguments.length=0][callee.property.name=/^toLocale(String|DateString|TimeString)$/]',
					message:
						'I18N-v8 § 4.3: передайте локаль явно — без неї береться локаль системи, а не мова сайту.'
				}
			],

			// --- SECURITY-v8 § 5. Файловий виняток нижче; тут правило підняте явно,
			// щоб зміна пресету не зняла його мовчки.
			'svelte/no-at-html-tags': 'error',

			// --- ACCESSIBILITY-v8 § 10.5: a11y-попередження компілятора Svelte.
			'svelte/valid-compile': 'error',

			// --- SVELTE-CORE-v8 § 1.5: голі Set/Map/Date як реактивний стан. Нуль.
			'svelte/prefer-svelte-reactivity': 'error',

			// --- SVELTE-UI-v8 § 1.5, HIGH. Було 3 місця, усі закриті тим самим
			// комітом: ключі взято з полів, які код і так вважає унікальними
			// (номер раунду, `key` пункту меню), а не з першого-ліпшого рядка.
			'svelte/require-each-key': 'error',

			// --- CODE-QUALITY-v8 § 1. Було 3 мертві імпорти — прибрані.
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/ban-ts-comment': 'error',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_?e$',
					ignoreRestSiblings: true
				}
			],

			// --- SEO-v8 § 1.5. Було 6 місць у `warn`; усі шість тепер ідуть через
			// типізований `resolve()`, тож правило підняте до `error` і назад воно
			// вже не опуститься: наступне склеювання `${base} + рядок` дасть червону
			// збірку, а не попередження, яке проґавлять.
			'svelte/no-navigation-without-resolve': 'error'
		}
	},
	{
		/**
		 * SECURITY-v8 § 5.3 — {@html} без санітизації дозволений, коли джерело не
		 * може бути введенням відвідувача.
		 *
		 * Тут джерело одне: `formatFont(t(key))` і `formatFont(td(key))` — розмітка
		 * зі статичних словників `src/lib/i18n/translations/{uk,en}.ts`. Зовнішнього
		 * вводу в проєкті немає взагалі: жодного `<input>` для тексту, жодного
		 * `URLSearchParams`, жодного `fetch()` — перевірено grep-ом по `src/`.
		 *
		 * Виняток файловий, а не глобальний: у решті компонентів новий {@html}
		 * тепер валить збірку.
		 */
		/*
		 * Шаблони глоб-безпечні: квадратні дужки в них означають КЛАС СИМВОЛІВ,
		 * тож буквальний `src/routes/[[lang=lang]]/+page.svelte` не збігається
		 * ні з чим — і тоді вимкнення мовчки не діє на жоден файл. Знайдено
		 * одразу після переїзду маршрутів у мовну групу: lint дав 31 помилку
		 * там, де виняток мав бути.
		 */
		files: [
			'src/lib/components/GameHeader.svelte',
			'src/lib/components/ErrorFallback.svelte',
			'src/routes/+error.svelte',
			'src/routes/+layout.svelte',
			'src/routes/**/+page.svelte'
		],
		rules: {
			'svelte/no-at-html-tags': 'off'
		}
	},
	{
		/**
		 * SEO-v8 § 1.5 дозволяє виносити в окремий блок файли, де посилання не
		 * можуть бути статичними, — «а не глушити поодинці».
		 *
		 * Тут причина інша й сильніша: усі ці посилання ВЖЕ проходять через
		 * `resolve()`, просто не на місці виклику, а всередині `langPath()` з
		 * `$lib/i18n/routing`. Правило синтаксичне й крізь функцію не бачить.
		 *
		 * Централізація тут не поступка, а вимога I18N-v8 § 3.1: політика
		 * мовних адрес живе в ОДНОМУ модулі, бо її читають матчер, layout,
		 * перемикач мови й генератор sitemap. Розсипати `resolve()` по шести
		 * місцях означало б завести шість копій цієї політики.
		 *
		 * Захист від справжньої помилки — склеювання шляху з `base` вручну —
		 * при цьому не втрачений: його тримає інваріант у `src/structure.test.ts`,
		 * який дивиться на ВСІ джерела, зокрема й на ці файли.
		 */
		files: [
			'src/lib/components/GameHeader.svelte',
			'src/lib/components/ErrorFallback.svelte',
			'src/lib/i18n/routing.ts',
			'src/routes/+error.svelte',
			'src/routes/+layout.svelte',
			'src/routes/**/+page.svelte'
		],
		rules: {
			'svelte/no-navigation-without-resolve': 'off'
		}
	},
	{
		ignores: ['build/', '.svelte-kit/', 'dist/']
	},

	/**
	 * STORAGE-NAMESPACE-v8, Крок 3: прямий доступ до Web Storage заборонений.
	 *
	 * Origin спільний із сусідніми проєктами, тож ключ без префікса — це не
	 * дрібниця, а чужі дані. Доти заборона трималася лише на рядку в AGENTS.md,
	 * і три проєкти з восьми вже її порушували, чого не помітив ніхто.
	 *
	 * Правил два, і друге не зайве: `no-restricted-globals` НЕ ловить
	 * `window.localStorage`. Канон у Кроці 3 наводить лише його — а саме ця
	 * форма й трапилася в DigitalWorkshop, тричі поспіль.
	 */
	{
		rules: {
			'no-restricted-globals': [
				'error',
				{ name: 'localStorage', message: 'STORAGE-NAMESPACE-v8: лише через фасад storage.' },
				{ name: 'sessionStorage', message: 'STORAGE-NAMESPACE-v8: лише через фасад storage.' }
			],
			'no-restricted-properties': [
				'error',
				{ object: 'window', property: 'localStorage', message: 'STORAGE-NAMESPACE-v8: лише через фасад storage.' },
				{ object: 'window', property: 'sessionStorage', message: 'STORAGE-NAMESPACE-v8: лише через фасад storage.' }
			]
		}
	},
	{
		// Три категорії, і кожна законна за самим каноном:
		//   1. Фасад — тут прямий доступ Є реалізацією (Крок 3).
		//   2. Модуль міграції — читає ключі БЕЗ префікса, і це єдине легальне
		//      місце, де так можна (Крок 4). Лежить у services/ або utils/
		//      залежно від проєкту, тому шаблон без шляху.
		//   3. Тести фасаду й e2e — вони мусять читати й засівати сирі ключі,
		//      інакше нічим довести, що префікс справді додається.
		files: [
			'src/lib/services/storage.ts',
			'src/lib/services/storage/**',
			'src/lib/config/storage.ts',
			'**/storageMigration.ts',
			'**/storage.test.ts',
			'**/storage.spec.ts',
			'tests/**',
			'e2e/**'
		],
		rules: {
			'no-restricted-globals': 'off',
			'no-restricted-properties': 'off'
		}
	}
);
