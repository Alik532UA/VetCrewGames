// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ПОРЯДОК ПІДПИСУ ГРАВЦЯ: ПРАПОР, ПОТІМ АВАТАРКА, ПОТІМ ІМʼЯ.
 *
 * ## Навіщо перевірка на порядок двох тегів
 *
 * Бо місць, де малюється підпис гравця, ВІСІМ, і вони в різних розділах: лобі
 * «Знайди пару», кімната, перелік кімнат, три переліки вікторини, друзі й пошук
 * людей в акаунті. Вимога автора була саме «змінити не тільки тут, а й усюди»:
 * порядок розійшовся сам собою, бо кожне місце писали окремо.
 *
 * Одним компонентом це не лікується: у восьми місцях різні обгортки, різні
 * джерела даних і різні розміри. А от ПОРЯДОК — спільна властивість, і його можна
 * перевірити текстом.
 *
 * ## Межа перевірки, названа прямо
 *
 * Вона дивиться на СУСІДНІ теги компонентів. Якщо колись між прапором і аватаркою
 * стане третій елемент, перевірка цього не помітить — це пункт код-рев'ю, а не CI.
 */

function svelteFiles(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) svelteFiles(full, out);
		else if (entry.endsWith('.svelte')) out.push(full);
	}
	return out;
}

/**
 * Назви компонентів у порядку появи в розмітці.
 *
 * Розбір по `<`, а не регулярним виразом: вираз із переносами рядків у цьому
 * файлі вже одного разу зламав саму перевірку, і простий розбір тут точніший за
 * будь-який шаблон.
 */
function componentOrder(text: string): string[] {
	return text
		.split('<')
		.slice(1)
		.map((chunk) => chunk.slice(0, 16));
}

/** Чи стоять два компоненти впритул один за одним. */
function hasPair(text: string, first: string, second: string): boolean {
	const tags = componentOrder(text);
	return tags.some(
		(tag, index) => tag.startsWith(first) && (tags[index + 1] ?? '').startsWith(second)
	);
}

describe('підпис гравця', () => {
	const files = [...svelteFiles('src/lib'), ...svelteFiles('src/routes')];

	it('перевірка жива: пари «прапор + аватарка» в проєкті є', () => {
		const withPair = files.filter((file) => hasPair(readFileSync(file, 'utf8'), 'Flag', 'Avatar'));
		expect(withPair.length, 'жодної пари не знайдено — перевірка дивиться не туди').toBeGreaterThan(
			0
		);
	});

	it('аватарка не стоїть перед прапором', () => {
		const wrong = files.filter((file) => hasPair(readFileSync(file, 'utf8'), 'Avatar', 'Flag'));
		expect(wrong, `порядок мусить бути «прапор, аватарка, імʼя»: ${wrong.join(', ')}`).toEqual([]);
	});
});
