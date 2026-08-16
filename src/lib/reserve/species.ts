import type { TranslationKey } from '$lib/i18n/translations/uk';

/**
 * Види, яких приймає заповідник, і скільки місця їм треба.
 *
 * Куций список навмисно. У проєкті вже є каталог із 85 тварин, але серед них
 * курка, корова й мураха — заповідник, куди приймають мураху, перестає читатися
 * як заповідник. А ще кожен вид тут потребує ДВОХ чисел, які хтось мусить
 * продумати; для шістдесяти видів половина з них відрізнялася б лише цифрою.
 *
 * Назви беруться з наявного словника (`animal.lion` тощо) — вони вже є
 * чотирма мовами, і другий список імен розійшовся б із першим на першій же
 * правці.
 */

/**
 * Біоми, серед яких обирають на початку партії.
 *
 * Чотири з девʼяти, що є в грі «Де живем?»: там вони — питання вікторини, тут —
 * рівень складності. Ліс дає дев'ять переважно дрібних видів і дешеві вольєри;
 * савана — чотири величезних, кожен із яких вимагає вольєра на пів бюджету.
 *
 * Список свій, а не імпортований із `config/habitat-game`: той тягне
 * `$app/paths` заради картинок, а сюди `$app/` не заходить за інваріантом.
 * Назви збігаються з тамтешніми навмисно — зображення біомів уже лежать під
 * тими самими іменами.
 */
export const RESERVE_BIOMES = ['forest', 'tundra', 'savanna', 'rainforest'] as const;
export type ReserveBiome = (typeof RESERVE_BIOMES)[number];

export interface Species {
	/** Збігається з `id` у каталозі `population-game`: назва спільна. */
	id: string;
	nameKey: TranslationKey;
	/**
	 * Найменший вольєр, у якому вид виживе. Менший — відмова, а не штраф:
	 * лев у їжачій клітці не «повільніше одужує», він там не живе.
	 */
	minSize: number;
	/** Розмір, на який вид розрахований. На ньому швидкості базові. */
	recSize: number;
	/**
	 * Де вид живе НАСПРАВДІ. Заповідник у тундрі не приймає лева — і не тому,
	 * що так цікавіше, а тому що це і є те, чого гра навчає.
	 */
	biomes: readonly ReserveBiome[];
}

/** Скільки взагалі буває розмірів вольєра. */
export const ENCLOSURE_SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/**
 * Наскільки повільніше йде життя в НАЙМЕНШОМУ придатному вольєрі.
 *
 * 0.2 означає вп'ятеро довше — і одужання, і спад стресу. Число велике
 * навмисно: тіснота має бути відчутним рішенням, а не дрібним штрафом, який
 * вигідно ігнорувати заради економії.
 */
const MIN_COMFORT = 0.2;

/** Скільки додає кожен розмір ПОНАД рекомендований. */
const STEP_ABOVE = 0.2;

/**
 * Множник швидкості одужання й спаду стресу для тварини в такому вольєрі.
 *
 * Рахується ВІДНОСНО рекомендованого розміру виду, а не за абсолютним числом:
 * вольєр на 5 — розкіш для їжака й тіснота для слона. Абсолютна шкала зробила б
 * дрібні види безглуздими, бо вони отримували б бонус ні за що.
 *
 * Нижче мінімуму повертається 0 — це не «дуже повільно», а «не можна».
 */
export function comfortOf(species: Species, size: number): number {
	if (size < species.minSize) return 0;
	if (size >= species.recSize) return 1 + STEP_ABOVE * (size - species.recSize);

	// Проміжок між мінімальним і рекомендованим — лінійно. У лева його немає
	// (3 і 4 суміжні), але в бобра з 2 до 4 два кроки, і вони мають щось важити.
	const span = species.recSize - species.minSize;
	return MIN_COMFORT + (1 - MIN_COMFORT) * ((size - species.minSize) / span);
}

/**
 * Від їжака до слона. Дві крайні позиції задають шкалу: якщо найбільшому
 * вистачає дев'ятки, десятка лишається чистою розкішшю, а не обов'язковою.
 */
export const SPECIES: Species[] = [
	{ id: 'hedgehog', nameKey: 'animal.hedgehog', minSize: 1, recSize: 2, biomes: ['forest'] },
	{ id: 'owl', nameKey: 'animal.owl', minSize: 1, recSize: 2, biomes: ['forest', 'tundra'] },
	{ id: 'fox', nameKey: 'animal.fox', minSize: 2, recSize: 3, biomes: ['forest', 'tundra'] },
	{ id: 'raccoon', nameKey: 'animal.raccoon', minSize: 2, recSize: 3, biomes: ['forest'] },
	// Бобру потрібна водойма — звідси розрив у два кроки замість одного.
	{ id: 'beaver', nameKey: 'animal.beaver', minSize: 2, recSize: 4, biomes: ['forest'] },
	// Орлу потрібна висота для польоту, а не площа підлоги.
	{ id: 'eagle', nameKey: 'animal.eagle', minSize: 3, recSize: 5, biomes: ['forest', 'tundra'] },
	{ id: 'wolf', nameKey: 'animal.wolf', minSize: 3, recSize: 5, biomes: ['forest', 'tundra'] },
	{
		id: 'leopard',
		nameKey: 'animal.leopard',
		minSize: 3,
		recSize: 5,
		biomes: ['savanna', 'rainforest']
	},
	// Лев — приклад із технічного завдання, числа взяті звідти дослівно.
	{ id: 'lion', nameKey: 'animal.lion', minSize: 3, recSize: 4, biomes: ['savanna'] },
	{ id: 'deer', nameKey: 'animal.deer', minSize: 4, recSize: 6, biomes: ['forest', 'tundra'] },
	{ id: 'tiger', nameKey: 'animal.tiger', minSize: 4, recSize: 6, biomes: ['rainforest'] },
	{ id: 'bear', nameKey: 'animal.bear', minSize: 4, recSize: 6, biomes: ['forest', 'tundra'] },
	{ id: 'rhino', nameKey: 'animal.rhino', minSize: 6, recSize: 8, biomes: ['savanna'] },
	{
		id: 'elephant',
		nameKey: 'animal.elephant',
		minSize: 7,
		recSize: 9,
		biomes: ['savanna', 'rainforest']
	}
];

export const speciesById = (id: string): Species | undefined =>
	SPECIES.find((species) => species.id === id);

/** Кого приймає заповідник у цьому біомі. Порожній біом був би непрохідним. */
export const speciesOfBiome = (biome: ReserveBiome): Species[] =>
	SPECIES.filter((species) => species.biomes.includes(biome));
