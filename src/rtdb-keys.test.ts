// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { GAME_FLAG_PREFIX, ONLINE_GAMES, gamesToConfig } from '$lib/config/quizOnline';

/**
 * КЛЮЧІ ДЛЯ REALTIME DATABASE, виведені з даних, мусять бути допустимі.
 *
 * RTDB не приймає в іменах вузлів `.`, `#`, `$`, `/`, `[`, `]`. І відмова тут
 * особлива: її дає КЛІЄНТСЬКИЙ SDK, ще до мережі. Тобто правила доступу цього
 * не бачать у принципі — `npm run check:rules` пройде на будь-якій формі ключа,
 * бо до правил справа не доходить.
 *
 * ЦІНА ВЖЕ ЗАПЛАЧЕНА. Префікс прапорців ігор у спільній вікторині був `game.`,
 * тобто кожен ключ конфігу мав точку. Створення кімнати падало ЗАВЖДИ, і жоден
 * із дванадцяти гейтів цього не показав: `check` не бачить рядкових літералів,
 * правила до цього не доходять, а юніт-тест конфігу перевіряв ЗНАЧЕННЯ (числа
 * 0 і 1) і жодного слова не казав про ключі.
 *
 * На екрані при цьому стояло «Не вдалося зайти в кімнату. Спробуйте ще раз»:
 * глухий `catch` у `net/rtdbRoom.ts` трактував відмову запису як «код зайнятий»
 * і доростав до чотирьох цифр. Тобто повідомлення назвало наслідок, а причина
 * стала видна лише після того, як той `catch` перестав ковтати помилки.
 *
 * Зворотний експеримент (AI-AGENT-PITFALLS-v8 § 1.1): повернути
 * `GAME_FLAG_PREFIX = 'game.'` — перевірка мусить назвати саме ці ключі.
 */

/** Символи, заборонені в іменах вузлів RTDB. */
const FORBIDDEN = ['.', '#', '$', '/', '[', ']'];

function illegal(key: string): string[] {
	return FORBIDDEN.filter((char) => key.includes(char));
}

describe('ключі RTDB, виведені з даних', () => {
	it('перевірка жива: розбір відрізняє допустимий ключ від забороненого', () => {
		// Без цього перевірки нижче були б зелені й на завжди-порожньому `illegal`.
		expect(illegal('game_myths')).toEqual([]);
		expect(illegal('game.myths')).toEqual(['.']);
		expect(illegal('a/b')).toEqual(['/']);
		expect(illegal('$uid')).toEqual(['$']);
	});

	it('прапорці ігор дають допустимі ключі', () => {
		const all = ONLINE_GAMES.map((game) => game.id);
		expect(all.length, 'ігор немає — перевіряти нема що').toBeGreaterThan(0);

		// І сам префікс, і кожен ключ повного конфігу, і ключі часткового вибору:
		// склад конфігу від вибору не залежить, але перевірка не мусить цього знати.
		const keys = [
			GAME_FLAG_PREFIX,
			...Object.keys(gamesToConfig(all)),
			...Object.keys(gamesToConfig([all[0]])),
			...Object.keys(gamesToConfig([]))
		];

		const broken = keys
			.filter((key) => illegal(key).length > 0)
			.map((key) => `${key} → ${illegal(key).join(' ')}`);

		expect(
			broken,
			'RTDB відкидає такий запис у КЛІЄНТІ, до мережі — тобто ні правила, ні ' +
				`check:rules про це не скажуть:\n  ${broken.join('\n  ')}`
		).toEqual([]);

		// Ключі мусять ще й розрізнятися: спільний ключ на дві гри тихо злив би
		// прапорці, і перевірка вище лишалася б зеленою.
		expect(new Set(Object.keys(gamesToConfig(all))).size).toBe(all.length);
	});

	it('псевдонім акаунта обмежений білим списком, і в ньому немає заборонених', () => {
		/*
		 * Тут ключем стає те, що НАБРАЛА ЛЮДИНА: `handles/${handle}`. Захист —
		 * білий список, тобто структурно нездатний пропустити точку, і саме тому
		 * код не змінено: цей випадок був безпечний і до правки.
		 *
		 * Але безпечний він рівно доти, доки список такий. Тому набір закріплений
		 * тут дослівно: хто його змінить, прийде сюди й підтвердить, що новий набір
		 * для RTDB допустимий. Модуль `net/account.ts` пише ключ, не перевіряючи
		 * його, — він довіряє цьому списку.
		 */
		const page = readFileSync('src/routes/[[lang=lang]]/account/+page.svelte', 'utf8');

		const SANITIZER = '/[^a-z0-9_]/g';
		const GUARD = '/^[a-z0-9_]{3,20}$/';

		expect(page, `санітайзер поля змінився — очікувався ${SANITIZER}`).toContain(SANITIZER);
		expect(page, `умова збереження змінилася — очікувалася ${GUARD}`).toContain(GUARD);

		// І сам білий список не містить заборонених символів.
		for (const allowed of ['a-z0-9_']) {
			expect(illegal(allowed), `у білому списку ${allowed} є заборонений символ`).toEqual([]);
		}
	});
});
