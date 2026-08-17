// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createReserve, execute, tick } from './simulation';
import { TICKS_PER_DAY } from './constants';
import { metricsOf } from './journal';
import type { JournalNote, ReserveState } from './types';

/**
 * Реєстр дає ПРИЧИНИ, а зріз доводить ПОВНОТУ.
 *
 * Колишній журнал міряв різницю двох зрізів і не міг помилитися в сумі — але й не
 * знав, за що. Реєстр знає за що, зате місце, де підпис забули, не видно жодним
 * компілятором. Тому тут дві перевірки, і разом вони закривають обидві дірки:
 *
 *  1. Після насиченої доби в жодного показника не має бути рядка «Інше»: він і є
 *     різниця між сумою підписаних змін і виміряною. Зʼявився — отже, десь
 *     міняють число без причини.
 *  2. Ніякий файл теки, крім `ledger.ts`, не змінює `budget`, `impact` чи
 *     `reputation` напряму. Це той самий інваріант, тільки видний ще до прогону.
 *
 * Зворотний дослід для першої зроблено вручну: якщо в `day.ts` повернути
 * `state.budget -= …` замість `spend(…)`, зʼявляється «Інше» на всю зарплату.
 */

const noteOf = (notes: JournalNote[], reason: string) =>
	notes.find((entry) => entry.reason === reason);

/** Партія, у якій за одну добу відбувається все, що вміє відбуватися. */
function busyDay(): ReserveState {
	const state = createReserve(7);
	state.budget = 500_000;
	state.reputation = 40;
	/*
	 * Зріз доби переставляється РАЗОМ із підкрученими числами — і це не обхід
	 * перевірки, а її підтвердження.
	 *
	 * Фікстура пише в бюджет напряму, тобто робить рівно те, що реєстр і мусить
	 * ловити: перша ж версія цього тесту впала на «Інше +450 000». Гра так не
	 * робить (за цим стежить перевірка джерел нижче), а тест — має право, бо
	 * розставляє початкові умови, а не грає. Умови, отже, мусять виглядати як
	 * початок доби, а не як зміна посеред неї.
	 */
	state.dayStart = metricsOf(state);

	execute(state, { type: 'build', size: 5, quality: 2, cell: { x: 0, z: 0 } }, 'forest');
	execute(state, { type: 'build', size: 5, quality: 2, cell: { x: 8, z: 8 } }, 'forest');
	execute(state, { type: 'hire', role: 'vet' }, 'forest');
	execute(state, { type: 'hire', role: 'keeper' }, 'forest');
	execute(state, { type: 'hire', role: 'ranger' }, 'forest');
	execute(
		state,
		{ type: 'acquire', origin: 'rescue', speciesId: 'wolf', enclosureId: 1 },
		'forest'
	);
	execute(
		state,
		{ type: 'acquire', origin: 'official', speciesId: 'deer', enclosureId: 2 },
		'forest'
	);
	execute(state, { type: 'campaign' }, 'forest');
	// Знос за добу дає що ремонтувати — але ремонт беремо ПІСЛЯ доби, коли
	// міцність уже впала: до того гра слушно відмовляє «вольєр і так цілий».
	return state;
}

describe('реєстр причин', () => {
	it('після насиченої доби «Іншого» немає', () => {
		const state = busyDay();
		tick(state, TICKS_PER_DAY);

		const day = state.journal[0];
		expect(day, 'доба мусила закритися').toBeTruthy();

		const orphans = day.notes.filter((entry) => entry.reason === 'other');
		expect(
			orphans,
			`незапідписані зміни:\n${orphans.map((o) => `${o.metric} ${o.amount}`).join('\n')}`
		).toEqual([]);
	});

	it('зарплати стоять окремими рядками, а не одним числом', () => {
		// Це і є та вимога, з якої все почалося: «−235» не каже, що робити.
		const state = busyDay();
		tick(state, TICKS_PER_DAY);
		const notes = state.journal[0].notes.filter((entry) => entry.metric === 'budget');

		expect(noteOf(notes, 'wage.vet')?.amount).toBe(-120);
		expect(noteOf(notes, 'wage.keeper')?.amount).toBe(-80);
		expect(noteOf(notes, 'wage.ranger')?.amount).toBe(-100);
		expect(noteOf(notes, 'upkeep.animals')).toBeTruthy();
		expect(noteOf(notes, 'upkeep.enclosures')).toBeTruthy();
		expect(noteOf(notes, 'donations')?.amount).toBeGreaterThan(0);
	});

	it('сума рядків дорівнює показаній різниці', () => {
		const state = busyDay();
		tick(state, TICKS_PER_DAY * 2);

		for (const day of state.journal) {
			for (const metric of ['budget', 'impact', 'reputation'] as const) {
				const sum = day.notes
					.filter((entry) => entry.metric === metric)
					.reduce((total, entry) => total + entry.amount, 0);
				expect(Math.round(sum * 100) / 100, `${metric} дня ${day.day}`).toBe(day[metric]);
			}
		}
	});

	it('однакові причини складаються, а не множаться рядками', () => {
		// Три ветеринари — це один рядок на −360, а не три по −120.
		const state = busyDay();
		execute(state, { type: 'hire', role: 'vet' }, 'forest');
		execute(state, { type: 'hire', role: 'vet' }, 'forest');
		tick(state, TICKS_PER_DAY);

		const wages = state.journal[0].notes.filter((entry) => entry.reason === 'wage.vet');
		expect(wages).toHaveLength(1);
		expect(wages[0].amount).toBe(-360);
	});

	it('затиснута репутація пишеться тим, що СТАЛОСЯ', () => {
		/*
		 * При 100 «+2» означає нуль. Записаний як «+2», він і збрехав би, і зламав
		 * суму — поверх нього виліз би «Інше» з мінусом.
		 */
		const state = createReserve(3);
		state.budget = 500_000;
		state.reputation = 100;
		state.dayStart = metricsOf(state);
		execute(state, { type: 'campaign' }, 'forest');

		expect(state.reputation).toBe(100);
		expect(state.today.filter((entry) => entry.metric === 'reputation')).toEqual([]);
	});

	it('нуль не пише рядка', () => {
		// «Зарплата рейнджерам 0» повідомляє лише те, що рейнджерів немає.
		const state = createReserve(5);
		tick(state, TICKS_PER_DAY);
		expect(state.journal[0].notes.some((entry) => entry.amount === 0)).toBe(false);
	});
});

describe('показники міняються ТІЛЬКИ через реєстр', () => {
	const DIR = 'src/lib/reserve';
	/** Пряма зміна поля показника: саме те, що реєстр і мусить перехопити. */
	const DIRECT = /state\.(budget|impact|reputation)\s*(\+=|-=|=[^=])/;

	it('жоден файл теки, крім ledger.ts, не пише в показник напряму', () => {
		const guilty: string[] = [];
		for (const file of readdirSync(DIR)) {
			if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
			if (file === 'ledger.ts') continue;
			const text = readFileSync(join(DIR, file), 'utf8');
			for (const [index, line] of text.split('\n').entries()) {
				// Комментарі не рахуються: у них ці рядки цитуються навмисно.
				if (line.trim().startsWith('*') || line.trim().startsWith('//')) continue;
				if (DIRECT.test(line)) guilty.push(`${file}:${index + 1} ${line.trim()}`);
			}
		}
		expect(guilty, `зміна показника без причини:\n${guilty.join('\n')}`).toEqual([]);
	});
});
