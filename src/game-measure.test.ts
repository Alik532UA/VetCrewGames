// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * ГРА ВИГЛЯДАЄ ОДНАКОВО В СОЛО Й У КІМНАТІ — і в цього твердження мусить бути
 * СПІЛЬНЕ ДЖЕРЕЛО.
 *
 * ## Що ловить цей файл
 *
 * Скарга автора зі знімками: «онлайн режим ламає, розтягує інтерфейс ігор», соло на
 * тому ж знімку правильний. Причина була не в самій грі, а в тому, ЧИЯ міра її
 * обмежує: соло-екран «Правда чи міф?» стоїть у стовпці на 500px, кімната — у
 * стовпці на 900px. Та сама картка виходила майже вдвічі ширшою разом із кнопками
 * на всю ширину.
 *
 * Виправлення — не «підігнати друге число під перше», а прибрати друге число:
 * міра кожної гри лежить у токені (`--measure-*`), і його беруть обидва місця.
 * Ця перевірка стежить саме за цим: щойно хтось знову впише піксели в один із
 * двох файлів, «однаково в обох режимах» перестане мати спільне джерело — і
 * розійдеться тихо, бо жоден екран від цього не падає.
 *
 * ## Чого тут немає
 *
 * Виміру в браузері. Соло заміряно (картка «Правда чи міф?» — 470px при вікні
 * 1280, як і до правки), а кімнату — ні: онлайн у цьому проєкті ходить у СПРАВЖНЮ
 * базу, без емулятора, тож перевірка ширини коштувала б створення живої кімнати в
 * продакшні. Замість цього перевіряється те, з чого ця ширина береться.
 */

const TOKENS = 'src/lib/styles/global.css';
const BOARD = 'src/lib/components/quiz/QuizBoard.svelte';

/** Гра → (соло-сторінка, назва токена, клас дошки в кімнаті). */
const GAMES = [
	{ kind: 'myths', page: 'game-mythbusters', token: '--measure-myths' },
	{ kind: 'feeding', page: 'game-feeding', token: '--measure-feeding' },
	{ kind: 'habitat', page: 'game-habitat', token: '--measure-habitat' },
	{ kind: 'family', page: 'game-family', token: '--measure-family' },
	{ kind: 'population', page: 'game-population', token: '--measure-population' }
] as const;

const read = (file: string) => readFileSync(file, 'utf8');
const pageOf = (name: string) => read(`src/routes/[[lang=lang]]/${name}/+page.svelte`);

describe('міра гри — одна на соло й кімнату', () => {
	const tokens = read(TOKENS);
	const board = read(BOARD);

	it('перевірка жива: токени мір оголошені', () => {
		for (const game of GAMES) {
			expect(tokens, `${game.token} не оголошений`).toContain(`${game.token}:`);
		}
	});

	it('соло-сторінка бере міру з токена, а не з пікселів', () => {
		for (const game of GAMES) {
			expect(pageOf(game.page), `${game.page}: міра мусить бути токеном`).toContain(
				`max-width: var(${game.token})`
			);
		}
	});

	/**
	 * Головне твердження файлу: дошка в кімнаті обмежена ТИМ САМИМ токеном.
	 * Без цього рядка кімната знову віддасть грі свою ширину — 900px.
	 */
	it('дошка в кімнаті обмежена тим самим токеном', () => {
		for (const game of GAMES) {
			expect(board, `у QuizBoard немає класу .board--${game.kind}`).toContain(
				`.board--${game.kind}`
			);
			expect(board, `.board--${game.kind} мусить брати ${game.token}`).toContain(
				`max-width: var(${game.token})`
			);
		}
	});

	it('кожна гра кімнати отримує клас із мірою', () => {
		const online = read('src/lib/config/quizOnline.ts');
		const ids = [...online.matchAll(/\{ id: '([a-z-]+)'/g)].map((m) => m[1]);

		expect(ids.length, 'перелік ігор кімнати не знайдено').toBeGreaterThan(0);

		// `habitat-continents` і `habitat-biomes` малює одна дошка — `habitat`.
		const kinds = new Set(ids.map((id) => (id.startsWith('habitat') ? 'habitat' : id)));
		const missing = [...kinds].filter((kind) => !board.includes(`board--${kind}={`));

		expect(
			missing,
			`гра кімнати без міри — дошка розтягнеться на всю кімнату: ${missing.join(', ')}`
		).toEqual([]);
	});
});
