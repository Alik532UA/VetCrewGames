// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fenceOf } from './fence';
import { QUALITIES, type Quality } from '$lib/reserve/constants';

/**
 * ТРИ ПАРКАНИ МУСЯТЬ РІЗНИТИСЯ ВИДИМО, а не просто різнитися.
 *
 * ## Що це за перевірка
 *
 * Скарга автора: «паркан для всіх трьох якостей вольєрів виглядає нормально але
 * однаково». Полагодити це один раз легко; лишити полагодженим — ні. Наступна
 * правка палітри чи висот може звести два набори до майже однакових, і на карті
 * з висоти пташиного льоту цього ніхто не помітить: різниця в 0.02 світової
 * одиниці — це менше за піксель.
 *
 * Тому перевірка питає не «чи різні обʼєкти», а «чи різниця достатня, щоб її
 * було ВИДНО». Число в кожному пункті — межа, під якою різниця перестає
 * читатися; вона взята з масштабу сцени (клітинка — одна світова одиниця, тварина
 * приблизно 0.3–0.6 заввишки).
 *
 * ## Чому не знімок
 *
 * Знімок сцени Threlte порівнювати нічим: `MeshStandardMaterial` залежить від
 * освітлення, а воно тут добове. Тут перевіряються самі ЧИСЛА — те, з чого
 * компонент будує геометрію, і те, що правкою й ламається.
 *
 * Зворотні експерименти (AI-AGENT-PITFALLS-v8 § 1.1) — пʼять, і всі зроблені:
 *
 *  1. висоту «простої» піднято до 0.58 (різниця з «доброю» 0.02) — червоніє
 *     «висота росте помітно»;
 *  2. колір «відмінної» замінено на брунатний із «доброї» — червоніє «матеріал
 *     читається як інший»;
 *  3. `cap` знято з «відмінної» — червоніє «накривка є рівно в найдорожчого»;
 *  4. у компоненті `effectiveQuality(enclosure)` замінено на `enclosure.quality`
 *     — червоніє останній пункт, і лише він: жодне число вище цього не бачить;
 *  5. колір «простої» замінено на насичений теплий — червоніє «найдешевший
 *     паркан не свіжий на вигляд».
 */

/** Наскільки має підрости висота, щоб це було видно на карті. */
const VISIBLE_HEIGHT_STEP = 0.1;

/** Наскільки має різнитися тон, щоб читатися як інший матеріал (0..255 на канал). */
const VISIBLE_TONE_STEP = 20;

const rgb = (hex: string): [number, number, number] => [
	parseInt(hex.slice(1, 3), 16),
	parseInt(hex.slice(3, 5), 16),
	parseInt(hex.slice(5, 7), 16)
];

/**
 * Наскільки колір «холодний»: синій мінус червоний.
 *
 * Саме цю величину й видно як зміну МАТЕРІАЛУ: деревина завжди тепла (червоного
 * більше за синій), камінь і метал — ні. Порівнювати повну відстань між
 * кольорами тут гірше: світліша деревина відʼїхала б від темнішої на ту саму
 * відстань, і перевірка проходила б на двох дерев'яних парканах.
 */
const coolness = (hex: string): number => {
	const [r, , b] = rgb(hex);
	return b - r;
};

describe('паркан показує якість вольєра', () => {
	it('перевірка жива: набір є на кожну якість', () => {
		expect(QUALITIES).toEqual([1, 2, 3]);
		for (const quality of QUALITIES) {
			const fence = fenceOf(quality as Quality);
			expect(fence, `немає набору для якості ${quality}`).toBeTruthy();
			expect(fence.rails.length, 'один брус читався б як лінія на землі').toBeGreaterThan(1);
		}
	});

	it('висота росте помітно з кожним щаблем', () => {
		const heights = QUALITIES.map((quality) => fenceOf(quality as Quality).postHeight);
		for (let i = 1; i < heights.length; i++) {
			expect(
				heights[i] - heights[i - 1],
				`якість ${i + 1} проти ${i}: ${heights[i]} і ${heights[i - 1]} — різниці не видно`
			).toBeGreaterThanOrEqual(VISIBLE_HEIGHT_STEP);
		}
	});

	it('стовпчик не тоншає з ціною', () => {
		// Дорожчий паркан, зроблений із тонших стовпчиків, читався б як дешевший —
		// хоч кожне окреме число й було б «інакшим».
		const widths = QUALITIES.map((quality) => fenceOf(quality as Quality).postWidth);
		for (let i = 1; i < widths.length; i++) {
			expect(widths[i]).toBeGreaterThan(widths[i - 1]);
		}
	});

	it('у найдорожчого брусів більше, ніж у найдешевшого', () => {
		expect(fenceOf(3).rails.length).toBeGreaterThan(fenceOf(1).rails.length);
	});

	it('бруси не перетинаються між собою й не тонуть у землі', () => {
		for (const quality of QUALITIES) {
			const fence = fenceOf(quality as Quality);
			const sorted = [...fence.rails].sort((a, b) => a - b);
			expect(sorted, `висоти брусів якості ${quality} записані не по порядку`).toEqual(fence.rails);
			expect(sorted[0], `нижній брус якості ${quality} під землею`).toBeGreaterThan(
				fence.railThickness
			);
			for (let i = 1; i < sorted.length; i++) {
				expect(sorted[i] - sorted[i - 1], `бруси якості ${quality} злипаються`).toBeGreaterThan(
					fence.railThickness * 2
				);
			}
			// Верхній брус мусить лишатися НА стовпчику, а не висіти над ним.
			expect(
				sorted[sorted.length - 1],
				`верхній брус якості ${quality} вище за стовпчик`
			).toBeLessThan(fence.postHeight);
		}
	});

	it('матеріал найдорожчого читається як інший, а не як яскравіша деревина', () => {
		const wood = fenceOf(2);
		const stone = fenceOf(3);
		expect(
			coolness(stone.post) - coolness(wood.post),
			`${stone.post} проти ${wood.post}: обидва теплі, тобто обидва деревина`
		).toBeGreaterThanOrEqual(VISIBLE_TONE_STEP);
	});

	it('найдешевший паркан не свіжий на вигляд', () => {
		// «Проста» мусить читатися як вивітрена: інакше найдешевший вибір виглядав
		// би доглянутим, тобто протилежно до того, чим він є.
		const simple = fenceOf(1);
		const good = fenceOf(2);
		const saturation = (hex: string) => Math.max(...rgb(hex)) - Math.min(...rgb(hex));
		expect(
			saturation(good.post) - saturation(simple.post),
			`${simple.post} насиченіший або такий самий, як ${good.post}`
		).toBeGreaterThanOrEqual(VISIBLE_TONE_STEP);
	});

	it('накривка є рівно в найдорожчого', () => {
		expect([fenceOf(1).cap, fenceOf(2).cap, fenceOf(3).cap]).toEqual([false, false, true]);
	});

	it('стовпчиків із ціною більшає', () => {
		const extra = QUALITIES.map((quality) => fenceOf(quality as Quality).extraPosts);
		for (let i = 1; i < extra.length; i++) expect(extra[i]).toBeGreaterThan(extra[i - 1]);
	});

	it('компонент бере ЕФЕКТИВНУ якість, а не поле сейва', async () => {
		/*
		 * Половина сенсу цього модуля — знос. У `constants.ts` над порогами
		 * написано «щоб гравець БАЧИВ, що вольєр став гіршим», і побачити це можна
		 * лише якщо паркан питає `effectiveQuality`. Підміна на
		 * `enclosure.quality` не ламає жодного числа вище — тому пункт дивиться на
		 * саме джерело.
		 */
		const { readFileSync } = await import('node:fs');
		const source = readFileSync('src/lib/components/reserve/EnclosureShape.svelte', 'utf8');
		expect(source).toMatch(/fenceOf\(effectiveQuality\(enclosure\)\)/);
	});
});
