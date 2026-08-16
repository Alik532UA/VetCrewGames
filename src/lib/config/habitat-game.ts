import { asset } from '$app/paths';
import { animals, type Animal } from './population-game';

/**
 * Дані гри «Де живем?» (концепція, гра 3).
 *
 * Два підрежими, як і задумано: континенти й біоми. Відповідей у кожному
 * питанні може бути кілька — саме тому це множинний вибір, а не одна кнопка:
 * лев живе і в Африці, і в Індії, а вовк — на трьох континентах одразу.
 *
 * `noteKey` — не «пояснення правильної відповіді», а окремий випадок із
 * концепції: вид, завезений людиною туди, де його не було. Верблюди в
 * Австралії й єноти в Європі виглядають як помилка гравця, хоча насправді
 * це помилка людства, і про це варто сказати.
 */

export const CONTINENTS = [
	'africa',
	'asia',
	'europe',
	'north-america',
	'south-america',
	'australia',
	'antarctica'
] as const;

export const BIOMES = [
	'desert',
	'rainforest',
	'forest',
	'savanna',
	'grassland',
	'mountains',
	'tundra',
	'ocean',
	'freshwater'
] as const;

/**
 * Зображення варіанта. Ім'я файлу збігається з ключем, каталог — із режимом.
 *
 * Каталог `continents` — ЛАТИНОЮ. Спочатку він приїхав із кириличною «с»
 * (U+0441): на вигляд той самий рядок, а шлях латиною давав би 404 на
 * GitHub Pages, і знайти це оком неможливо. Стереже інваріант «у `static/`
 * немає не-ASCII в іменах».
 */
export const habitatImage = (mode: HabitatMode, option: string): string =>
	asset(`/images/${mode === 'continents' ? 'continents' : 'biomes'}/${option}.webp`);

export type Continent = (typeof CONTINENTS)[number];
export type Biome = (typeof BIOMES)[number];
export type HabitatMode = 'continents' | 'biomes';

export interface HabitatEntry {
	animalId: string;
	/** Де вид живе В ДИКІЙ ПРИРОДІ. Порожній список означає «режим не для нього». */
	continents: readonly Continent[];
	biomes: readonly Biome[];
	/** Необовʼязкова примітка: завезений вид, ендемік, окрема популяція. */
	noteKey?: string;
}

export const habitatEntries: readonly HabitatEntry[] = [
	{
		animalId: 'lion',
		continents: ['africa', 'asia'],
		biomes: ['savanna', 'grassland'],
		noteKey: 'habitat.lion.note'
	},
	{
		animalId: 'kangaroo',
		continents: ['australia'],
		biomes: ['grassland', 'desert']
	},
	{
		animalId: 'camel',
		continents: ['africa', 'asia'],
		biomes: ['desert'],
		noteKey: 'habitat.camel.note'
	},
	{
		animalId: 'tiger',
		continents: ['asia'],
		biomes: ['rainforest', 'forest', 'grassland']
	},
	{
		animalId: 'panda',
		continents: ['asia'],
		biomes: ['mountains', 'forest']
	},
	{
		animalId: 'elephant',
		continents: ['africa', 'asia'],
		biomes: ['savanna', 'rainforest', 'grassland']
	},
	{
		animalId: 'sloth',
		continents: ['south-america'],
		biomes: ['rainforest']
	},
	{
		animalId: 'capybara',
		continents: ['south-america'],
		biomes: ['freshwater', 'grassland']
	},
	{
		animalId: 'bison',
		continents: ['north-america', 'europe'],
		biomes: ['grassland', 'forest'],
		noteKey: 'habitat.bison.note'
	},
	{
		animalId: 'hippo',
		continents: ['africa'],
		biomes: ['freshwater', 'grassland']
	},
	{
		animalId: 'lemur',
		continents: ['africa'],
		biomes: ['rainforest', 'forest'],
		noteKey: 'habitat.lemur.note'
	},
	{
		animalId: 'wolf',
		continents: ['north-america', 'europe', 'asia'],
		biomes: ['forest', 'tundra', 'grassland', 'mountains']
	},
	{
		animalId: 'platypus',
		continents: ['australia'],
		biomes: ['freshwater']
	},
	{
		animalId: 'penguin',
		continents: ['antarctica', 'south-america', 'africa', 'australia'],
		biomes: ['ocean'],
		noteKey: 'habitat.penguin.note'
	},
	{
		animalId: 'raccoon',
		continents: ['north-america'],
		biomes: ['forest', 'freshwater'],
		noteKey: 'habitat.raccoon.note'
	},
	{
		animalId: 'yak',
		continents: ['asia'],
		biomes: ['mountains']
	},
	{
		animalId: 'red_panda',
		continents: ['asia'],
		biomes: ['mountains', 'forest']
	},
	{
		animalId: 'ostrich',
		continents: ['africa'],
		biomes: ['savanna', 'desert', 'grassland']
	}
];

/** Готовий раунд: тварина, набір варіантів і правильна відповідь. */
export interface HabitatRound {
	animal: Animal;
	mode: HabitatMode;
	options: readonly string[];
	correct: readonly string[];
	noteKey?: string;
}

const byId = new Map(animals.map((animal) => [animal.id, animal]));

/**
 * Розгортає запис у раунд. `null`, якщо тварини немає в каталозі або в цьому
 * підрежимі для неї немає жодної правильної відповіді: питання без відповіді
 * гірше за пропущене питання.
 */
export function buildHabitatRound(entry: HabitatEntry, mode: HabitatMode): HabitatRound | null {
	const animal = byId.get(entry.animalId);
	if (!animal) return null;

	const correct = mode === 'continents' ? entry.continents : entry.biomes;
	if (correct.length === 0) return null;

	return {
		animal,
		mode,
		options: mode === 'continents' ? CONTINENTS : BIOMES,
		correct,
		noteKey: entry.noteKey
	};
}

/** Наступний запис, якого ще не показували в цій партії. */
export function getNextHabitatEntry(excludeIds: readonly string[] = []): HabitatEntry | null {
	const available = habitatEntries.filter((entry) => !excludeIds.includes(entry.animalId));
	if (available.length === 0) return null;
	return available[Math.floor(Math.random() * available.length)];
}
