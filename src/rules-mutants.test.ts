// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { mutationPoints, rulesOf } from '../scripts/rules-mutants.mjs';

/**
 * РОЗБІР ПРАВИЛ ДЛЯ МУТАЦІЙНОГО ПРОГОНУ (шостий аудит, тести). Сам прогін іде над
 * емулятором (`npm run rules:mutants`); тут — лише те, що без нього: які операнди
 * стають мутантами. Помилка розбору була б тихою: мутант, якого не створено, не
 * виживає й не вмирає — його просто немає.
 *
 * Зворотний експеримент: не пропускати регулярки в `topLevel` — червоніє третій.
 */
const texts = (expr: string) => mutationPoints(expr).map((point: { text: string }) => point.text);

describe('мутанти правил', () => {
	it('ланцюжок && — кожен операнд, крім навмисного запасу auth != null', () => {
		expect(texts('auth != null && $uid === auth.uid && newData.isString()')).toEqual([
			'$uid === auth.uid',
			'newData.isString()'
		]);
	});

	it('|| — нижчий за &&: спершу гілки, тоді умови всередині дужок гілки', () => {
		expect(texts('a === 1 || (b === 2 && c === 3)')).toEqual([
			'a === 1',
			'(b === 2 && c === 3)',
			'b === 2',
			'c === 3'
		]);
	});

	it('дужки й && усередині регулярки та рядка — не межі', () => {
		expect(texts("newData.val().matches(/^(a|b)&&$/) && x === 'y && z'")).toEqual([
			'newData.val().matches(/^(a|b)&&$/)',
			"x === 'y && z'"
		]);
	});

	it('тернарний — обидві гілки мутуються, а умова лишається', () => {
		const points = mutationPoints("s === 'playing' ? roster.exists() : role === 'player'");
		expect(points.map((point: { op: string; text: string }) => [point.op, point.text])).toEqual([
			['?:', 'roster.exists()'],
			['?:', "role === 'player'"]
		]);
	});

	it('шлях правила — ключі без кореня, коментарі не заважають', () => {
		const file = [
			'{',
			'  // коментар із "лапками"',
			'  "rules": {',
			'    "rooms": { /* ще */ "$code": { ".write": "a && b" } }',
			'  }',
			'}'
		].join('\n');
		const [rule] = rulesOf(file);
		expect(rule.path).toBe('rules/rooms/$code/.write');
		expect(file.slice(rule.start, rule.end)).toBe('a && b');
	});
});
