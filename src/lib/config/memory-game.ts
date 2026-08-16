import { animals, type Animal } from './population-game';

/**
 * Дані гри «Знайди пару»: колода з парних карток тварин.
 *
 * **Колода будується з ЗЕРНА, а не з `Math.random()`.** Це не педантизм: гра
 * задумана й під спільну партію, а там усі учасники мусять бачити ту саму
 * розкладку. Із випадковістю «на місці» синхронізувати її можна було б лише
 * надсиланням усієї колоди; із зерном достатньо одного числа. Заразом це
 * робить правила придатними для тестів без моків.
 */

export interface MemoryCard {
	/** Унікальний у колоді: одна тварина дає дві картки з різними `id`. */
	id: string;
	/** Що з чим збігається. У пари він спільний — на ньому й тримається гра. */
	pairKey: string;
	nameKey: string;
	image: string;
}

/**
 * Скільки пар на дошці. Більше — довша партія, а не складніша арифметика.
 *
 * Чотирнадцять, бо дошка має лягати ПОВНИМИ рядами: на типовій ширині в ряд
 * стає сім карток, і 28 дають рівно чотири ряди. Вісім пар давали 16 карток —
 * два ряди по сім і хвостик із двох, що читався як недомальована сітка.
 */
export const MEMORY_PAIRS = 14;

/**
 * Колода для телефона: десять пар, тобто сітка 4×5.
 *
 * На вузькому екрані в ряд стає чотири картки, і чотирнадцять пар дають сім
 * рядів — заміряно на 390×844: колода 815px при 610 доступних, тобто партію
 * доводиться гортати. Гра ж уся про те, щоб ПАМ'ЯТАТИ, де що лежить, а половина
 * поля за краєм екрана цю пам'ять не тренує, а обнуляє.
 *
 * Десять, а не дванадцять: 4×5 влазить без зменшення карток (85×113 на тому ж
 * екрані), а 4×6 уже довелося б стискати.
 */
export const MEMORY_PAIRS_COMPACT = 10;

/** Розкладка колоди: скільки пар і на скільки колонок їх класти. */
export interface MemoryLayout {
	pairs: number;
	cols: number;
}

/**
 * Розкладка під поточний екран.
 *
 * Кількість колонок повертається РАЗОМ із кількістю пар, бо це одне рішення:
 * десять пар у сім колонок дають два ряди й хвостик, чотирнадцять у чотири —
 * сім рядів, під які місця не рахували. Доти колонки задавав медіазапит, а
 * пари — ця функція, і зв'язок між ними тримався на тому, що обидва пороги
 * випадково однакові.
 *
 * Викликати можна лише в браузері: `matchMedia` під час prerender не існує.
 */
export function layoutForViewport(): MemoryLayout {
	return window.matchMedia('(max-width: 559px)').matches
		? { pairs: MEMORY_PAIRS_COMPACT, cols: 4 }
		: { pairs: MEMORY_PAIRS, cols: 7 };
}

/**
 * Генератор mulberry32: тридцять два біти стану, одна функція, жодних
 * залежностей. Потрібен саме передбачуваний — див. докблок файлу.
 */
function seededRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Тасування Фішера — Йетса на тому ж зерні. */
function shuffle<T>(items: T[], random: () => number): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/**
 * Колода на `pairs` пар із зерна `seed`.
 *
 * Те саме зерно завжди дає ту саму колоду — і ту саму розкладку в усіх, хто
 * грає разом.
 */
export function buildDeck(seed: number, pairs: number = MEMORY_PAIRS): MemoryCard[] {
	const random = seededRandom(seed);
	const chosen: Animal[] = shuffle([...animals], random).slice(0, pairs);

	const deck = chosen.flatMap((animal) => [
		{ id: `${animal.id}-a`, pairKey: animal.id, nameKey: animal.nameKey, image: animal.image },
		{ id: `${animal.id}-b`, pairKey: animal.id, nameKey: animal.nameKey, image: animal.image }
	]);

	return shuffle(deck, random);
}
