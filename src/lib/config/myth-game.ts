import { animals, type Animal } from './population-game';

export interface MythStatement {
	id: string;
	animalId: string;
	isTrue: boolean;
	statementKey: string;
	explanationKey: string;
}

/** 
 * Central registry of animal myths.
 * Scalable to hundreds of animals and thousands of statements.
 */
export const myths: MythStatement[] = [
	{
		id: 'cow-red-color',
		animalId: 'cow',
		isTrue: false,
		statementKey: 'myth.cow.red.statement',
		explanationKey: 'myth.cow.red.explanation'
	},
	{
		id: 'cat-night-vision',
		animalId: 'cat',
		isTrue: false,
		statementKey: 'myth.cat.vision.statement',
		explanationKey: 'myth.cat.vision.explanation'
	},
	{
		id: 'dog-see-bw',
		animalId: 'dog',
		isTrue: false,
		statementKey: 'myth.dog.bw.statement',
		explanationKey: 'myth.dog.bw.explanation'
	},
	{
		id: 'elephant-water-trunk',
		animalId: 'elephant',
		isTrue: false,
		statementKey: 'myth.elephant.trunk.statement',
		explanationKey: 'myth.elephant.trunk.explanation'
	},
	{
		id: 'ant-sleep',
		animalId: 'ant',
		isTrue: true,
		statementKey: 'myth.ant.sleep.statement',
		explanationKey: 'myth.ant.sleep.explanation'
	},
	{
		id: 'bee-die-sting',
		animalId: 'bee',
		isTrue: false, // Only honey bees die, not all bees
		statementKey: 'myth.bee.sting.statement',
		explanationKey: 'myth.bee.sting.explanation'
	},
	{
		id: 'wolf-alpha',
		animalId: 'wolf',
		isTrue: false,
		statementKey: 'myth.wolf.alpha.statement',
		explanationKey: 'myth.wolf.alpha.explanation'
	},
	{
		id: 'penguin-monogamy',
		animalId: 'penguin',
		isTrue: false, // Most but not all, and often only for a season
		statementKey: 'myth.penguin.love.statement',
		explanationKey: 'myth.penguin.love.explanation'
	}
];

export interface GameQuestion extends MythStatement {
	animal: Animal;
}

export function getNextQuestion(excludeIds: string[] = []): GameQuestion | null {
	const available = myths.filter(m => !excludeIds.includes(m.id));
	if (available.length === 0) return null;
	
	const randomMyth = available[Math.floor(Math.random() * available.length)];
	const animal = animals.find(a => a.id === randomMyth.animalId)!;
	
	return {
		...randomMyth,
		animal
	};
}
