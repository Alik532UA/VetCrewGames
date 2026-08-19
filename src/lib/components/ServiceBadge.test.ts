// @vitest-environment node
// Перевірка читає джерела — DOM їй не потрібен.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Службове табло: критерії прийняття як інваріант.
 *
 * **Чому структурна перевірка, а не рендер компонента.** Головні властивості
 * табло — це УМОВИ, а не розмітка: «у проді приховане», «у dev видиме завжди»,
 * «55 натискань». Кожну з них можна зламати одним символом (`dev ||` →
 * `dev &&`), і саме такий злам рендер-тест на одному середовищі не побачить: у
 * jsdom `dev` — одне значення, і друга гілка не виконується взагалі. Умови
 * читаються з джерела точніше, ніж із мока оточення.
 *
 * Поведінка самого жесту перевірена окремо й по-справжньому —
 * `keySequence.test.ts`, дванадцять випадків на чотири захисти.
 */
const BADGE = 'src/lib/components/ServiceBadge.svelte';
const LAYOUT = 'src/routes/+layout.svelte';
const IGNORED = new Set(['node_modules', '.svelte-kit', 'build', 'dist', 'coverage']);

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		if (IGNORED.has(entry)) continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full, out);
		else out.push(full.replace(/\\/g, '/'));
	}
	return out;
}

const badge = readFileSync(BADGE, 'utf8');
const layout = readFileSync(LAYOUT, 'utf8');
const sources = walk('src').filter((f) => /\.(ts|svelte)$/.test(f));

describe('службове табло', () => {
	it('перевірка жива: компонент і layout знайдено', () => {
		expect(badge).toContain('service-badge');
		expect(layout).toContain('<ServiceBadge />');
	});

	it('1. версія й збір логів — ОДИН елемент, а не два', () => {
		/*
		 * Доти в двох нижніх кутах стояли дві накладки для однієї й тієї самої
		 * людини, і права була ще й накрита власною смугою прокрутки: `PageScrollbar`
		 * — це `right: 0` шириною 10–20px із `z-index: 8000`, а версія стояла на
		 * `right: 8px` із `z-index: 1000`.
		 */
		expect(existsSync('src/lib/components/AppVersion.svelte'), 'окремої версії більше немає').toBe(
			false
		);
		expect(
			existsSync('src/lib/components/LogCopyButton.svelte'),
			'окремої кнопки логів більше немає'
		).toBe(false);

		// Один елемент — один локатор. Два елементи з одним `data-testid` дали б
		// тесту два влучання, і він вибрав би перше навмання.
		const withVersionId = sources
			// Сам файл перевірки називає локатор у тексті — інакше він звинувачував би себе.
			.filter((f) => !/\.(test|spec)\.ts$/.test(f))
			.filter((f) => readFileSync(f, 'utf8').includes('data-testid="app-version-value"'));
		expect(withVersionId, 'локатор версії мусить бути рівно в одному місці').toEqual([BADGE]);
	});

	it('2 і 3. типова відповідь різна в dev і в проді', async () => {
		/*
		 * Саме тут потрібен ТРЕТІЙ стан. `boolean` із типовим `false` зробив би
		 * dev-табло прихованим, а типовий `true` показав би його кожному
		 * відвідувачеві проду. Тому «нічого не сказано» — окреме значення.
		 */
		const service = readFileSync('src/lib/services/debugMode.svelte.ts', 'utf8');
		expect(service, 'три стани, а не два').toMatch(/\$state<boolean \| null>\(null\)/);
		expect(service, 'типова відповідь береться зі середовища').toMatch(
			/return this\.override \?\? dev/
		);
		// Видимість — похідна, а не поле стану.
		expect(badge).toMatch(/const isVisible = \$derived\(urlDebug \|\| debugMode\.enabled\)/);
	});

	it('4 і 9. три входи в debug-режим: адреса, сховище, серія натискань', () => {
		// `?debug=1` — єдиний шлях, досяжний із телефона: серію `V` там набрати
		// нічим. Ключ сховища переживає перезавантаження.
		expect(badge, 'адресний параметр').toMatch(/searchParams\.get\('debug'\) === '1'/);
		expect(badge, 'збережений прапорець').toMatch(/debugMode\.enabled/);
		expect(badge, 'серія натискань V').toMatch(/code: 'KeyV'/);

		/*
		 * `?debug=1` мусить діяти ПОВЕРХ збереженого стану, а не разом із ним: інакше
		 * той, хто сховав табло серією натискань, заблокував би собі єдиний шлях,
		 * досяжний із телефона.
		 */
		expect(badge, 'адреса перекриває збережене').toMatch(
			/\$derived\(urlDebug \|\| debugMode\.enabled\)/
		);

		// `browser &&` обов'язковий: під час prerender `page.url.searchParams` кидає
		// й валить збірку цілком.
		expect(badge, 'без browser-guard prerender падає').toMatch(/browser && page\.url/);
	});

	it('4. серія V: 55 щоб показати в проді, 5 щоб сховати', async () => {
		const { SHOW_PRESSES_PROD, HIDE_PRESSES } = await import('$lib/services/debugMode.svelte');
		expect(SHOW_PRESSES_PROD).toBe(55);
		expect(HIDE_PRESSES).toBe(5);

		/*
		 * Поріг ФУНКЦІЄЮ, а не числом. Після спрацювання потрібна відповідь інша:
		 * щойно табло стало видимим, сховати його коштує 5. Число тут означало б, що
		 * поріг зафіксований на момент створення послідовності.
		 */
		expect(badge, 'поріг мусить читатися на кожне натискання').toMatch(
			/threshold: \(\) => debugMode\.pressesToToggle/
		);

		const service = readFileSync('src/lib/services/debugMode.svelte.ts', 'utf8');
		expect(service, 'ховання завжди дешеве').toMatch(
			/if \(this\.enabled\) return HIDE_PRESSES/
		);
		expect(service, 'у dev показати теж дешево — заради скріншота').toMatch(
			/return dev \? HIDE_PRESSES : SHOW_PRESSES_PROD/
		);
		/*
		 * Пишеться `'0'`, а не видаляється ключ: видалення повернуло б стан «нічого
		 * не сказано», і в dev табло зʼявилося б знову після перезавантаження — хоч
		 * людина щойно попросила його сховати.
		 */
		expect(service, 'сховане мусить лишатися схованим після перезавантаження').toMatch(
			/storage\.set\('debug_mode', next \? '1' : '0'\)/
		);
	});

	it('5. клік копіює звіт, і звіт несе версію та стан мережі', () => {
		expect(badge).toMatch(/onclick=\{copyReport\}/);
		// DEBUGGING-v8 § 2.3: без цих двох рядків половина звітів нічого не пояснює.
		expect(badge, 'VERSION у заголовку').toMatch(/VERSION: \$\{logService\.appVersion\}/);
		expect(badge, 'ONLINE у заголовку').toMatch(/ONLINE: \$\{navigator\.onLine\}/);
	});

	it('6. помилки міняють вигляд на червоний лічильник — ПОРУЧ із номером версії', () => {
		expect(badge).toMatch(/class:has-errors=\{logService\.errorCount > 0\}/);
		expect(badge, 'лічильник помилок у розмітці').toMatch(/logService\.errorCount > 99 \? '99\+'/);
		/*
		 * Критерій прийняття № 6 каже «ДОДАЄТЬСЯ лічильник», а № 2 — «на dev табло
		 * завжди видне». Перша версія показувала лічильник ЗАМІСТЬ номера, і разом ці
		 * два пункти виконати було неможливо: на dev-сторінці помилка буває майже
		 * завжди, тож номера версії не було видно саме там, де він потрібен.
		 *
		 * Тому інваріант перевіряє не лише появу лічильника, а й те, що `.version`
		 * стоїть ПОЗА гілками `{#if}` — тобто малюється в усіх трьох станах.
		 */
		const afterBranches = badge.slice(badge.indexOf('{/if}'));
		expect(afterBranches, 'номер версії поза гілками стану').toMatch(
			/<span class="version">\{appVersion\}<\/span>/
		);
		/*
		 * Червоний літералом, а не токеном теми, свідомо: `--color-error` у двох
		 * темах дорівнює #ff6b6b, і білий на ньому дає 2.7:1 при потрібних 4.5.
		 * Сигнал «є помилки» мусить читатися в будь-якій темі.
		 */
		expect(badge, 'зміряний контраст 5.46:1').toMatch(/#c92a2a/);
	});

	it('7 і 8. скидання: 5 натискань у dev, 55 у проді', async () => {
		const { RESET_PRESSES_DEV, RESET_PRESSES_PROD } = await import(
			'$lib/services/resetService'
		);
		expect(RESET_PRESSES_DEV).toBe(5);
		expect(RESET_PRESSES_PROD).toBe(55);
		expect(badge, 'поріг мусить залежати від середовища').toMatch(
			/threshold: dev \? RESET_PRESSES_DEV : RESET_PRESSES_PROD/
		);
		// У проді підтвердження обов'язкове — другий незалежний бар'єр.
		expect(badge, 'hardReset(!dev): у проді питає, у dev ні').toMatch(/hardReset\(!dev\)/);
	});

	it('обидві серії проходять через перевірені захисти', () => {
		/*
		 * Найважливіше в цьому файлі. Жест, написаний прямо в обробнику, — це те, як
		 * він виглядає в `MindStep`: там `KeyR` рахується ВИЩЕ захисту полів вводу, без
		 * фільтра автоповтору й без вікна, тож затиснута `R` у полі пошуку витирає всі
		 * локальні дані за дві секунди без запитання. Тут обидві серії будуються одним
		 * `createKeySequence`, і його захисти покриті дванадцятьма випадками.
		 */
		expect(badge, 'серії мусять створюватися фабрикою, а не рахуватися вручну').toMatch(
			/createKeySequence\(/
		);
		expect(badge, 'власного лічильника натискань у компоненті бути не має').not.toMatch(
			/\+\+\s*;?\s*$|PressCount/m
		);
		expect(existsSync('src/lib/services/keySequence.test.ts'), 'захисти без тестів — побажання').toBe(
			true
		);
	});

	it('таймери й слухачі знімаються при знищенні', () => {
		// Слухач, чия відписка не повертається, переживає перехід між сторінками;
		// таймер, який лишився, спрацює вже після знищення компонента.
		expect(badge).toMatch(/onDestroy\(/);
		expect(badge).toMatch(/versionSequence\.reset\(\)/);
		expect(badge).toMatch(/resetSequence\.reset\(\)/);
	});

	it('доступне ім’я описує ДІЮ і йде через i18n', () => {
		// Доти доступним іменем був сам номер версії — скрінрідер називав число, а не
		// те, що станеться від натискання. `aria-label` не обгортається у
		// `formatPlain()`: та функція міняє кириличну «і» на латинську (AGENTS.md).
		expect(badge).toMatch(/aria-label=\{`\$\{t\('debug\.copyLogs'\)\} — \$\{appVersion\}`\}/);
		expect(badge).not.toMatch(/formatPlain\(/);
	});
});
