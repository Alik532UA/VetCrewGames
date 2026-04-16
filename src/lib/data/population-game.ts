import { base } from '$app/paths';

export interface Animal {
	id: string;
	nameKey: string;
	population: number;
	populationLabel: string;
	factKey: string;
	image: string;
}

export const animals: Animal[] = [
	{
		id: 'chicken',
		nameKey: 'animal.chicken',
		population: 33_000_000_000,
		populationLabel: '~33 млрд',
		factKey: 'fact.chicken',
		image: `${base}/animals/chicken.jpg`
	},
	{
		id: 'cow',
		nameKey: 'animal.cow',
		population: 1_000_000_000,
		populationLabel: '~1 млрд',
		factKey: 'fact.cow',
		image: `${base}/animals/cow.jpg`
	},
	{
		id: 'dog',
		nameKey: 'animal.dog',
		population: 500_000_000,
		populationLabel: '~500 млн',
		factKey: 'fact.dog',
		image: `${base}/animals/dog.jpg`
	},
	{
		id: 'cat',
		nameKey: 'animal.cat',
		population: 600_000_000,
		populationLabel: '~600 млн',
		factKey: 'fact.cat',
		image: `${base}/animals/cat.jpg`
	},
	{
		id: 'rat',
		nameKey: 'animal.rat',
		population: 7_000_000_000,
		populationLabel: '~7 млрд',
		factKey: 'fact.rat',
		image: `${base}/animals/rat.png`
	},
	{
		id: 'sparrow',
		nameKey: 'animal.sparrow',
		population: 1_600_000_000,
		populationLabel: '~1.6 млрд',
		factKey: 'fact.sparrow',
		image: `${base}/animals/sparrow.jpg`
	},
	{
		id: 'ant',
		nameKey: 'animal.ant',
		population: 20_000_000_000_000,
		populationLabel: '~20 трлн',
		factKey: 'fact.ant',
		image: `${base}/animals/ant.jpg`
	},
	{
		id: 'elephant',
		nameKey: 'animal.elephant',
		population: 415_000,
		populationLabel: '~415 тис',
		factKey: 'fact.elephant',
		image: `${base}/animals/elephant.jpg`
	},
	{
		id: 'tiger',
		nameKey: 'animal.tiger',
		population: 4_500,
		populationLabel: '~4 500',
		factKey: 'fact.tiger',
		image: `${base}/animals/tiger.jpg`
	},
	{
		id: 'penguin',
		nameKey: 'animal.penguin',
		population: 30_000_000,
		populationLabel: '~30 млн',
		factKey: 'fact.penguin',
		image: `${base}/animals/penguin.jpg`
	},
	{
		id: 'bee',
		nameKey: 'animal.bee',
		population: 2_000_000_000_000,
		populationLabel: '~2 трлн',
		factKey: 'fact.bee',
		image: `${base}/animals/bee.jpg`
	},
	{
		id: 'panda',
		nameKey: 'animal.panda',
		population: 1_864,
		populationLabel: '~1 864',
		factKey: 'fact.panda',
		image: `${base}/animals/panda.jpg`
	},
	{
		id: 'wolf',
		nameKey: 'animal.wolf',
		population: 300_000,
		populationLabel: '~300 тис',
		factKey: 'fact.wolf',
		image: `${base}/animals/wolf.jpg`
	},
	{
		id: 'dolphin',
		nameKey: 'animal.dolphin',
		population: 12_000_000,
		populationLabel: '~12 млн',
		factKey: 'fact.dolphin',
		image: `${base}/animals/dolphin.jpg`
	},
	{
		id: 'parrot',
		nameKey: 'animal.parrot',
		population: 50_000_000,
		populationLabel: '~50 млн',
		factKey: 'fact.parrot',
		image: `${base}/animals/parrot.jpg`
	}
];

/** Pick N random unique animals from the dataset */
export function getRandomAnimals(count: number): Animal[] {
	const shuffled = [...animals].sort(() => Math.random() - 0.5);
	return shuffled.slice(0, count);
}
