// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * ДВА ВІКНА ЗАПОВІДНИКА НЕ НАЛАЗЯТЬ ОДНЕ НА ОДНЕ — і числа про це не розходяться.
 *
 * ## Що це за клас дефектів
 *
 * Скарга автора: «іноді вікна можуть налазити один на одне». Налазили вони на
 * будь-якій ширині: картка мапи сидить у `left: var(--space-sm)`, а панель
 * спливає над своєю кнопкою — і «Мешканці» це найлівіша кнопка смуги, тож після
 * затиску `clamp` панель ставала теж у лівий край.
 *
 * Полагоджено НЕ закриттям: панель обходить картку (`.sheet--beside`), а там, де
 * вони фізично не вміщаються поруч, новіше вікно закриває старе.
 *
 * ## Чому перевірка саме про ЧИСЛА
 *
 * Обхід тримається на трьох числах у трьох різних файлах:
 *
 *  * ширина картки — `MapCard.svelte`;
 *  * скільки місця панель відводить ліворуч і на скільки сама стискається —
 *    `BottomSheet.svelte`;
 *  * межа, нижче якої поруч не стають зовсім — `ReserveGame.svelte`.
 *
 * CSS не вміє посилатися на чуже правило, а медіазапит — на CSS-змінну з іншого
 * файлу. Тобто число НЕМИНУЧЕ повторюється, і саме такі повтори розходяться:
 * досить розширити картку на 2rem, і панель почне налазити знову — тихо, бо
 * жоден інший гейт ширин не міряє.
 *
 * Зворотні експерименти (AI-AGENT-PITFALLS-v8 § 1.1): картку розширено до
 * `min(24rem, …)` — червоніє «панель відводить під картку саме її ширину»;
 * межу опущено до 48rem — червоніє «межа не менша за суму». Обидва зроблені.
 */

const CARD = 'src/lib/components/reserve/MapCard.svelte';
const SHEET = 'src/lib/components/reserve/BottomSheet.svelte';
const PAGE = 'src/lib/components/reserve/ReserveGame.svelte';

const read = (path: string) => readFileSync(path, 'utf8');

/** `--space-sm` у `global.css`: проміжок між вікнами й до країв. */
function gapRem(): number {
	const value = read('src/lib/styles/global.css').match(/--space-sm:\s*([\d.]+)rem/)?.[1];
	expect(value, 'у global.css немає --space-sm').toBeTruthy();
	return Number(value);
}

/** Ширина картки мапи з її власного правила. */
function cardRem(): number {
	const rule = read(CARD).match(/\.mapcard\s*\{[\s\S]*?\n\t\}/)?.[0];
	expect(rule, 'у MapCard немає правила .mapcard').toBeTruthy();
	const value = (rule as string).match(/width:\s*min\(([\d.]+)rem/)?.[1];
	expect(value, 'ширина .mapcard не задана як min(Nrem, …)').toBeTruthy();
	return Number(value);
}

describe('вікна заповідника стоять поруч, а не одне на одному', () => {
	const sheet = read(SHEET);
	const page = read(PAGE);

	it('перевірка жива: обхід і межа знайдені', () => {
		expect(sheet, 'у BottomSheet немає правила .sheet--beside').toContain('.sheet--beside');
		expect(page, 'у ReserveGame немає межі ширини').toMatch(/new MediaQuery\('\(min-width:/);
		expect(cardRem()).toBeGreaterThan(0);
		expect(gapRem()).toBeGreaterThan(0);
	});

	it('панель відводить під картку саме її ширину', () => {
		const beside = sheet.match(/\.sheet--beside\s*\{[\s\S]*?\n\t\}/)?.[0];
		expect(beside, 'правило .sheet--beside не розібралося').toBeTruthy();

		const avoid = (beside as string).match(/--sheet-avoid:\s*calc\(([\d.]+)rem/)?.[1];
		expect(avoid, 'у .sheet--beside немає --sheet-avoid').toBeTruthy();
		expect(Number(avoid), 'панель обходить не ту ширину, яку має картка').toBe(cardRem());

		// Панель ще й стискається на ту саму ширину — інакше вона впиралася б у
		// правий край, і `clamp` повернув би її назад під картку.
		const shrunk = (beside as string).match(/--sheet-w:[\s\S]*?100vw - ([\d.]+)rem/)?.[1];
		expect(shrunk, 'у .sheet--beside не стискається --sheet-w').toBeTruthy();
		expect(Number(shrunk), 'стискається не на ширину картки').toBe(cardRem());
	});

	it('межа «поруч не вміщаються» не менша за суму двох вікон і проміжків', () => {
		const limit = page.match(/new MediaQuery\('\(min-width:\s*([\d.]+)rem\)'\)/)?.[1];
		expect(limit, 'межу в ReserveGame не розібрано').toBeTruthy();

		const base = sheet.match(/--sheet-w:\s*min\(([\d.]+)rem/)?.[1];
		expect(base, 'базову ширину панелі не розібрано').toBeTruthy();

		// Три проміжки: до картки, між вікнами, після панелі.
		const needed = cardRem() + Number(base) + 3 * gapRem();
		expect(
			Number(limit),
			`нижче ${needed}rem вікна поруч не стоять, а межа ${limit}rem дозволяє`
		).toBeGreaterThanOrEqual(needed);
	});

	it('обидва напрямки закриття описані, а не лише один', () => {
		/*
		 * Правило «новіше вікно виграє» мусить діяти в ОБА боки. Половина його —
		 * це вікно, яке лишається під новим: людина тицьнула в кнопку панелі, а
		 * бачить картку, якої не викликала.
		 */
		expect(page, 'відкриття картки не закриває панель').toMatch(
			/sideBySide\.current\) panel = null/
		);
		expect(page, 'відкриття панелі не знімає вибір').toMatch(
			/sideBySide\.current\) game\.clearSelection\(\)/
		);
	});
});
