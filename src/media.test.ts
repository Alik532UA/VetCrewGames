// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Атрибути зображень і шрифтів по джерелах (PERFORMANCE-v8 § 10.2).
 *
 * Три властивості, які канон вимагає прямо і яких доти не тримало ніщо. Спільна
 * риса всіх трьох: порушення не ламає нічого видимого. Сторінка малюється,
 * збірка зелена, `svelte-check` мовчить — просто трохи гірше, і саме тому це
 * живе роками.
 *
 *   1. **`width`/`height` на кожному `<img>`** — інакше CLS: браузер не знає
 *      висоти, поки не приїхав файл, і решта сторінки стрибає під ним. На
 *      машині розробника з локальним кешем це не видно НІКОЛИ.
 *   2. **`loading="lazy"` разом із `fetchpriority="high"`** — суперечність у
 *      двох атрибутах одного тега: один просить відкласти, другий — поспішити.
 *      Браузер поважає перший, і пріоритет стає декоративним.
 *   3. **`font-display` у кожному `@font-face`** — без нього шрифт блокує текст
 *      на час завантаження (у Chrome — до 3 с порожнечі замість системного
 *      накреслення).
 *
 * Станом на момент написання всі три зелені, і це не робить перевірку зайвою:
 * доти зелений стан ніхто не тримав, а `<img>` у цьому проєкті додають разом із
 * кожною новою грою.
 *
 * Зворотний експеримент (AI-AGENT-PITFALLS-v8 § 1.1): прибрати `height` у
 * `MemoryCard.svelte` — перевірка червона й називає файл і тег; прибрати
 * `font-display` з `@font-face` для inglobal — червона й називає шрифт.
 * Виконано, обидва разом.
 */

const ROOT = process.cwd().replace(/\\/g, '/');
const IGNORED = new Set(['node_modules', '.svelte-kit', 'build', 'dist', 'coverage']);

function walk(dir: string, keep: (name: string) => boolean, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		if (IGNORED.has(entry)) continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full, keep, out);
		else if (keep(entry)) out.push(full.replace(/\\/g, '/').replace(`${ROOT}/`, ''));
	}
	return out;
}

const read = (file: string) => readFileSync(file, 'utf8');

/** Розмітка без коментарів: у поясненнях тут цитуються теги, які ж і перевіряються. */
const markup = (source: string) => source.replace(/<!--[\s\S]*?-->/g, '');

const svelteFiles = walk('src', (name) => name.endsWith('.svelte'));
const cssFiles = walk('src', (name) => name.endsWith('.css'));

/** Кожен тег `<img …>` з файлу, разом із файлом, у якому він знайдений. */
const images = svelteFiles.flatMap((file) =>
	[...markup(read(file)).matchAll(/<img\s[^>]*?\/?>/g)].map((m) => ({ file, tag: m[0] }))
);

describe('перевірка жива', () => {
	it('знайдено зображення і файли стилів', () => {
		expect(svelteFiles.length).toBeGreaterThan(20);
		// Число не з голови: стільки `<img>` у джерелах на момент написання.
		// Впаде, якщо регулярка перестане їх знаходити — тоді решта перевірок
		// стала б зеленою на нулі знахідок.
		expect(images.length).toBeGreaterThan(10);
		expect(cssFiles.length).toBeGreaterThan(0);
	});
});

describe('зображення (§ 3.2, § 10.2)', () => {
	it('кожен <img> має width і height — інакше CLS', () => {
		const bad = images
			.filter(({ tag }) => !/\bwidth=/.test(tag) || !/\bheight=/.test(tag))
			.map(({ file, tag }) => `${file}: ${tag.replace(/\s+/g, ' ').slice(0, 80)}`);
		expect(bad, `без width/height:\n${bad.join('\n')}`).toEqual([]);
	});

	it('lazy і fetchpriority="high" не стоять на одному тезі (§ 3.1)', () => {
		const bad = images
			.filter(
				({ tag }) => /loading="lazy"/.test(tag) && /fetchpriority="high"/.test(tag)
			)
			.map(({ file, tag }) => `${file}: ${tag.replace(/\s+/g, ' ').slice(0, 80)}`);
		expect(
			bad,
			`один атрибут просить відкласти, другий — поспішити; браузер поважає перший:\n${bad.join('\n')}`
		).toEqual([]);
	});

	/**
	 * Канон каже «на сторінці одне зображення з `fetchpriority="high"`». По
	 * джерелах сторінка не збирається — вона складається з layout і компонентів,
	 * тому межа тут на ФАЙЛ, і це свідомо слабша перевірка.
	 *
	 * Слабша, але не марна: два пріоритетні зображення в одному компоненті — це
	 * завжди помилка (обидва в тому самому кадрі), а компонентів із пріоритетом у
	 * проєкті рівно стільки, скільки ігор із головним зображенням раунду. Те, що
	 * НЕ перевіряється, — сторінка, яка змонтувала два таких компоненти
	 * одночасно; для цього потрібен браузер, а Playwright тут не стоїть.
	 */
	it('не більше одного fetchpriority="high" на файл', () => {
		const counts = new Map<string, number>();
		for (const { file, tag } of images) {
			if (!/fetchpriority="high"/.test(tag)) continue;
			counts.set(file, (counts.get(file) ?? 0) + 1);
		}
		const bad = [...counts.entries()]
			.filter(([, n]) => n > 1)
			.map(([file, n]) => `${file}: ${n} зображень із пріоритетом — він знецінюється`);
		expect(bad, bad.join('\n')).toEqual([]);
	});
});

describe('шрифти (§ 2, § 10.2)', () => {
	it('кожен @font-face має font-display', () => {
		const bad: string[] = [];
		for (const file of cssFiles) {
			const css = read(file).replace(/\/\*[\s\S]*?\*\//g, '');
			for (const block of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
				if (/font-display\s*:/.test(block[1])) continue;
				const family = block[1].match(/font-family\s*:\s*([^;]+);/)?.[1]?.trim() ?? '?';
				bad.push(`${file}: @font-face ${family} — текст блокується, поки шрифт їде`);
			}
		}
		expect(bad, bad.join('\n')).toEqual([]);
	});

	it('знайдено хоч один @font-face — перевірка жива', () => {
		const total = cssFiles.reduce(
			(sum, file) => sum + [...read(file).matchAll(/@font-face/g)].length,
			0
		);
		expect(total, 'жодного @font-face — перевірка вище нічого не міряє').toBeGreaterThan(0);
	});
});
