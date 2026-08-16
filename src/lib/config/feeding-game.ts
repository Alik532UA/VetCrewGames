import { asset } from '$app/paths';
import { animals, type Animal } from './population-game';

/**
 * Дані гри «Що їмо?» (концепція, гра 1).
 *
 * Механіка: дві тварини, три страви й смітник. Кожну страву треба віддати
 * тій тварині, якій вона підходить, або викинути — якщо не підходить жодній.
 * Саме смітник і робить гру грою: без нього достатньо було б розкласти три
 * картки по двох тваринах навмання.
 *
 * Небезпечні страви тут не вигадані «неправильні відповіді», а справжні:
 * шоколад, цибуля й авокадо токсичні, хліб і молоко шкодять інакше. Через це
 * пояснення до них важливіші за очко за раунд.
 */

/**
 * Ім'я файлу збігається з `id` страви — саме тому тут одна функція, а не
 * поле `image` у кожному записі: п'ятнадцять рядків, які нічого не додають,
 * розходяться з реальністю на першому ж перейменуванні.
 *
 * Наявність усіх файлів звіряє інваріант у `feedingGame.svelte.test.ts`:
 * зображення, якого немає, дає порожню картку, і на зібраному сайті це видно
 * лише оком.
 */
const foodImage = (id: string): string => asset(`/images/food/${id}.webp`);

export interface Food {
	id: string;
	nameKey: string;
	image: string;
	/** Кому ця страва підходить. Порожній список означає «лише в смітник». */
	suitableFor: readonly string[];
	/** Чому вона корисна — показується, коли її віддали правильній тварині. */
	goodKey: string;
	/** Чому її не можна давати — показується, коли її місце в смітнику. */
	hazardKey?: string;
}

export const foods: readonly Food[] = [
	{
		id: 'hay',
		nameKey: 'food.hay',
		image: foodImage('hay'),
		suitableFor: ['cow', 'horse', 'capybara', 'yak', 'sheep'],
		goodKey: 'food.hay.good'
	},
	{
		id: 'bamboo',
		nameKey: 'food.bamboo',
		image: foodImage('bamboo'),
		suitableFor: ['panda'],
		goodKey: 'food.bamboo.good'
	},
	{
		id: 'fish',
		nameKey: 'food.fish',
		image: foodImage('fish'),
		suitableFor: ['penguin', 'seal', 'bear', 'cat'],
		goodKey: 'food.fish.good'
	},
	{
		id: 'meat',
		nameKey: 'food.meat',
		image: foodImage('meat'),
		suitableFor: ['tiger', 'wolf', 'lion', 'dog'],
		goodKey: 'food.meat.good'
	},
	{
		id: 'eucalyptus',
		nameKey: 'food.eucalyptus',
		image: foodImage('eucalyptus'),
		suitableFor: ['koala'],
		goodKey: 'food.eucalyptus.good'
	},
	{
		id: 'nuts',
		nameKey: 'food.nuts',
		image: foodImage('nuts'),
		suitableFor: ['squirrel', 'parrot', 'monkey'],
		goodKey: 'food.nuts.good'
	},
	{
		id: 'fruit',
		nameKey: 'food.fruit',
		image: foodImage('fruit'),
		suitableFor: ['monkey', 'parrot', 'elephant'],
		goodKey: 'food.fruit.good'
	},
	{
		id: 'insects',
		nameKey: 'food.insects',
		image: foodImage('insects'),
		suitableFor: ['hedgehog', 'chicken', 'frog', 'giant_anteater'],
		goodKey: 'food.insects.good'
	},
	{
		id: 'grain',
		nameKey: 'food.grain',
		image: foodImage('grain'),
		suitableFor: ['chicken', 'sparrow', 'goose'],
		goodKey: 'food.grain.good'
	},
	{
		id: 'krill',
		nameKey: 'food.krill',
		image: foodImage('krill'),
		suitableFor: ['blue_whale', 'penguin', 'seal'],
		goodKey: 'food.krill.good'
	},

	// Далі — те, що завжди їде у смітник.
	{
		id: 'chocolate',
		nameKey: 'food.chocolate',
		image: foodImage('chocolate'),
		suitableFor: [],
		goodKey: 'food.chocolate.good',
		hazardKey: 'food.chocolate.hazard'
	},
	{
		id: 'onion',
		nameKey: 'food.onion',
		image: foodImage('onion'),
		suitableFor: [],
		goodKey: 'food.onion.good',
		hazardKey: 'food.onion.hazard'
	},
	{
		id: 'bread',
		nameKey: 'food.bread',
		image: foodImage('bread'),
		suitableFor: [],
		goodKey: 'food.bread.good',
		hazardKey: 'food.bread.hazard'
	},
	{
		id: 'milk',
		nameKey: 'food.milk',
		image: foodImage('milk'),
		suitableFor: [],
		goodKey: 'food.milk.good',
		hazardKey: 'food.milk.hazard'
	},
	{
		id: 'avocado',
		nameKey: 'food.avocado',
		image: foodImage('avocado'),
		suitableFor: [],
		goodKey: 'food.avocado.good',
		hazardKey: 'food.avocado.hazard'
	}
];

export interface FeedingSet {
	id: string;
	animalIds: readonly [string, string];
	foodIds: readonly [string, string, string];
}

/**
 * Набори складені вручну, а не згенеровані: у кожному одна страва підходить
 * першій тварині, друга — другій, третя не підходить нікому. Випадковий
 * добір рано чи пізно дав би страву, яка пасує обом, і тоді в питання було б
 * дві правильні відповіді.
 */
export const feedingSets: readonly FeedingSet[] = [
	{ id: 'cow-tiger', animalIds: ['cow', 'tiger'], foodIds: ['hay', 'meat', 'chocolate'] },
	{ id: 'panda-penguin', animalIds: ['panda', 'penguin'], foodIds: ['bamboo', 'fish', 'bread'] },
	{ id: 'koala-monkey', animalIds: ['koala', 'monkey'], foodIds: ['eucalyptus', 'fruit', 'onion'] },
	{ id: 'horse-cat', animalIds: ['horse', 'cat'], foodIds: ['hay', 'fish', 'milk'] },
	{ id: 'chicken-squirrel', animalIds: ['chicken', 'squirrel'], foodIds: ['grain', 'nuts', 'chocolate'] },
	{ id: 'hedgehog-capybara', animalIds: ['hedgehog', 'capybara'], foodIds: ['insects', 'hay', 'avocado'] },
	{ id: 'elephant-wolf', animalIds: ['elephant', 'wolf'], foodIds: ['fruit', 'meat', 'bread'] },
	{ id: 'parrot-seal', animalIds: ['parrot', 'seal'], foodIds: ['nuts', 'fish', 'avocado'] },
	{ id: 'whale-sheep', animalIds: ['blue_whale', 'sheep'], foodIds: ['krill', 'hay', 'onion'] },
	{ id: 'lion-anteater', animalIds: ['lion', 'giant_anteater'], foodIds: ['meat', 'insects', 'milk'] }
];

/** Куди страва має потрапити: до однієї з тварин або в смітник. */
export const BIN = 'bin' as const;
export type Target = string | typeof BIN;

export interface FeedingRound {
	id: string;
	animals: readonly [Animal, Animal];
	foods: readonly Food[];
}

const animalById = new Map(animals.map((animal) => [animal.id, animal]));
const foodById = new Map(foods.map((food) => [food.id, food]));

/** Правильна ціль для страви в цьому раунді. */
export function correctTarget(food: Food, animalIds: readonly string[]): Target {
	return animalIds.find((id) => food.suitableFor.includes(id)) ?? BIN;
}

export function buildFeedingRound(set: FeedingSet): FeedingRound | null {
	const roundAnimals = set.animalIds.map((id) => animalById.get(id));
	const roundFoods = set.foodIds.map((id) => foodById.get(id));
	if (roundAnimals.some((a) => !a) || roundFoods.some((f) => !f)) return null;

	return {
		id: set.id,
		animals: roundAnimals as [Animal, Animal],
		foods: roundFoods as Food[]
	};
}

export function getNextFeedingSet(excludeIds: readonly string[] = []): FeedingSet | null {
	const available = feedingSets.filter((set) => !excludeIds.includes(set.id));
	if (available.length === 0) return null;
	return available[Math.floor(Math.random() * available.length)];
}
