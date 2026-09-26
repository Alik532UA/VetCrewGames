// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { withRoom, withoutRoom } from './roomUrl';

/**
 * АДРЕСА КІМНАТИ: `?room=` ставиться й знімається, і більше нічого не рухається.
 *
 * ## Що тут доводиться
 *
 * Скарга автора: із `?room=##` кнопка «назад» вела в `/quiz/`, перескочивши форму
 * входу. Причина була не в адресі, а в тому, що «назад» узагалі не дивилося на
 * стан: у шапці стояв ОДИН жорсткий напрямок на два різні екрани.
 *
 * Тепер крок «назад» у кімнаті — це зняти параметр, і сторінка розбирає кімнату
 * тим самим шляхом, яким збирала. Перевірка стежить за головним: решта адреси
 * (мова, інші параметри) при цьому не змінюється — інакше «назад» тихо губило б
 * мову або налаштування, і виглядало б це як зовсім інший дефект.
 */

const at = (href: string) => new URL(href, 'https://example.org');

describe('?room у адресі', () => {
	it('ставиться, не чіпаючи решти', () => {
		const url = withRoom(at('/en/quiz/online/?theme=dark'), 'ab12');
		expect(url.pathname).toBe('/en/quiz/online/');
		expect(url.searchParams.get('room')).toBe('ab12');
		expect(url.searchParams.get('theme'), 'сусідні параметри мусять лишитися').toBe('dark');
	});

	it('знімається, не чіпаючи решти', () => {
		const url = withoutRoom(at('/en/quiz/online/?room=ab12&theme=dark'));
		expect(url.searchParams.has('room')).toBe(false);
		expect(url.pathname, 'мова живе в шляху — «назад» не має права її зняти').toBe(
			'/en/quiz/online/'
		);
		expect(url.searchParams.get('theme')).toBe('dark');
	});

	/**
	 * `?from` ВІДСЛУЖИВ, ЩОЙНО КІМНАТА В АДРЕСІ (аудит 2026-09-26): доти він
	 * переживав «назад», і кожне наступне створення знову оголошувало переїзд у
	 * стару кімнату.
	 *
	 * Зворотний експеримент: не знімати `from` у `withRoom` — червоніє.
	 */
	it('кімната в адресі знімає ?from, і «назад» його вже не повертає', () => {
		const inside = withRoom(at('/quiz/online/?from=42&theme=dark'), '77');
		expect(inside.searchParams.has('from'), 'переїзд оголошувався б знову').toBe(false);
		expect(inside.searchParams.get('theme')).toBe('dark');
		expect(withoutRoom(inside).searchParams.has('from')).toBe(false);
	});

	it('зняти те, чого немає, — не помилка', () => {
		expect(withoutRoom(at('/quiz/online/')).search).toBe('');
	});

	/**
	 * Новий обʼєкт, а не правка того самого: `page.url` у SvelteKit не можна
	 * змінювати, і мутація тут зламала б навігацію не в цьому рядку, а десь потім.
	 */
	it('джерело не змінюється', () => {
		const source = at('/quiz/online/?room=ab12');
		const stripped = withoutRoom(source);
		expect(source.searchParams.get('room')).toBe('ab12');
		expect(stripped).not.toBe(source);
	});
	it('кімната в адресі знімає й ?move — він потрібен лише до входу', () => {
		const inside = withRoom(at('/quiz/online/?room=77&move=1'), '77');
		expect(inside.searchParams.has('move')).toBe(false);
		expect(inside.searchParams.get('room')).toBe('77');
	});
});
