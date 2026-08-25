// @vitest-environment node
// Перевірка читає джерела — DOM їй не потрібен.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * СМУГА «ВАС ЧЕКАЮТЬ У ГРІ»: умови появи як інваріант.
 *
 * ## Чому структурна перевірка, а не рендер компонента
 *
 * Та сама причина, що в `ServiceBadge.test.ts`, і вона тут навіть сильніша.
 * Головні властивості смуги — це УМОВИ, а не розмітка, і кожну можна зламати
 * одним символом:
 *
 *  * `!insideRoom` → смуга висить на сторінці самої партії й каже «ви тут,
 *    поверніться сюди»;
 *  * порядок «адреса, потім `dismiss()`» → клік падає на `null.gameId`, і кнопка
 *    «повернутися» не веде нікуди. Це вже було, і знайшлося лише в браузері;
 *  * `mount()` у `features/awaitedBanner` → смуга не з'являється взагалі, бо в
 *    кореневому layout її немає (вона там і не може бути: бюджет).
 *
 * Рендер-тест цього не покриває: у проєкті не аліасовані `$app/state` та
 * `$app/navigation`, тобто мок оточення довелося б додавати в конфіг, і перевірка
 * стверджувала б поведінку МОКА. Сам показ заміряно в браузері: смуга стоїть
 * праворуч знизу (16px від обох країв), текст і дві кнопки на місці, а адреса
 * `/quiz/online/?room=ab12` кладе код у поле входу.
 *
 * Чого перевірка НЕ бачить: живого випадку «хтось справді чекає». Онлайн у цьому
 * проєкті ходить у СПРАВЖНЮ базу, без емулятора, тож для нього треба живу кімнату
 * в продакшні. Правило «яка кімната чекає» перевірене окремо —
 * `utils/awaitedRoom.test.ts`, десять випадків.
 */

const PANEL = readFileSync('src/lib/components/AwaitedRoom.svelte', 'utf8');
const GLUE = readFileSync('src/lib/features/awaitedBanner.ts', 'utf8');
const LAYOUT = readFileSync('src/routes/+layout.svelte', 'utf8');

describe('умови появи смуги', () => {
	it('перевірка жива: файли знайдено', () => {
		expect(PANEL.length).toBeGreaterThan(0);
		expect(GLUE.length).toBeGreaterThan(0);
	});

	it('на сторінці партії смуги немає', () => {
		expect(PANEL, 'смуга мусить зникати всередині кімнати').toContain('{#if room && !insideRoom}');
		expect(PANEL, '«всередині кімнати» визначається адресою').toContain(
			"page.url.pathname.includes('/online')"
		);
	});

	it('адреса складається ДО того, як стан гаснуть', () => {
		const target = PANEL.indexOf('const target =');
		const dismiss = PANEL.indexOf('awaitedRoom.dismiss()', target);
		expect(target, 'адреса мусить складатися в обробнику').toBeGreaterThan(-1);
		expect(dismiss, '`dismiss()` мусить іти ПІСЛЯ складання адреси').toBeGreaterThan(target);
	});

	it('смуга монтується сама, а не через layout', () => {
		expect(GLUE, 'без `mount()` смугу не побачить ніхто').toContain('mount(panel.default');
		expect(LAYOUT, 'layout мусить лише кликати підключення').toContain(
			"import('$lib/features/awaitedBanner')"
		);
	});

	/**
	 * Бюджет кореневого layout — 121 КБ gzip, і він витрачений повністю. Статичний
	 * імпорт смуги його перевищував (заміряно: 121,1 КБ), тому в layout не мусить
	 * бути ні компонента, ні контролера.
	 */
	it('layout не тягне смугу статично', () => {
		expect(LAYOUT).not.toContain("from '$lib/components/AwaitedRoom.svelte'");
		expect(LAYOUT).not.toContain("from '$lib/controllers/awaitedRoom.svelte'");
	});
});

/**
 * СМУГА НЕ ВИСИТЬ НАД ПОРОЖНЬОЮ КІМНАТОЮ.
 *
 * Скарга автора у двох частинах: гравець лишився сам, вийшов — і бачить «вас
 * чекають»; і взагалі порожні кімнати не мусять нагадувати про себе, навіть якщо
 * ніхто явно не тиснув «вийти з кімнати».
 *
 * Причина була в тому, ЧИМ доводилося «кімната жива»: позначкою `aliveAt`, яку
 * оновлює кожен, хто в кімнаті сидить. Тобто моє власне серцебиття лишало кімнату
 * свіжою ще дві хвилини після мого виходу — і сповіщення про неї було формально
 * правдиве й фактично безглузде.
 *
 * Тепер остаточне слово за ПРИСУТНІСТЮ: вона гасне сама (`onDisconnect`) і
 * відповідає на потрібне питання — не «коли тут хтось був», а «хто тут зараз».
 */
describe('порожня кімната не чекає', () => {
	const controller = readFileSync('src/lib/controllers/awaitedRoom.svelte.ts', 'utf8');

	it('присутність питається перед показом', () => {
		expect(controller, 'без цього смуга висить над порожньою кімнатою').toContain(
			'othersPresent(room.code)'
		);
		expect(controller, 'нуль інших означає «чекати нікому»').toContain('> 0');
	});

	it('смуга гасне, коли вийшов останній', () => {
		expect(
			controller,
			'без підписки на присутність смуга висіла б до переходу сторінкою'
		).toContain('watchOthers(code');
	});

	/**
	 * `aliveAt` лишається — але як ДЕШЕВИЙ ВІДСІВ, а не як доказ: питати
	 * присутність у кімнати, де дві хвилини тиші, нема сенсу.
	 */
	it('свіжість лишилася відсівом, а не доказом', () => {
		const rule = readFileSync('src/lib/utils/awaitedRoom.ts', 'utf8');
		expect(rule).toContain('roomLife(room.aliveAt, now)');
		expect(rule, 'правило не мусить саме вирішувати, хто чекає').not.toContain('othersPresent');
	});
});
