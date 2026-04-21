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
		image: `${base}/images/animals/chicken.webp`
	},
	{
		id: 'cow',
		nameKey: 'animal.cow',
		population: 1_000_000_000,
		factKey: 'fact.cow',
		image: `${base}/images/animals/cow.webp`
	},
	{
		id: 'dog',
		nameKey: 'animal.dog',
		population: 500_000_000,
		factKey: 'fact.dog',
		image: `${base}/images/animals/dog.webp`
	},
	{
		id: 'cat',
		nameKey: 'animal.cat',
		population: 600_000_000,
		factKey: 'fact.cat',
		image: `${base}/images/animals/cat.webp`
	},
	{
		id: 'rat',
		nameKey: 'animal.rat',
		population: 7_000_000_000,
		factKey: 'fact.rat',
		image: `${base}/images/animals/rat.webp`
	},
	{
		id: 'sparrow',
		nameKey: 'animal.sparrow',
		population: 1_600_000_000,
		factKey: 'fact.sparrow',
		image: `${base}/images/animals/sparrow.webp`
	},
	{
		id: 'ant',
		nameKey: 'animal.ant',
		population: 20_000_000_000_000,
		factKey: 'fact.ant',
		image: `${base}/images/animals/ant.webp`
	},
	{
		id: 'elephant',
		nameKey: 'animal.elephant',
		population: 415_000,
		factKey: 'fact.elephant',
		image: `${base}/images/animals/elephant.webp`
	},
	{
		id: 'tiger',
		nameKey: 'animal.tiger',
		population: 4_500,
		factKey: 'fact.tiger',
		image: `${base}/images/animals/tiger.webp`
	},
	{
		id: 'penguin',
		nameKey: 'animal.penguin',
		population: 30_000_000,
		factKey: 'fact.penguin',
		image: `${base}/images/animals/penguin.webp`
	},
	{
		id: 'bee',
		nameKey: 'animal.bee',
		population: 2_000_000_000_000,
		factKey: 'fact.bee',
		image: `${base}/images/animals/bee.webp`
	},
	{
		id: 'panda',
		nameKey: 'animal.panda',
		population: 1_864,
		factKey: 'fact.panda',
		image: `${base}/images/animals/panda.webp`
	},
	{
		id: 'wolf',
		nameKey: 'animal.wolf',
		population: 300_000,
		factKey: 'fact.wolf',
		image: `${base}/images/animals/wolf.webp`
	},
	{
		id: 'dolphin',
		nameKey: 'animal.dolphin',
		population: 12_000_000,
		factKey: 'fact.dolphin',
		image: `${base}/images/animals/dolphin.webp`
	},
	{
		id: 'parrot',
		nameKey: 'animal.parrot',
		population: 50_000_000,
		factKey: 'fact.parrot',
		image: `${base}/images/animals/parrot.webp`
	},
	{
		id: 'alligator',
		nameKey: 'animal.alligator',
		population: 5_000_000,
		factKey: 'fact.alligator',
		image: `${base}/images/animals/alligator.webp`
	},
	{
		id: 'chameleon',
		nameKey: 'animal.chameleon',
		population: 100_000_000,
		factKey: 'fact.chameleon',
		image: `${base}/images/animals/chameleon.webp`
	},
	{
		id: 'giraffe',
		nameKey: 'animal.giraffe',
		population: 117_000,
		factKey: 'fact.giraffe',
		image: `${base}/images/animals/giraffe.webp`
	},
	{
		id: 'jellyfish',
		nameKey: 'animal.jellyfish',
		population: 1_000_000_000_000,
		factKey: 'fact.jellyfish',
		image: `${base}/images/animals/jellyfish.webp`
	},
	{
		id: 'kangaroo',
		nameKey: 'animal.kangaroo',
		population: 50_000_000,
		factKey: 'fact.kangaroo',
		image: `${base}/images/animals/kangaroo.webp`
	},
	{
		id: 'lemur',
		nameKey: 'animal.lemur',
		population: 2_000,
		factKey: 'fact.lemur',
		image: `${base}/images/animals/lemur.webp`
	},
	{
		id: 'lion',
		nameKey: 'animal.lion',
		population: 20_000,
		factKey: 'fact.lion',
		image: `${base}/images/animals/lion.webp`
	},
	{
		id: 'monkey',
		nameKey: 'animal.monkey',
		population: 1_000_000_000,
		factKey: 'fact.monkey',
		image: `${base}/images/animals/monkey.webp`
	},
	{
		id: 'panther',
		nameKey: 'animal.panther',
		population: 250_000,
		factKey: 'fact.panther',
		image: `${base}/images/animals/panther.webp`
	},
	{
		id: 'peacock',
		nameKey: 'animal.peacock',
		population: 100_000,
		factKey: 'fact.peacock',
		image: `${base}/images/animals/peacock.webp`
	},
	{
		id: 'rhino',
		nameKey: 'animal.rhino',
		population: 27_000,
		factKey: 'fact.rhino',
		image: `${base}/images/animals/rhino.webp`
	},
	{
		id: 'spider',
		nameKey: 'animal.spider',
		population: 21_000_000_000_000,
		factKey: 'fact.spider',
		image: `${base}/images/animals/spider.webp`
	},
	{
		id: 'blue_whale',
		nameKey: 'animal.blue_whale',
		population: 25000,
		factKey: 'fact.blue_whale',
		image: `${base}/images/animals/blue_whale.webp`
	},
	{
		id: 'deer',
		nameKey: 'animal.deer',
		population: 100000000,
		factKey: 'fact.deer',
		image: `${base}/images/animals/deer.webp`
	},
	{
		id: 'falcon',
		nameKey: 'animal.falcon',
		population: 100000,
		factKey: 'fact.falcon',
		image: `${base}/images/animals/falcon.webp`
	},
	{
		id: 'frog',
		nameKey: 'animal.frog',
		population: 5000000000,
		factKey: 'fact.frog',
		image: `${base}/images/animals/frog.webp`
	},
	{
		id: 'hippo',
		nameKey: 'animal.hippo',
		population: 130000,
		factKey: 'fact.hippo',
		image: `${base}/images/animals/hippo.webp`
	},
	{
		id: 'leopard',
		nameKey: 'animal.leopard',
		population: 50000,
		factKey: 'fact.leopard',
		image: `${base}/images/animals/leopard.webp`
	},
	{
		id: 'lizard',
		nameKey: 'animal.lizard',
		population: 10000000000,
		factKey: 'fact.lizard',
		image: `${base}/images/animals/lizard.webp`
	},
	{
		id: 'ostrich',
		nameKey: 'animal.ostrich',
		population: 150000,
		factKey: 'fact.ostrich',
		image: `${base}/images/animals/ostrich.webp`
	},
	{
		id: 'owl',
		nameKey: 'animal.owl',
		population: 10000000,
		factKey: 'fact.owl',
		image: `${base}/images/animals/owl.webp`
	},
	{
		id: 'seal',
		nameKey: 'animal.seal',
		population: 5000000,
		factKey: 'fact.seal',
		image: `${base}/images/animals/seal.webp`
	},
	{
		id: 'stork',
		nameKey: 'animal.stork',
		population: 500000,
		factKey: 'fact.stork',
		image: `${base}/images/animals/stork.webp`
	},
	{
		id: 'turtle',
		nameKey: 'animal.turtle',
		population: 1000000000,
		factKey: 'fact.turtle',
		image: `${base}/images/animals/turtle.webp`
	}
];

/** Pick N random unique animals from the dataset */
export function getRandomAnimals(count: number): Animal[] {
	const shuffled = [...animals].sort(() => Math.random() - 0.5);
	return shuffled.slice(0, count);
}
