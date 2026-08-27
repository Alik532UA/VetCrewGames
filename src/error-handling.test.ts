// @vitest-environment node
// Перевірка лише читає файли — DOM їй не потрібен.
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Два анти-патерни ERROR-HANDLING-v8 рівня HIGH, під якими не було гейта.
 *
 * ## Що саме ловиться
 *
 * 1. `throw 'рядок'` — губиться stack trace й ламається `instanceof`. Звернень
 *    нуль; правило, у якого нуль звернень, ставиться в `error`, бо такий гейт
 *    стан ТРИМАЄ, а не фіксує (CODE-QUALITY-v8 § 6.4.1).
 * 2. `catch {}`, який не робить і не каже нічого. Збій зникає без сліду: ні
 *    запису, ні пояснення, чому запису не треба.
 *
 * ## Свідоме звуження другого правила, і чому воно записане
 *
 * Пакет формулює строгіше: анти-патерном названо `catch { /* мовчки *\/ }` —
 * тобто коментар від порушення не рятує, треба ЛОГУВАТИ. Тут перевірка вимагає
 * не запису в журнал, а написаної причини, і це відхилення, а не недогляд.
 *
 * Підстава — самі вісім місць, які тут є. Сім із них ловлять збій, про який
 * `logService` не має чого сказати: `setPointerCapture` на доріжці завширшки
 * 10px (жест і так несе слухач на `window`), `releasePointerCapture` уже знятого
 * вказівника, і чотири кроки аварійного скидання, після якого сторінка
 * перезавантажується разом із самим журналом. Запис там дав би рядки, які ніхто
 * не читає, — а § 1.4 пакета питає рівно навпаки: «чи хочу я бачити індикатор
 * помилки, коли в користувача просто зникла мережа?».
 *
 * Восьме — `net/presence.setHover` — інше: це мережевий запис, і мовчання там
 * коштує діагностики. Але кличеться воно на КОЖНЕ наведення картки, тож запис
 * на кожну невдачу переповнив би буфер журналу рівно тоді, коли мережа лежить,
 * тобто саме тоді, коли журнал і знадобиться.
 *
 * Тому межа проведена по перевірності: «нічого не робить І нічого не пояснює» —
 * порушення завжди; «нічого не робить, але пояснює чому» — рішення, яке видно в
 * діффі й можна оскаржити. Записано в PROJECT-CONTEXT.md, «Свідомі відхилення».
 */

const SEPARATOR = String.fromCharCode(92);

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full, out);
		else if (/\.(ts|svelte)$/.test(entry)) out.push(full.split(SEPARATOR).join('/'));
	}
	return out;
}

const sources = walk('src').filter((f) => !/\.(test|spec)\.(ts|svelte)$/.test(f));

/**
 * Коментарі знімаються ПЕРЕД пошуком `throw`, інакше перевірка знайде власну
 * документацію: анти-патерн процитований прозою і в цьому файлі, і в кількох
 * докблоках проєкту.
 *
 * Для порожнього `catch` те саме зняття, навпаки, зробило б перевірку СТРОГІШОЮ
 * за домовлену — тому там текст читається сирим.
 */
function withoutComments(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1 ');
}

describe('обробка помилок (ERROR-HANDLING-v8 § 7)', () => {
	it('перевірка жива: джерела знайдено', () => {
		expect(sources.length, 'сканер шукає не там').toBeGreaterThan(200);
	});

	it('немає throw рядком (HIGH)', () => {
		const bad = sources.filter((file) =>
			/throw\s+['"`]/.test(withoutComments(readFileSync(file, 'utf8')))
		);
		expect(bad, `throw 'рядок' губить stack trace й ламає instanceof:\n${bad.join('\n')}`).toEqual(
			[]
		);
	});

	it('жоден порожній catch не мовчить іще й про причину (HIGH, звужено)', () => {
		const bad: string[] = [];
		for (const file of sources) {
			const source = readFileSync(file, 'utf8');
			// Тіло без жодного символу, крім пробілів: ні коду, ні коментаря.
			for (const match of source.matchAll(/catch\s*(\([^)]*\))?\s*\{\s*\}/g)) {
				const line = source.slice(0, match.index ?? 0).split('\n').length;
				bad.push(`${file}:${line}`);
			}
		}
		expect(
			bad,
			`збій зникає без сліду — ні запису, ні пояснення, чому запису не треба:\n${bad.join('\n')}`
		).toEqual([]);
	});

	/**
	 * Мінімум, якого пакет вимагає ЗАВЖДИ, і саме обома половинами: «мінімум
	 * `+error.svelte` + boundary — завжди» (мапа застосовності, рядок
	 * ERROR-HANDLING).
	 *
	 * Половини ловлять різне, і одна одну не замінює. `+error.svelte` показує
	 * збій, який стався ДО рендера — у `load` або в маршрутизації. `svelte:boundary`
	 * ловить виняток у самому рендері: без нього Svelte 5 зносить піддерево, і
	 * людина бачить білу сторінку замість повідомлення. Обидві були на місці й
	 * не мали гейта — тобто трималися на тому, що їх ніхто не прибере.
	 */
	it('обидві межі помилок на місці: +error.svelte і boundary в layout', () => {
		expect(existsSync('src/routes/+error.svelte'), 'сторінки помилки немає').toBe(true);

		const layout = readFileSync('src/routes/+layout.svelte', 'utf8');
		expect(layout, 'виняток у рендері віддасть білу сторінку').toContain('<svelte:boundary');
		expect(layout, 'boundary без failed показує порожнечу замість повідомлення').toMatch(
			/\{#snippet failed\(/
		);
		expect(layout, 'boundary мовчить: збій не потрапить у журнал').toMatch(
			/onerror=\{[\s\S]{0,200}logService\.error/
		);
	});
});
