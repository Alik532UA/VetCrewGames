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
				...globals.node
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

			// --- Борг ---
			// SEO-v8 § 1.5. 6 місць. resolve() типізований проти списку реальних
			// маршрутів, тож помилка в адресі стає помилкою компіляції — але сама
			// заміна міняє навігацію, а перевірити її можна лише руками. Тому warn
			// із числом, а не тихе `off`: число має лише зменшуватися.
			'svelte/no-navigation-without-resolve': 'warn'
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
		files: [
			'src/lib/components/GameHeader.svelte',
			'src/routes/+error.svelte',
			'src/routes/+page.svelte',
			'src/routes/game-mythbusters/+page.svelte',
			'src/routes/game-population/+page.svelte'
		],
		rules: {
			'svelte/no-at-html-tags': 'off'
		}
	},
	{
		ignores: ['build/', '.svelte-kit/', 'dist/']
	}
);
