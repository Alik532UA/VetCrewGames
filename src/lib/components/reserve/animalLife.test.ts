// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { LEG_SECONDS, poseAt, type Habitat } from './animalLife';

/**
 * ЖИТТЯ ТВАРИНИ: перевіряються властивості, а не картинка.
 *
 * ## Чому саме ці
 *
 * Рух легко зробити «на вигляд правильним» і зламати непомітно. Кожен пункт
 * нижче — це те, що ламається одним символом і чого оком не побачиш:
 *
 *  * **у межах паркана.** Помилка в множнику — і лев виходить крізь загорожу.
 *    З ізометрії, та ще й у порі, коли він у дальньому куті, це побачить не
 *    кожен, а вигляд гри це руйнує повністю;
 *  * **відтворюваність.** Уся річ у тому, що це ВИГЛЯД, а не симуляція: поза —
 *    чиста функція, і після перезавантаження та сама тварина мусить стояти там
 *    само. Один `Math.random()` усередині — і сцена «сама собою» міняється;
 *  * **сусіди не синхронні.** Без домішування `id` у хеш два леви в сусідніх
 *    вольєрах ходили б однаково, як танцюристи. Це найяскравіший дефект з усіх,
 *    і побачити його можна лише маючи двох тварин одночасно;
 *  * **води немає — не плаває.** Поведінка виводиться з того, що гравець КУПИВ;
 *    інакше водойма перестає бути покупкою;
 *  * **стоянка справді буває.** Якщо частка ходьби доїде до одиниці, тварина
 *    почне бігати без спину — тобто зникне саме те, чого просив автор («іноді
 *    стоять»).
 *
 * Зворотні експерименти (AI-AGENT-PITFALLS-v8 § 1.1), усі зроблені: `MARGIN`
 * піднято до 1.4 — червоніє «не виходить за паркан»; `id` прибрано з `hash` —
 * червоніє «сусіди не ходять синхронно»; `WALK_SHARE` піднято до 1 — червоніє
 * «на кроці буває і рух, і стоянка»; `SPECIAL_SHARE` піднято до 1 — червоніє
 * «без водойми не плаває» лишається зеленим, а от «ходить не лише по двох
 * точках» червоніє.
 */

const PLAIN: Habitat = { half: 2, water: false, shelter: false };
const RICH: Habitat = { half: 2, water: true, shelter: true };

/** Проходимо крок дрібно: усі пункти дивляться на ту саму сітку моментів. */
const SAMPLES = 400;
const STEP = (LEG_SECONDS * 8) / SAMPLES;
const moments = Array.from({ length: SAMPLES }, (_, i) => i * STEP);

describe('життя тварини у вольєрі', () => {
	it('перевірка жива: поза рахується й тварина рухається', () => {
		const first = poseAt(11, 1, 0, PLAIN);
		const later = poseAt(11, 1, LEG_SECONDS * 0.3, PLAIN);
		expect(first).toBeTruthy();
		expect(
			Math.hypot(later.x - first.x, later.z - first.z),
			'за третину кроку тварина не зрушила з місця'
		).toBeGreaterThan(0.01);
	});

	it('не виходить за паркан', () => {
		for (const place of [PLAIN, RICH]) {
			for (const id of [1, 2, 7, 42]) {
				for (const phase of moments) {
					const pose = poseAt(11, id, phase, place);
					expect(Math.abs(pose.x), `id ${id}, фаза ${phase}`).toBeLessThanOrEqual(place.half);
					expect(Math.abs(pose.z), `id ${id}, фаза ${phase}`).toBeLessThanOrEqual(place.half);
				}
			}
		}
	});

	it('та сама мить — та сама поза', () => {
		// Це і є доказ, що річ у ВИГЛЯДІ, а не в симуляції: стану немає ніде.
		for (const phase of moments.slice(0, 40)) {
			expect(poseAt(11, 3, phase, RICH)).toEqual(poseAt(11, 3, phase, RICH));
		}
	});

	it('інше зерно — інший маршрут', () => {
		// Без цього пункту попередній нічого не вартий: стала функція теж «чиста».
		const a = moments.slice(0, 40).map((phase) => poseAt(11, 3, phase, PLAIN).x);
		const b = moments.slice(0, 40).map((phase) => poseAt(12, 3, phase, PLAIN).x);
		expect(a).not.toEqual(b);
	});

	it('сусіди не ходять синхронно', () => {
		/*
		 * Найяскравіший дефект цього класу: два леви в сусідніх вольєрах, що роблять
		 * те саме в ту саму мить. Тому `id` домішується в хеш, а не додається до
		 * зерна — сусідні числа в лінійному змішувачі дали б сусідні маршрути.
		 */
		const one = moments.map((phase) => poseAt(11, 1, phase, PLAIN));
		const two = moments.map((phase) => poseAt(11, 2, phase, PLAIN));
		const apart = one.filter(
			(pose, i) => Math.hypot(pose.x - two[i].x, pose.z - two[i].z) > 0.2
		).length;
		expect(apart / one.length, 'дві тварини майже завжди в одному місці').toBeGreaterThan(0.7);
	});

	it('на кроці буває і рух, і стоянка', () => {
		const doings = moments.map((phase) => poseAt(11, 5, phase, PLAIN).doing);
		expect(doings.filter((d) => d === 'walk').length, 'ніколи не йде').toBeGreaterThan(0);
		expect(doings.filter((d) => d !== 'walk').length, 'ніколи не стоїть').toBeGreaterThan(0);
	});

	it('без водойми не плаває, без укриття не ховається', () => {
		const doings = new Set(moments.map((phase) => poseAt(11, 9, phase, PLAIN).doing));
		expect([...doings].sort(), 'у пустому вольєрі є щось, крім ходьби й стоянки').toEqual([
			'rest',
			'walk'
		]);
	});

	it('з водоймою й укриттям робить і те, і те', () => {
		const seen = new Set<string>();
		for (const id of [1, 2, 3, 4, 5, 6]) {
			for (const phase of moments) seen.add(poseAt(11, id, phase, RICH).doing);
		}
		expect([...seen].sort()).toEqual(['rest', 'shelter', 'swim', 'walk']);
	});

	it('ходить не лише по двох точках', () => {
		/*
		 * Особливі цілі не мусять з'їдати всі кроки: істота, що ходить водойма →
		 * укриття → водойма, читається як механізм, а не як тварина.
		 */
		const rests = moments.filter((phase) => poseAt(11, 4, phase, RICH).doing === 'rest');
		expect(rests.length, 'звичайних стоянок немає зовсім').toBeGreaterThan(0);
	});

	it('дивиться туди, куди йде', () => {
		// Напрямок виводиться з самого руху, а не з окремого числа: інакше тварина
		// ходила б боком, і це видно одразу.
		const before = poseAt(11, 6, LEG_SECONDS * 0.1, PLAIN);
		const after = poseAt(11, 6, LEG_SECONDS * 0.5, PLAIN);
		const moved = Math.atan2(after.x - before.x, after.z - before.z);
		expect(Math.abs(Math.sin(moved - after.turn)), 'погляд не вздовж руху').toBeLessThan(0.05);
	});
});

/**
 * ОБВʼЯЗКА РУХУ: формула чиста, а от її ввімкнення — ні.
 *
 * Сама `poseAt` перевірена вище прогоном. Тут — три рішення, які живуть у
 * компонентах і ламаються тихо:
 *
 *  * рух спиняється РАЗОМ ІЗ ГРОЮ. Сцена малюється на вимогу (`invalidate`), тож
 *    рух означає постійний рендер шестисот сімдесяти фігур рельєфу. Без цієї
 *    умови пауза перестала б бути паузою для полотна — а телефон платить за це
 *    батареєю;
 *  * кадрів не шістдесят на секунду. Тварина йде повільно, і на такій швидкості
 *    20 Гц від 60 оком не відрізнити;
 *  * поведінка виводиться з КУПЛЕНИХ модулів. Інакше водойма перестає бути
 *    покупкою: плавати можна було б і без неї.
 *
 * Зворотні експерименти (AI-AGENT-PITFALLS-v8 § 1.1): прибрано `if (!running)` —
 * червоніє «рух спиняється разом із грою»; прибрано `ANIM_EVERY_MS` — червоніє
 * «кадри обмежені»; у `EnclosureShape` `water` замінено на `true` — червоніє
 * «поведінка з куплених модулів». Усі три зроблені.
 */
describe('обвʼязка руху в сцені', () => {
	const read = async (path: string) => (await import('node:fs')).readFileSync(path, 'utf8');

	it('рух спиняється разом із грою', async () => {
		const scene = await read('src/lib/components/reserve/SceneBody.svelte');
		expect(scene, 'цикл кадрів не питає, чи йде час').toMatch(/if \(!running\) return;/);
		const page = await read('src/lib/components/reserve/ReserveGame.svelte');
		expect(page, 'сторінка не каже сцені про паузу').toMatch(/running=\{game\.speed !== 0\}/);
	});

	it('кадри обмежені, а не шістдесят на секунду', async () => {
		const scene = await read('src/lib/components/reserve/SceneBody.svelte');
		expect(scene, 'немає межі частоти кадрів руху').toMatch(/ANIM_EVERY_MS/);
		expect(scene, 'кадр не запитується після зсуву фази').toMatch(/invalidate\(\)/);
	});

	it('поведінка виводиться з куплених модулів', async () => {
		const shape = await read('src/lib/components/reserve/EnclosureShape.svelte');
		expect(shape, 'водойма не питається у вольєра').toMatch(
			/water: enclosure\.modules\.includes\('water'\)/
		);
		expect(shape, 'укриття не питається у вольєра').toMatch(
			/shelter: equipped\(enclosure, 'shelter'\)/
		);
	});
});
