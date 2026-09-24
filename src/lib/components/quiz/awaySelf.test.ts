// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * ЕКРАН КІМНАТИ ПОКАЗУЄ ЗНИКЛИХ БЕЗ МЕНЕ — по джерелу, бо це одне слово.
 *
 * Правило живе в матчі (`QuizMatch.awayOthers`, перевірено в
 * `quizMatch.svelte.test.ts`), а тут — лише те, що екран бере саме його. Повернути
 * `match.away` в одне з чотирьох місць — і людина без звʼязку знову бачить
 * «Чекаємо: <я>», а господар — кнопку «прибрати» навпроти себе (аудит 2026-09-24).
 * Сама пауза навмисно рахує й мене, тож `away` у контролері лишається.
 *
 * Зворотний експеримент: замінити будь-яке `match.awayOthers` у `QuizRoom.svelte`
 * на `match.away` — червоніє.
 */
describe('QuizRoom: зниклі — без мене', () => {
	const source = readFileSync('src/lib/components/quiz/QuizRoom.svelte', 'utf8');

	it('жодного `match.away` без «Others»', () => {
		expect(source.match(/match\.away(?!Others)\b/g) ?? []).toEqual([]);
	});

	it('усі чотири місця — вікно, дві смуги й підсумок — на `awayOthers`', () => {
		expect(source.match(/match\.awayOthers\b/g)?.length).toBe(4);
	});
});
