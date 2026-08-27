// @vitest-environment node
// Перевірка лише читає файли — DOM їй не потрібен.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `auto-fit` ІЗ ГОЛОЮ ДОВЖИНОЮ В МІНІМУМІ (FLUID-SIZING-v8 § 1.1, CRITICAL).
 *
 * ## Чому це анти-патерн, який читається як правильний код
 *
 * `repeat(auto-fit, minmax(18rem, 1fr))` каже «колонка не вужча за 18rem, далі
 * росте», і слово «мінімум» тут буквальне: коли контейнер вужчий за 18rem,
 * колонка однаково лишається 288px, а вміст вилазить за сітку. `auto-fit` не
 * рятує — він прибирає ПОРОЖНІ колонки, а не звужує наявну.
 *
 * Правильна форма — `minmax(min(18rem, 100%), 1fr)`: число лишається порогом
 * переносу й перестає бути підлогою ширини.
 *
 * ## Що знайшлося, коли перевірку писали
 *
 * Два місця, і одне з них живе: `reserve/BiomePicker` на вікні 320 давав
 * колонку 288px у полі 260px (заміряно Playwright на зібраному сайті), тобто
 * картка стояла на 28px за краєм власної панелі; на 280 — 68px. Друге,
 * `reserve/DevPanel`, ще нікого не зачепило.
 *
 * ## Свідоме звуження, і чому воно саме таке
 *
 * § 1.1 формулює ширше: «мінімум у `minmax()` — завжди `min(Npx, 100%)`, ніколи
 * гола довжина». Ця перевірка вимагає цього лише від `auto-fit` / `auto-fill`.
 *
 * Причина — у різниці задач. В `auto-fit` число вирішує, СКІЛЬКИ буде колонок,
 * і підлога там завжди помилка. У сітці з фіксованим переліком колонок
 * (`minmax(92px, 1.25fr) minmax(76px, 1fr) …` у `FeedingBoard`) число — це
 * заявлена ширина відомої колонки, і `min(92px, 100%)` там нічого не дає:
 * `100%` рахується від усієї сітки, а не від частки колонки.
 *
 * Ту сітку сюди НЕ включено ще й тому, що її поведінку на 280px заміряти не
 * вдалося: дошка «Що їмо?» з'являється лише після початку партії, тобто
 * потребує сценарного прогону, а не читання джерел. Рішення «три колонки на
 * будь-якій ширині» записане в PROJECT-CONTEXT.md, і міняти його наосліп
 * гірше, ніж лишити як є. Перевірити це — окрема робота з назвою: пройти
 * `game-feeding` до дошки в `tests/reflow.spec.ts`.
 */

const SEPARATOR = String.fromCharCode(92);

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full, out);
		else if (/\.(svelte|css)$/.test(entry)) out.push(full.split(SEPARATOR).join('/'));
	}
	return out;
}

const sources = walk('src');

/**
 * Коментарі замінюються ПРОБІЛАМИ, а не вирізаються.
 *
 * Канон називає цей крок прямо, і причина в нього подвійна. Перше: коментар,
 * який пояснює анти-патерн, мусить його процитувати — і перший прогін падає на
 * власній документації (тут саме так і сталося б: обидві виправлені сітки
 * цитують поламану форму поруч). Друге: заміна на пробіли зберігає номери
 * рядків, і звіт указує туди, де справді стоїть правило.
 */
function blankComments(source: string): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
		.replace(/<!--[\s\S]*?-->/g, (block) => block.replace(/[^\n]/g, ' '));
}

/** `repeat(auto-fit|auto-fill, minmax(<гола довжина>, …))`. */
const BARE_FLOOR = /repeat\(\s*auto-(?:fit|fill)\s*,\s*minmax\(\s*(-?[\d.]+(?:px|rem|em|ch|vw))/g;

describe('текуча розкладка (FLUID-SIZING-v8 § 1.1)', () => {
	it('перевірка жива: джерела зі стилями знайдено', () => {
		const withGrid = sources.filter((f) => /grid-template-columns/.test(readFileSync(f, 'utf8')));
		expect(sources.length, 'сканер шукає не там').toBeGreaterThan(80);
		expect(withGrid.length, 'жодної сітки — сканер читає не те').toBeGreaterThan(5);
	});

	it('перевірка жива: розбір відрізняє голу довжину від min()', () => {
		// Без цього твердження перевірка могла б бути зеленою через зламану
		// регулярку, а не через чистий код (AI-AGENT-PITFALLS-v8 § 1.1).
		const bad = 'grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));';
		const good = 'grid-template-columns: repeat(auto-fit, minmax(min(18rem, 100%), 1fr));';
		expect([...bad.matchAll(BARE_FLOOR)].length, 'поламану форму не впізнано').toBe(1);
		expect([...good.matchAll(BARE_FLOOR)].length, 'правильну форму названо поламаною').toBe(0);
	});

	it('жоден auto-fit не бере голу довжину мінімумом', () => {
		const bad: string[] = [];
		for (const file of sources) {
			const source = blankComments(readFileSync(file, 'utf8'));
			for (const match of source.matchAll(BARE_FLOOR)) {
				const line = source.slice(0, match.index ?? 0).split('\n').length;
				bad.push(
					`${file}:${line} — minmax(${match[1]}, …); треба minmax(min(${match[1]}, 100%), …)`
				);
			}
		}
		expect(
			bad,
			`число стало підлогою ширини, а не порогом переносу — вміст вилазить за сітку:\n${bad.join('\n')}`
		).toEqual([]);
	});
});
