import { animals, type Animal } from './population-game';

/**
 * Дані гри «Хто з іншої родини?».
 *
 * Задум (концепція, гра 5): показати чотири тварини, три з яких належать до
 * однієї біологічної групи, а четверта еволюційно відрізняється — часто саме
 * тоді, коли виглядає чи живе схоже. Мета не «вгадати зайву картинку», а
 * показати конвергентну еволюцію: качкодзьоб має дзьоб і плаває, але це
 * ссавець; черепаха носить панцир, але це плазун.
 *
 * Тварини НЕ дублюються всередині набору, а самі набори підібрані так, щоб
 * жоден не розв'язувався «за виглядом»: у кожному є принаймні одна пастка
 * схожості.
 */

export interface FamilyPuzzle {
	id: string;
	/** Три тварини однієї групи. */
	groupIds: readonly [string, string, string];
	/** Та, що з іншої родини, — правильна відповідь. */
	oddId: string;
	/** Ключ пояснення: чому саме вона зайва. */
	explanationKey: string;
}

export const familyPuzzles: readonly FamilyPuzzle[] = [
	{
		id: 'marine-mammals',
		groupIds: ['dolphin', 'blue_whale', 'seal'],
		oddId: 'shark',
		explanationKey: 'family.marine-mammals.explanation'
	},
	{
		id: 'birds-of-prey',
		groupIds: ['eagle', 'hawk', 'falcon'],
		oddId: 'bat',
		explanationKey: 'family.birds-of-prey.explanation'
	},
	{
		id: 'reptiles',
		groupIds: ['snake', 'lizard', 'turtle'],
		oddId: 'frog',
		explanationKey: 'family.reptiles.explanation'
	},
	{
		id: 'arthropods',
		groupIds: ['ant', 'bee', 'spider'],
		oddId: 'octopus',
		explanationKey: 'family.arthropods.explanation'
	},
	{
		id: 'felids',
		groupIds: ['cat', 'tiger', 'leopard'],
		oddId: 'wolf',
		explanationKey: 'family.felids.explanation'
	},
	{
		id: 'odd-toed',
		groupIds: ['horse', 'zebra', 'rhino'],
		oddId: 'camel',
		explanationKey: 'family.odd-toed.explanation'
	},
	{
		id: 'ruminants',
		groupIds: ['cow', 'sheep', 'deer'],
		oddId: 'pig',
		explanationKey: 'family.ruminants.explanation'
	},
	{
		id: 'water-birds',
		groupIds: ['penguin', 'duck', 'goose'],
		oddId: 'platypus',
		explanationKey: 'family.water-birds.explanation'
	},
	{
		id: 'armoured',
		groupIds: ['hedgehog', 'porcupine', 'armadillo'],
		oddId: 'turtle',
		explanationKey: 'family.armoured.explanation'
	},
	{
		id: 'rodents',
		groupIds: ['hamster', 'rat', 'squirrel'],
		oddId: 'mole',
		explanationKey: 'family.rodents.explanation'
	},
	{
		id: 'bovids',
		groupIds: ['bison', 'yak', 'antelope'],
		oddId: 'deer',
		explanationKey: 'family.bovids.explanation'
	},
	{
		id: 'primates',
		groupIds: ['monkey', 'lemur', 'sifaka'],
		oddId: 'koala',
		explanationKey: 'family.primates.explanation'
	}
];

/** Готовий до показу раунд: чотири картки й та з них, що правильна. */
export interface FamilyRound {
	id: string;
	/** Уже перемішані картки — порядок не має підказувати відповідь. */
	cards: Animal[];
	oddAnimal: Animal;
	explanationKey: string;
}

const byId = new Map(animals.map((animal) => [animal.id, animal]));

/**
 * Розгортає набір в раунд. Повертає `null`, якщо якоїсь тварини немає в
 * каталозі: краще пропустити набір, ніж показати картку без зображення й
 * назви. Мовчазним це не буде — інваріант у тесті вимагає, щоб таких не було
 * жодного.
 */
export function buildRound(puzzle: FamilyPuzzle, shuffle = defaultShuffle): FamilyRound | null {
	const ids = [...puzzle.groupIds, puzzle.oddId];
	const cards = ids.map((id) => byId.get(id));
	if (cards.some((animal) => animal === undefined)) return null;

	const oddAnimal = byId.get(puzzle.oddId)!;
	return {
		id: puzzle.id,
		cards: shuffle(cards as Animal[]),
		oddAnimal,
		explanationKey: puzzle.explanationKey
	};
}

function defaultShuffle(cards: Animal[]): Animal[] {
	return [...cards].sort(() => Math.random() - 0.5);
}

/** Наступний набір, якого ще не показували. `null` — усі вичерпані. */
export function getNextPuzzle(excludeIds: readonly string[] = []): FamilyPuzzle | null {
	const available = familyPuzzles.filter((puzzle) => !excludeIds.includes(puzzle.id));
	if (available.length === 0) return null;
	return available[Math.floor(Math.random() * available.length)];
}
