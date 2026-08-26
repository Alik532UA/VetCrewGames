// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * ПЕРЕЇЗД У ДРУГУ ОНЛАЙН-ГРУ після фіналу.
 *
 * Прохання автора: «після фіналу можна повторити і поточну гру „Грати знову“, і
 * іншу гру, якщо тільки що була гра „знайти пару“, то можна „вікторину“, і
 * навпаки». З двох варіантів автор вибрав той, у якому група лишається разом:
 * «господар створює кімнату іншої гри, а решті в старій кімнаті зʼявляється кнопка
 * „перейти“ з її кодом».
 *
 * ## Що саме тут стережеться
 *
 *  * **кожна гра веде в ДРУГУ.** Помилка в мапі дає посилання «зіграти в те саме»,
 *    і воно виглядає робочим: кімната створюється, гра та сама;
 *  * **підпис називає ГРУ, а не дію.** «Зіграти в іншу» не каже, у що саме, а
 *    вибір між двома іграми — це і є питання;
 *  * **код старої кімнати їде в адресу.** Без нього нова кімната не знає, кому
 *    сказати про себе, — тобто решта гравців нічого не побачить, і вся річ
 *    зводиться до звичайного посилання в лобі;
 *  * **без переїзду немає кнопки «перейти».** `null` тут означає «ще нікуди», і
 *    порожнє посилання читалося б як «кнопка не працює»;
 *  * **код проходить через кодування.** Він короткий і літерний, але адреса
 *    збирається рядком, і будь-яке майбутнє розширення алфавіту не має права
 *    поламати посилання.
 *
 * Зворотні експерименти (AI-AGENT-PITFALLS-v8 § 1.1) — три, кожен червонив рівно
 * свій пункт: мапу `OTHER` замінено на тождність; підписи в `INVITE` переставлено
 * місцями; `?from` прибрано з посилання. Усі три зроблені.
 */

vi.mock('$app/paths', () => ({
	resolve: (route: string, params: Record<string, string>) =>
		route.replace('[[lang=lang]]', params.lang ?? ''),
	asset: (path: string) => path
}));

const { crossGameLinks } = await import('./crossGame');

describe('переїзд у другу гру', () => {
	it('кожна гра веде в ДРУГУ, і підпис називає саме її', () => {
		const fromPairs = crossGameLinks('uk', 'pairs', 'ab', null);
		const fromQuiz = crossGameLinks('uk', 'quiz', 'ab', null);

		expect(fromPairs.create, '«Знайди пару» веде не у вікторину').toContain('/quiz/online/');
		expect(fromPairs.createLabel, 'підпис не називає гру, у яку йдуть').toBe('room.playQuiz');
		expect(fromQuiz.create, 'вікторина веде не в «Знайди пару»').toContain('/pairs/online/');
		expect(fromQuiz.createLabel).toBe('room.playPairs');
	});

	it('код старої кімнати їде в адресу', () => {
		// Без нього нова кімната не знає, кому сказати про себе, — і решта гравців
		// нічого не побачить.
		expect(crossGameLinks('uk', 'pairs', 'ab', null).create).toContain('?from=ab');
	});

	it('кімнати ще немає — посилання без `from`', () => {
		const links = crossGameLinks('uk', 'pairs', '', null);
		expect(links.create, 'порожній код поїхав у адресу').not.toContain('from=');
	});

	it('без оголошеного переїзду кнопки «перейти» немає', () => {
		expect(crossGameLinks('uk', 'pairs', 'ab', null).next).toBeNull();
	});

	it('переїзд оголошено — посилання веде в НОВУ кімнату за кодом', () => {
		const links = crossGameLinks('uk', 'pairs', 'ab', 'xyz');
		expect(links.next).toContain('/quiz/online/');
		expect(links.next).toContain('?room=xyz');
	});

	it('код проходить через кодування адреси', () => {
		const links = crossGameLinks('uk', 'pairs', 'a b', 'x&y');
		expect(links.create, 'пробіл поїхав у адресу як є').toContain('a%20b');
		expect(links.next, 'амперсанд поїхав у адресу як є').toContain('x%26y');
	});
});

/**
 * ОБВʼЯЗКА: кнопки стоять в обох іграх, і оголошення переїзду теж.
 *
 * Перевіряється по джерелах, бо це розмітка двох екранів підсумку й два виклики на
 * двох сторінках. Найважливіше — САМЕ парність: зробити половину (кнопку в одній
 * грі, оголошення в другій) легко, і зламане буде лише в одному напрямку — тобто
 * помітить це той, хто випадково піде саме туди.
 */
describe('обвʼязка переїзду', () => {
	const read = (path: string) => readFileSync(path, 'utf8');

	it('кнопки є в підсумку ОБОХ ігор', () => {
		for (const file of [
			'src/lib/components/pairs/OnlineRoom.svelte',
			'src/lib/components/quiz/QuizRoom.svelte'
		]) {
			const source = read(file);
			expect(source, `${file}: немає кнопки «перейти»`).toContain('data-testid="room-next-link"');
			expect(source, `${file}: немає кнопки «зіграти в іншу»`).toContain(
				'data-testid="room-other-game-link"'
			);
		}
	});

	it('оголошення переїзду стоїть на ОБОХ сторінках', () => {
		for (const file of [
			'src/routes/[[lang=lang]]/pairs/online/+page.svelte',
			'src/routes/[[lang=lang]]/quiz/online/+page.svelte'
		]) {
			expect(read(file), `${file}: нова кімната не каже старій про себе`).toContain(
				'announceFrom(page.url, code)'
			);
		}
	});
});
