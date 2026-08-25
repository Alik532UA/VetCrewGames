// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ГАРЯЧІ КЛАВІШІ: ЧОТИРИ ЗАХИСТИ Й `event.code` — інваріантом, а не оком.
 *
 * ## Чому цей файл зʼявився
 *
 * Правила канону про скорочення вже виконані: `acceptsShortcut` тримає всі
 * захисти, `keySequence` — свої, вимикач WCAG SC 2.1.4 стоїть у шапці й
 * записаний у `PROJECT-CONTEXT.md`. Чого не було — гейта, тобто способу
 * дізнатися, що НАСТУПНИЙ обробник їх забув.
 *
 * Канон називає це прямо: два правила про скорочення мають рівень CRITICAL
 * (`HK-TEXT-ENTRY-GUARD`, `HK-WCAG-CHARACTER-KEY`) і обидва мусять
 * перевірятися `GATE-HOTKEYS`. У проєкті такого гейта не існувало: юніт-тести
 * `keyboard.test.ts` доводять, що САМІ ФУНКЦІЇ захистів працюють, але не те, що
 * їх хтось викликає.
 *
 * Різниця не теоретична. Третій слухач на `svelte:window` — це три рядки, і
 * забути в них `acceptsShortcut` легко: усе працює, тести зелені, а людина, яка
 * диктує текст голосом, отримує перемикання теми на кожній літері «т».
 *
 * ## Що саме перевіряється
 *
 * Джерела, а не поведінка: гейт читає розмітку й шукає слухачів клавіш на ВІКНІ
 * (`svelte:window onkeydown`, `window.addEventListener('keydown')`). Для
 * кожного знайденого він вимагає, щоб у тому ж файлі стояв один із двох
 * дозволених захистів — `acceptsShortcut` або `keySequence` (той усередині
 * тримає `repeat`, поля вводу й модифікатори).
 *
 * Локальні обробники (на кнопці, у меню) сюди не входять навмисно: вони діють
 * лише коли фокус на самому елементі, і критерій SC 2.1.4 їх не стосується —
 * там літера не «висить на вікні», а адресована тому, хто її отримав.
 *
 * ## Межа, названа прямо
 *
 * Гейт не доводить, що вимикач справді доходить до прапорця на живій сторінці —
 * це записано в `PROJECT-CONTEXT.md` як ручна перевірка. Він доводить рівно
 * одне: жоден віконний обробник не лишився без захисту, і жодне літерне
 * скорочення не читається з `event.key`.
 *
 * Зворотний експеримент (AI-AGENT-PITFALLS-v8 § 1.1): прибрати
 * `acceptsShortcut` із `HeaderControls` — червоніє «кожен слухач на вікні має
 * захист»; замінити `event.code === 'KeyT'` на `event.key === 't'` — червоніє
 * «літерні скорочення читаються з `event.code`». Обидва зроблені.
 */

function sources(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			if (['node_modules', '.svelte-kit', 'build'].includes(entry)) continue;
			sources(full, out);
		} else if (entry.endsWith('.svelte') || entry.endsWith('.ts')) {
			out.push(full.split(String.fromCharCode(92)).join('/'));
		}
	}
	return out;
}

const isTest = (file: string) => /\.(test|spec)\.ts$/.test(file);

/** Слухач клавіш на ВІКНІ — саме той, що ловить літери під час набору тексту. */
const WINDOW_KEY_LISTENER = /<svelte:window[^>]*onkeydown|window\.addEventListener\(\s*['"]keydown/;

/**
 * Захисти, які приймаються.
 *
 * `acceptsShortcut` — повний набір (модифікатори, вимикач, поля вводу).
 * `createKeySequence` — свій набір для службових жестів (`repeat`, поля, вікно
 * скидання); він теж зводиться до `isPlainKey`/`isTypingTarget`, і саме тому
 * стоїть тут другим дозволеним варіантом, а не винятком.
 *
 * Шукається саме ВИКЛИК, із дужкою. Перша редакція шукала імʼя — і зворотний
 * експеримент показав, що вона нічого не ловить: прибраний виклик лишає по собі
 * рядок імпорту, і перевірка бачила його як захист. Тобто вона була зеленою на
 * коді, де захисту вже немає, — рівно той різновид перевірки, який канон
 * називає гіршим за відсутність.
 */
const GUARDS = ['acceptsShortcut(', 'createKeySequence('];

describe('гарячі клавіші (HOTKEYS-v8)', () => {
	const files = sources('src').filter((file) => !isTest(file));
	const withWindowKeys = files.filter((file) =>
		WINDOW_KEY_LISTENER.test(readFileSync(file, 'utf8'))
	);

	it('перевірка жива: слухачі клавіш на вікні знайдені', () => {
		expect(
			withWindowKeys.length,
			'жодного слухача не знайдено — перевірка дивиться не туди'
		).toBeGreaterThan(0);
	});

	/**
	 * ГОЛОВНЕ ПРАВИЛО (`HK-TEXT-ENTRY-GUARD`, CRITICAL): обробник на вікні виходить,
	 * коли фокус у полі вводу. Інакше набір тексту виконує команди.
	 */
	it('кожен слухач на вікні має захист полів вводу', () => {
		const naked = withWindowKeys.filter((file) => {
			const text = readFileSync(file, 'utf8');
			return !GUARDS.some((guard) => text.includes(guard));
		});
		expect(
			naked,
			`слухач клавіш без захисту — набір тексту виконуватиме команди:\n${naked.join('\n')}`
		).toEqual([]);
	});

	/**
	 * `HK-EVENT-CODE` (HIGH): на нелатинській розкладці `event.key` віддає інший
	 * символ, і скорочення просто зникає. `code` описує фізичну клавішу.
	 *
	 * Перевіряються саме ЛІТЕРНІ порівняння: `event.key === 'Escape'` чи
	 * `'Enter'` законні — це не літери, і на будь-якій розкладці вони ті самі.
	 */
	it('літерні скорочення читаються з event.code, а не з event.key', () => {
		const letters = /\.key\s*===\s*['"][a-zа-яіїєґ]['"]/i;
		const guilty = files
			.filter((file) => letters.test(readFileSync(file, 'utf8')))
			.map((file) => `${file}: порівняння з event.key на літері`);
		expect(
			guilty,
			`на нелатинській розкладці таке скорочення зникає:\n${guilty.join('\n')}`
		).toEqual([]);
	});

	/**
	 * `HK-WCAG-CHARACTER-KEY` (CRITICAL): одиночне літерне скорочення мусить
	 * вимикатися. Проєкт обрав шлях 1 — вимикач `settings.shortcutsEnabled`, і
	 * саме тому кожен віконний обробник мусить його ЧИТАТИ.
	 *
	 * Перевіряється наявність прапорця у файлі, а не його правильне вживання:
	 * доводити останнє довелося б прогоном на живій сторінці, і це записано в
	 * `PROJECT-CONTEXT.md` як ручний пункт. Але забути прапорець ЗОВСІМ — саме та
	 * помилка, яку ловить текст.
	 */
	it('кожен слухач на вікні читає вимикач скорочень', () => {
		const naked = withWindowKeys.filter(
			(file) => !readFileSync(file, 'utf8').includes('shortcutsEnabled')
		);
		expect(
			naked,
			`скорочення поза вимикачем — це порушення WCAG SC 2.1.4 рівня A:\n${naked.join('\n')}`
		).toEqual([]);
	});

	/**
	 * Скорочення мусить бути ВИЯВНИМ (`HK-DISCOVERABILITY`): підпис, довідка або
	 * `aria-keyshortcuts`. Тут перевіряється найдешевша з трьох ознак — атрибут:
	 * він же єдиний, що доходить до читалки.
	 */
	it('скорочення оголошені для читалки', () => {
		const declared = files.filter((file) =>
			readFileSync(file, 'utf8').includes('aria-keyshortcuts')
		);
		expect(
			declared.length,
			'жодне скорочення не оголошене — про них не дізнається ні читалка, ні людина'
		).toBeGreaterThan(0);
	});
});
