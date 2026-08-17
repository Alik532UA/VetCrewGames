import type { Beast } from './anatomy';
import { innerSpan } from './sceneLayout';

/**
 * Де в тварини що: уся геометрія силуету одним місцем.
 *
 * Окремо від `anatomy.ts` навмисно. Там — ЯКІ тварини бувають (таблиця видів,
 * кольори, прикмети), тут — ДЕ в них частини (шия, писок, хвіст, габарит). Дві
 * різні причини правки: додати вид — це рядок у таблиці, посадити голову
 * інакше — це формула тут. Разом вони не влізли в межу розміру файлу, і це був
 * добрий знак, а не перешкода.
 *
 * Функції тут чисті — саме тому пропорції можна перевірити тестом, а не
 * розглядаючи ізометричну сцену, де слон, який на два сантиметри вилазить за
 * паркан, виглядає точно як слон, що не вилазить.
 */

/** Відрізок як меш: центр, довжина й нахил у площині XY. */
export interface Bone {
	x: number;
	y: number;
	length: number;
	/** Поворот навколо Z. */
	tilt: number;
	/**
	 * Дальній кінець. Мешеві він не потрібен — потрібен ВИМІРУ: габарит тварини
	 * упирається саме в кінчик хвоста або хобота, і рахувати його вдруге на око
	 * означало б розійтися з тим, що справді намальовано.
	 */
	toX: number;
	toY: number;
}

/**
 * Кістка між двома точками.
 *
 * Циліндр і конус у three.js стоять уздовж Y, тож напрямок задається поворотом
 * навколо Z: поворот на θ переводить (0, 1) у (−sin θ, cos θ). Звідси
 * θ = atan2(−dx, dy), а не atan2(dy, dx), як просить рука.
 */
export function bone(fromX: number, fromY: number, toX: number, toY: number): Bone {
	const dx = toX - fromX;
	const dy = toY - fromY;
	return {
		x: (fromX + toX) / 2,
		y: (fromY + toY) / 2,
		length: Math.hypot(dx, dy),
		tilt: Math.atan2(-dx, dy),
		toX,
		toY
	};
}

/** Кістка від точки в НАПРЯМКУ: у хвоста й рогів важливий не кінець, а куди. */
export function spur(
	fromX: number,
	fromY: number,
	dirX: number,
	dirY: number,
	length: number
): Bone {
	const norm = Math.hypot(dirX, dirY) || 1;
	return bone(fromX, fromY, fromX + (dirX / norm) * length, fromY + (dirY / norm) * length);
}

/** Центр тулуба над землею. */
export const hipY = (b: Beast) => b.leg + b.tall / 2;
/** Спина. */
export const backY = (b: Beast) => b.leg + b.tall;
export const headX = (b: Beast) => (b.stance === 'two' ? b.tall * 0.1 : b.len / 2 + b.reach);
export const headY = (b: Beast) =>
	b.stance === 'two' ? b.leg + b.len + b.head * 0.45 : backY(b) + b.lift;
/**
 * Найдальша передня точка.
 *
 * Слон ламає просте «голова плюс писок»: хобот тягнеться далі за морду, і без
 * нього формула ЗАНИЖУВАЛА габарит найбільшої тварини — саме там, де запас до
 * паркана найменший. Виміряно в браузері: 5.17 проти справжніх 5.61.
 */
export const noseX = (b: Beast) =>
	headX(b) + Math.max(b.head + b.muzzle, b.mark === 'trunk' ? b.head * 1.3 : 0);

export function tailLength(b: Beast): number {
	if (b.tail === 'none') return 0;
	if (b.tail === 'bushy') return b.len * 0.5;
	if (b.tail === 'flat') return b.len * 0.4;
	if (b.tail === 'fan') return b.len * 0.45;
	return b.tall * 0.3;
}

/**
 * Куди відходить хвіст. Ті самі числа й малюють його, і міряють.
 *
 * Розписані двічі вони збрехали б: задертий хвіст лиса відходить назад не на всю
 * свою довжину, а на три чверті, — і формула габариту, яка про це не знала,
 * давала на сім відсотків більше, ніж є.
 */
const TAIL_DIR: Record<Beast['tail'], [number, number]> = {
	bushy: [-0.75, 0.66],
	flat: [-0.95, -0.2],
	stub: [-0.9, 0.4],
	fan: [-0.9, -0.45],
	none: [0, 0]
};

export function tailOf(b: Beast): Bone {
	const [dirX, dirY] = TAIL_DIR[b.tail];
	const fromX = b.stance === 'two' ? -b.tall * 0.3 : -b.len / 2;
	const fromY =
		b.stance === 'two'
			? b.leg + b.len * 0.35
			: hipY(b) + b.tall * (b.tail === 'flat' ? -0.1 : 0.18);
	return spur(fromX, fromY, dirX, dirY, tailLength(b));
}

/** Шия: від передньої верхівки тулуба до центра голови. */
export const neckOf = (b: Beast): Bone =>
	bone(b.len / 2 - b.tall * 0.15, hipY(b) + b.tall * 0.25, headX(b), headY(b));

/** Від кінчика хвоста до кінчика писка. Найдовший вимір по горизонталі. */
export function spanOf(b: Beast): number {
	const body = b.stance === 'two' ? -b.tall / 2 : -b.len / 2;
	return noseX(b) - Math.min(body, tailOf(b).toX);
}

/**
 * Від землі до найвищої точки.
 *
 * Надбавки збігаються з тим, що справді малює `AnimalMark`: гілка рогів іде на
 * 1.9 радіуса голови в напрямку (−0.3, 1), звідси 1.35 понад тім'я. Округлити
 * «із запасом» тут не можна — тоді число перестає бути виміром і перевірка на
 * ньому нічого не варта.
 *
 * Хвіст рахується разом із головою, бо в котів виграє саме він: у леопарда
 * задертий хвіст доходить до 1.14 при тім'ї на 1.10 — виміряно в браузері.
 */
export function heightOf(b: Beast): number {
	const eared = b.ear === 'pointed' || b.ear === 'tuft';
	const crown = b.mark === 'antlers' ? b.head * 1.35 : eared ? b.head * 0.15 : 0;
	return Math.max(headY(b) + b.head + crown, tailOf(b).toY);
}

/**
 * Найбільший вимір силуету — по ньому й судять, чи його видно.
 *
 * Саме НАЙБІЛЬШИЙ, а не довжина. Довжина обманює двоногих: орел стоїть, тож від
 * грудей до хвоста в нього менше метра, а заввишки він майже два. Міряний
 * довжиною, він виходив плямою на одинадцять відсотків вольєра — і це показав
 * тест, а не око.
 */
export const bulkOf = (b: Beast) => Math.max(spanOf(b), heightOf(b));

/**
 * Яку частку ширини вольєра займає силует.
 *
 * Це головне число всієї роботи. Одне «влазить / не влазить» пропустило б і
 * слона, що проліз крізь паркан, і їжака-точку, якого немає сенсу малювати. А
 * частка ловить обидва боки одразу — і тримає всі види в одному масштабі
 * ВІДНОСНО їхнього житла, а не відносно метра.
 */
export const shareOf = (b: Beast, size: number) => bulkOf(b) / innerSpan(size);
