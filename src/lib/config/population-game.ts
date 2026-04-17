import { base } from '$app/paths';

export interface Animal {
	id: string;
	nameKey: string;
	population: number;
	factKey: string;
	image: string;
}

export const animals: Animal[] = [
	{
		id: 'chicken',
		nameKey: 'animal.chicken',
		population: 33_000_000_000,
		factKey: 'fact.chicken',
		image: `${base}/images/animals/chicken.jpg`
	},
	{
		id: 'cow',
		nameKey: 'animal.cow',
		population: 1_000_000_000,
		factKey: 'fact.cow',
		image: `${base}/images/animals/cow.jpg`
	},
	{
		id: 'dog',
		nameKey: 'animal.dog',
		population: 500_000_000,
		factKey: 'fact.dog',
		image: `${base}/images/animals/dog.jpg`
	},
	{
		id: 'cat',
		nameKey: 'animal.cat',
		population: 600_000_000,
		factKey: 'fact.cat',
		image: `${base}/images/animals/cat.jpg`
	},
	{
		id: 'rat',
		nameKey: 'animal.rat',
		population: 7_000_000_000,
		factKey: 'fact.rat',
		image: `${base}/images/animals/rat.png`
	},
	{
		id: 'sparrow',
		nameKey: 'animal.sparrow',
		population: 1_600_000_000,
		factKey: 'fact.sparrow',
		image: `${base}/images/animals/sparrow.jpg`
	},
	{
		id: 'ant',
		nameKey: 'animal.ant',
		population: 20_000_000_000_000,
		factKey: 'fact.ant',
		image: `${base}/images/animals/ant.jpg`
	},
	{
		id: 'elephant',
		nameKey: 'animal.elephant',
		population: 415_000,
		factKey: 'fact.elephant',
		image: `${base}/images/animals/elephant.jpg`
	},
	{
		id: 'tiger',
		nameKey: 'animal.tiger',
		population: 4_500,
		factKey: 'fact.tiger',
		image: `${base}/images/animals/tiger.jpg`
	},
	{
		id: 'penguin',
		nameKey: 'animal.penguin',
		population: 30_000_000,
		factKey: 'fact.penguin',
		image: `${base}/images/animals/penguin.jpg`
	},
	{
		id: 'bee',
		nameKey: 'animal.bee',
		population: 2_000_000_000_000,
		factKey: 'fact.bee',
		image: `${base}/images/animals/bee.jpg`
	},
	{
		id: 'panda',
		nameKey: 'animal.panda',
		population: 1_864,
		factKey: 'fact.panda',
		image: `${base}/images/animals/panda.jpg`
	},
	{
		id: 'wolf',
		nameKey: 'animal.wolf',
		population: 300_000,
		factKey: 'fact.wolf',
		image: `${base}/images/animals/wolf.jpg`
	},
	{
		id: 'dolphin',
		nameKey: 'animal.dolphin',
		population: 12_000_000,
		factKey: 'fact.dolphin',
		image: `${base}/images/animals/dolphin.jpg`
	},
	{
		id: 'parrot',
		nameKey: 'animal.parrot',
		population: 50_000_000,
		factKey: 'fact.parrot',
		image: `${base}/images/animals/parrot.jpg`
	}
];

/** Pick N random unique animals from the dataset */
export function getRandomAnimals(count: number): Animal[] {
	const shuffled = [...animals].sort(() => Math.random() - 0.5);
	return shuffled.slice(0, count);
}
