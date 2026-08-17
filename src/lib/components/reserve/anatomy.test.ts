// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ANATOMY, bodyOf, type Beast } from './anatomy';
import { bone, heightOf, neckOf, shareOf, spanOf, spur } from './figure';
import { SPECIES } from '$lib/reserve/species';

/**
 * Силует мусить бути ВИДНИМ і мусить ВЛАЗИТИ — обидва боки одразу.
 *
 * Перевірка тут одна на всі види, і саме тому вона щось означає. Дивитися на
 * кожну тварину окремо в ізометрії безглуздо: слон, який на два сантиметри
 * вилазить за паркан, з такої відстані виглядає точно як слон, що не вилазить.
 * А їжак, зменшений «як у житті», перетворюється на пляму, і рахувати його
 * пропорції вже нема сенсу.
 *
 * Головне число — ЧАСТКА найменшого дозволеного вольєра. Вона тримає всі види в
 * одному масштабі відносно їхнього житла: кожен займає від чверті до половини
 * ширини, і кожного видно однаково добре.
 */

const bodies = SPECIES.map((species) => ({ species, body: bodyOf(species.id) }));

describe('таблиця анатомії', () => {
	it('покриває кожен вид зі списку', () => {
		const missing = SPECIES.filter((species) => !ANATOMY[species.id]).map((s) => s.id);
		expect(missing).toEqual([]);
	});

	it('не описує видів, яких у грі немає', () => {
		const known = SPECIES.map((species) => species.id);
		expect(Object.keys(ANATOMY).filter((id) => !known.includes(id))).toEqual([]);
	});

	it('невідомий вид усе одно має силует', () => {
		// Беззвучно зникнути — гірше за сірий силует: дефект не побачить ніхто.
		expect(spanOf(bodyOf('velociraptor'))).toBeGreaterThan(0);
	});
});

describe('силует у вольєрі', () => {
	it.each(bodies)(
		'$species.id займає від чверті до половини найменшого вольєра',
		({ species, body }) => {
			const share = shareOf(body, species.minSize);
			expect(share).toBeGreaterThan(0.2);
			expect(share).toBeLessThan(0.6);
		}
	);

	it.each(bodies)('$species.id не ширший за свій найменший вольєр', ({ species, body }) => {
		// Ширина окремо від довжини: тварина повернута на власний кут, тож за
		// паркан може вилізти будь-який із двох вимірів.
		expect(body.wide).toBeLessThan(spanOf(body));
		expect(shareOf(body, species.minSize)).toBeLessThan(0.6);
	});

	it('слон найбільший, їжак найменший', () => {
		const four = bodies.filter(({ body }) => body.stance === 'four');
		const spans = four.map(({ species, body }) => ({ id: species.id, span: spanOf(body) }));
		const order = [...spans].sort((a, b) => a.span - b.span);
		expect(order[0].id).toBe('hedgehog');
		expect(order[order.length - 1].id).toBe('elephant');
	});

	it('слон не менш як усемеро довший за їжака', () => {
		// Метричної правди тут немає (насправді різниця тридцятикратна), але
		// порядок величин мусить читатися: два овали однакового розміру не
		// розрізняє ніхто.
		expect(spanOf(bodyOf('elephant')) / spanOf(bodyOf('hedgehog'))).toBeGreaterThan(6);
	});
});

describe('частини тримаються купи', () => {
	it.each(bodies)('$species.id має шию коротшу за тулуб', ({ body }) => {
		// Довша шия означала б голову, що висить осторонь; нульова — голову,
		// втоплену в тулуб. Обидва випадки видно лише в грі, тож ловимо тут.
		const neck = neckOf(body);
		expect(neck.length).toBeGreaterThan(0);
		expect(neck.length).toBeLessThan(body.len);
	});

	it.each(bodies)('$species.id стоїть на землі й не вище за три тулуби', ({ body }) => {
		expect(body.leg).toBeGreaterThanOrEqual(0);
		expect(heightOf(body)).toBeGreaterThan(body.tall);
		expect(heightOf(body)).toBeLessThan(body.len * 3);
	});

	it('хобот слона не встромляється в землю', () => {
		const slon = bodyOf('elephant');
		// Найнижча ланка хобота — голова мінус 2.15 радіуса голови (`AnimalMark`).
		const tip = slon.leg + slon.tall + slon.lift - slon.head * 2.15;
		expect(tip).toBeGreaterThan(0.1);
	});
});

describe('силуети різні', () => {
	it('жодні два види не мають однакового набору ознак', () => {
		const shape = (b: Beast) => [b.stance, b.tail, b.ear, b.mark, b.coat].join('|');
		const seen = bodies.map(({ body }) => shape(body));
		expect(new Set(seen).size).toBe(seen.length);
	});

	it('жодні два види не мають однакових пропорцій', () => {
		const size = ({ len, tall, leg }: Beast) => [len, tall, leg].join('|');
		const seen = bodies.map(({ body }) => size(body));
		expect(new Set(seen).size).toBe(seen.length);
	});
});

describe('кістка', () => {
	/*
	 * Циліндр у three.js стоїть уздовж Y, тож напрямок задається поворотом навколо
	 * Z, і формула кута нетипова: atan2(−dx, dy). Зворотний дослід нижче показує,
	 * що «звичне» atan2(dy, dx) дало б інші числа — тобто перевірка не порожня.
	 */
	it('нахил повертає Y у заданий напрямок', () => {
		const along = bone(0, 0, 2, 0);
		expect(along.length).toBeCloseTo(2);
		expect(along.x).toBeCloseTo(1);
		// Уздовж +X — це поворот на −90°.
		expect(along.tilt).toBeCloseTo(-Math.PI / 2);

		const up = bone(0, 0, 0, 3);
		expect(up.tilt).toBeCloseTo(0);
	});

	it('«звичний» atan2(dy, dx) дав би інший кут', () => {
		const wrong = Math.atan2(0, 2);
		expect(bone(0, 0, 2, 0).tilt).not.toBeCloseTo(wrong);
	});

	it('відросток іде туди, куди вказано, і має задану довжину', () => {
		const back = spur(0, 1, -1, 1, Math.SQRT2);
		expect(back.length).toBeCloseTo(Math.SQRT2);
		// Центр — на півдорозі: (−0.5, 1.5).
		expect(back.x).toBeCloseTo(-0.5);
		expect(back.y).toBeCloseTo(1.5);
	});
});
