// @vitest-environment node
// Перевірка лише читає файли — DOM їй не потрібен.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ЖОДЕН КОМПОНЕНТ НЕ ПОКЛАДАЄТЬСЯ НА ПРИВАТНІ СТИЛІ ІНШОГО (SVELTE-UI-v8 § 3.5).
 *
 * ## Що це за клас дефекту
 *
 * Стилі Svelte скоупляться: правило `.card` у `A.svelte` компілюється в
 * `.card.svelte-xyz` і діє лише на розмітку самого `A`. Виносиш шматок розмітки
 * у `B.svelte` — і клас їде з ним, а правило лишається в `A`. Компонент
 * працює, розмітка правильна, класи на місці, і виглядає він зламаним.
 *
 * **Компілятор про це мовчить, і саме тому потрібен гейт.** `Unused CSS
 * selector` тут не спрацьовує: у `A` селектор далі використовується власною
 * розміткою, тобто мертвим не став. А в `B` немає нічого, що можна було б
 * назвати помилкою: клас у розмітці — це просто рядок.
 *
 * Пакет називає цю перевірку серед обовʼязкових (SVELTE-UI-v8 § 4, рядок
 * «vitest — стилі компонентів» у зведенні гейтів README), і в цьому проєкті її
 * не було. Порушень нуль — і саме тому вона ставиться зараз: правило, у якого
 * нуль звернень, ставиться в `error`, бо такий гейт стан ТРИМАЄ, а не фіксує
 * (CODE-QUALITY-v8 § 6.4.1).
 *
 * ## Чому перевірка навмисно вузька
 *
 * Правило «кожен клас має мати оголошення» дало б десятки спрацювань на
 * семантичних іменах без стилів. Тут таких два — `.segmented-control` і
 * `.scoreboard__player`, — і жодне не є дефектом. Сигнал вважається дефектом
 * лише коли правило ІСНУЄ, але в іншому компоненті, куди скоуп не дістає.
 */

const SEPARATOR = String.fromCharCode(92);
const STYLE_BLOCK = /<style[^>]*>([\s\S]*?)<\/style>/g;

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full, out);
		else out.push(full.split(SEPARATOR).join('/'));
	}
	return out;
}

const all = walk('src');
const components = all.filter((f) => f.endsWith('.svelte'));
const read = (file: string) => readFileSync(file, 'utf8');

/**
 * Класи, оголошені у `<style>` компонента ПРИВАТНО.
 *
 * Те, що стоїть усередині `:global(…)`, звідси виключене — і це не дрібниця:
 * такий селектор скоуп НЕ отримує, тобто законно фарбує чужу розмітку. Без
 * цього кроку перевірка називала б дефектом рівно той спосіб, яким Svelte
 * дозволяє стилізувати ззовні.
 */
function privateClasses(source: string): Set<string> {
	const found = new Set<string>();
	for (const block of source.matchAll(STYLE_BLOCK)) {
		const css = block[1].replace(/:global\(([\s\S]*?)\)/g, ' ');
		for (const match of css.matchAll(/\.([a-zA-Z][\w-]*)/g)) found.add(match[1]);
	}
	return found;
}

/** Класи, оголошені через `:global(…)`, — тобто нічиї, доступні всім. */
function globalClasses(source: string): Set<string> {
	const found = new Set<string>();
	for (const block of source.matchAll(STYLE_BLOCK)) {
		for (const escape of block[1].matchAll(/:global\(([\s\S]*?)\)/g)) {
			for (const match of escape[1].matchAll(/\.([a-zA-Z][\w-]*)/g)) found.add(match[1]);
		}
	}
	return found;
}

/**
 * Розмітка без шуму: `script`, `style` і коментарі знімаються ПЕРЕД пошуком.
 *
 * Заміряно, чому це не перестраховка: у докблоці `ui/SegmentedChoice.svelte`
 * процитовано `class="segmented-control"` — зразок із сусіднього проєкту. Без
 * зняття коментарів перевірка бачила б клас у розмітці, якого там немає.
 */
function markupOf(source: string): string {
	return source
		.replace(/<script[^>]*>[\s\S]*?<\/script>/g, ' ')
		.replace(STYLE_BLOCK, ' ')
		.replace(/<!--[\s\S]*?-->/g, ' ');
}

/**
 * Класи, які компонент справді вішає на елементи.
 *
 * Береться і `class="…"`, і директива `class:назва={…}`. Пакет у зразку бере
 * лише статичні; тут ширше, бо ціна нульова (обидва набори дають нуль
 * порушень), а директива рветься при винесенні розмітки так само — саме нею
 * в `game-memory` стоїть `scoreboard__player--turn`.
 *
 * Токен із фігурними дужками — це вставлений вираз, а не імʼя класу, і він
 * відкидається: `class="card {extra}"` дає `card`.
 */
function usedClasses(markup: string): Set<string> {
	const found = new Set<string>();
	for (const attribute of markup.matchAll(/class="([^"]*)"/g)) {
		for (const token of attribute[1].split(/\s+/)) {
			if (token && !/[{}]/.test(token)) found.add(token);
		}
	}
	for (const directive of markup.matchAll(/class:([a-zA-Z][\w-]*)/g)) found.add(directive[1]);
	return found;
}

/** Усе, що оголошено поза компонентами, — теми, скидання, анімації. */
const sharedCss = all
	.filter((f) => f.startsWith('src/lib/styles/') && f.endsWith('.css'))
	.map(read)
	.join('\n');

const owned = new Map(components.map((file) => [file, privateClasses(read(file))]));
const shared = new Set(components.flatMap((file) => [...globalClasses(read(file))]));

describe('стилі компонентів (SVELTE-UI-v8 § 3.5)', () => {
	it('перевірка жива: компоненти, класи й спільні стилі знайдено', () => {
		/*
		 * Три числа, а не одне. Порожній список компонентів, порожній список
		 * класів і порожній спільний CSS дають той самий зелений результат — і
		 * кожен означає, що перевірка міряє порожнечу, а не чистоту.
		 *
		 * Межі вдвічі нижчі за заміряне на момент коміту (131 компонент, 818
		 * класів у розмітці): не падають від звичайного росту чи скорочення
		 * дерева, але порожнечу називають.
		 */
		const classes = components.reduce(
			(sum, file) => sum + usedClasses(markupOf(read(file))).size,
			0
		);
		expect(components.length, 'компонентів не знайдено').toBeGreaterThan(60);
		expect(classes, 'класів у розмітці не знайдено').toBeGreaterThan(400);
		expect(sharedCss.length, 'спільні стилі не прочитані').toBeGreaterThan(1000);
	});

	it('жоден компонент не покладається на приватні стилі іншого', () => {
		const problems: string[] = [];

		for (const file of components) {
			for (const cls of usedClasses(markupOf(read(file)))) {
				if (owned.get(file)?.has(cls)) continue; // стилізує сам
				if (shared.has(cls)) continue; // оголошений через :global()
				if (sharedCss.includes(`.${cls}`)) continue; // або в спільних стилях

				// Правило існує — але в ІНШОМУ компоненті, куди скоуп не дістає.
				const elsewhere = components.filter((other) => owned.get(other)?.has(cls));
				if (elsewhere.length > 0) {
					problems.push(`${file}: .${cls} стилізує ${elsewhere.join(', ')}`);
				}
			}
		}

		expect(
			problems,
			`клас у розмітці одного компонента, а правило — у <style> іншого:\n${problems.join('\n')}`
		).toEqual([]);
	});
});
