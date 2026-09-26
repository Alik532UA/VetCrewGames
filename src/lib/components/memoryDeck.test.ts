// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * ДОШКА «ЗНАЙДИ ПАРУ» — ОДНА НА СОЛО Й ОНЛАЙН (прохання автора 2026-09-26).
 *
 * Доти формул було дві: соло рахувало висоту сталою «190px», онлайн — лише ширину,
 * і на iPhone пʼятий ряд онлайн-дошки стояв за краєм. Саме поле на екрані міряє
 * `tests/memory-fit.spec.ts`; тут — те, що мірило одне для обох, і не повернулась
 * друга копія.
 *
 * Зворотний експеримент: повернути в `OnlineRoom` власну сітку — червоніє «одна»;
 * прибрати висотну межу з `MemoryDeck` — червоніє «від коробки».
 */

const DECK = 'src/lib/components/MemoryDeck.svelte';
const SOLO = 'src/routes/[[lang=lang]]/game-memory/+page.svelte';
const ROOM = 'src/lib/components/pairs/OnlineRoom.svelte';

const read = (file: string) => readFileSync(file, 'utf8');

describe('дошка «Знайди пару»', () => {
	it('одна для соло й онлайн — власної сітки карток ні в кого немає', () => {
		for (const file of [SOLO, ROOM]) {
			const source = read(file);
			expect(source, `${file}: без MemoryDeck`).toContain('<MemoryDeck');
			expect(source, `${file}: власна сітка`).not.toMatch(
				/grid-template-columns:\s*repeat\(var\(--cols\)/
			);
		}
	});

	it('розмір — від коробки дошки, і за висотою теж', () => {
		const style = read(DECK);
		expect(style).toMatch(/container-type:\s*size/);
		expect(style, 'висотної межі немає').toContain('100cqh');
		expect(style, 'ширше за коробку').toMatch(/width:\s*min\(100cqw/);
	});
});
