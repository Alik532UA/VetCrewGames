import { shuffle } from '$lib/utils/seededRandom';
import { asset } from '$app/paths';

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
		image: asset('/images/animals/chicken.webp')
	},
	{
		id: 'cow',
		nameKey: 'animal.cow',
		population: 1_000_000_000,
		factKey: 'fact.cow',
		image: asset('/images/animals/cow.webp')
	},
	{
		id: 'dog',
		nameKey: 'animal.dog',
		population: 500_000_000,
		factKey: 'fact.dog',
		image: asset('/images/animals/dog.webp')
	},
	{
		id: 'cat',
		nameKey: 'animal.cat',
		population: 600_000_000,
		factKey: 'fact.cat',
		image: asset('/images/animals/cat.webp')
	},
	{
		id: 'rat',
		nameKey: 'animal.rat',
		population: 7_000_000_000,
		factKey: 'fact.rat',
		image: asset('/images/animals/rat.webp')
	},
	{
		id: 'sparrow',
		nameKey: 'animal.sparrow',
		population: 1_600_000_000,
		factKey: 'fact.sparrow',
		image: asset('/images/animals/sparrow.webp')
	},
	{
		id: 'ant',
		nameKey: 'animal.ant',
		population: 20_000_000_000_000,
		factKey: 'fact.ant',
		image: asset('/images/animals/ant.webp')
	},
	{
		id: 'elephant',
		nameKey: 'animal.elephant',
		population: 415_000,
		factKey: 'fact.elephant',
		image: asset('/images/animals/elephant.webp')
	},
	{
		id: 'tiger',
		nameKey: 'animal.tiger',
		population: 4_500,
		factKey: 'fact.tiger',
		image: asset('/images/animals/tiger.webp')
	},
	{
		id: 'penguin',
		nameKey: 'animal.penguin',
		population: 30_000_000,
		factKey: 'fact.penguin',
		image: asset('/images/animals/penguin.webp')
	},
	{
		id: 'bee',
		nameKey: 'animal.bee',
		population: 2_000_000_000_000,
		factKey: 'fact.bee',
		image: asset('/images/animals/bee.webp')
	},
	{
		id: 'panda',
		nameKey: 'animal.panda',
		population: 1_864,
		factKey: 'fact.panda',
		image: asset('/images/animals/panda.webp')
	},
	{
		id: 'wolf',
		nameKey: 'animal.wolf',
		population: 300_000,
		factKey: 'fact.wolf',
		image: asset('/images/animals/wolf.webp')
	},
	{
		id: 'dolphin',
		nameKey: 'animal.dolphin',
		population: 12_000_000,
		factKey: 'fact.dolphin',
		image: asset('/images/animals/dolphin.webp')
	},
	{
		id: 'parrot',
		nameKey: 'animal.parrot',
		population: 50_000_000,
		factKey: 'fact.parrot',
		image: asset('/images/animals/parrot.webp')
	},
	{
		id: 'alligator',
		nameKey: 'animal.alligator',
		population: 5_000_000,
		factKey: 'fact.alligator',
		image: asset('/images/animals/alligator.webp')
	},
	{
		id: 'chameleon',
		nameKey: 'animal.chameleon',
		population: 100_000_000,
		factKey: 'fact.chameleon',
		image: asset('/images/animals/chameleon.webp')
	},
	{
		id: 'giraffe',
		nameKey: 'animal.giraffe',
		population: 117_000,
		factKey: 'fact.giraffe',
		image: asset('/images/animals/giraffe.webp')
	},
	{
		id: 'jellyfish',
		nameKey: 'animal.jellyfish',
		population: 1_000_000_000_000,
		factKey: 'fact.jellyfish',
		image: asset('/images/animals/jellyfish.webp')
	},
	{
		id: 'kangaroo',
		nameKey: 'animal.kangaroo',
		population: 50_000_000,
		factKey: 'fact.kangaroo',
		image: asset('/images/animals/kangaroo.webp')
	},
	{
		id: 'lemur',
		nameKey: 'animal.lemur',
		population: 2_000,
		factKey: 'fact.lemur',
		image: asset('/images/animals/lemur.webp')
	},
	{
		id: 'lion',
		nameKey: 'animal.lion',
		population: 20_000,
		factKey: 'fact.lion',
		image: asset('/images/animals/lion.webp')
	},
	{
		id: 'monkey',
		nameKey: 'animal.monkey',
		population: 1_000_000_000,
		factKey: 'fact.monkey',
		image: asset('/images/animals/monkey.webp')
	},
	{
		id: 'panther',
		nameKey: 'animal.panther',
		population: 250_000,
		factKey: 'fact.panther',
		image: asset('/images/animals/panther.webp')
	},
	{
		id: 'peacock',
		nameKey: 'animal.peacock',
		population: 100_000,
		factKey: 'fact.peacock',
		image: asset('/images/animals/peacock.webp')
	},
	{
		id: 'rhino',
		nameKey: 'animal.rhino',
		population: 27_000,
		factKey: 'fact.rhino',
		image: asset('/images/animals/rhino.webp')
	},
	{
		id: 'spider',
		nameKey: 'animal.spider',
		population: 21_000_000_000_000,
		factKey: 'fact.spider',
		image: asset('/images/animals/spider.webp')
	},
	{
		id: 'blue_whale',
		nameKey: 'animal.blue_whale',
		population: 25000,
		factKey: 'fact.blue_whale',
		image: asset('/images/animals/blue_whale.webp')
	},
	{
		id: 'deer',
		nameKey: 'animal.deer',
		population: 100000000,
		factKey: 'fact.deer',
		image: asset('/images/animals/deer.webp')
	},
	{
		id: 'falcon',
		nameKey: 'animal.falcon',
		population: 100000,
		factKey: 'fact.falcon',
		image: asset('/images/animals/falcon.webp')
	},
	{
		id: 'frog',
		nameKey: 'animal.frog',
		population: 5000000000,
		factKey: 'fact.frog',
		image: asset('/images/animals/frog.webp')
	},
	{
		id: 'hippo',
		nameKey: 'animal.hippo',
		population: 130000,
		factKey: 'fact.hippo',
		image: asset('/images/animals/hippo.webp')
	},
	{
		id: 'leopard',
		nameKey: 'animal.leopard',
		population: 50000,
		factKey: 'fact.leopard',
		image: asset('/images/animals/leopard.webp')
	},
	{
		id: 'lizard',
		nameKey: 'animal.lizard',
		population: 10000000000,
		factKey: 'fact.lizard',
		image: asset('/images/animals/lizard.webp')
	},
	{
		id: 'ostrich',
		nameKey: 'animal.ostrich',
		population: 150000,
		factKey: 'fact.ostrich',
		image: asset('/images/animals/ostrich.webp')
	},
	{
		id: 'owl',
		nameKey: 'animal.owl',
		population: 10000000,
		factKey: 'fact.owl',
		image: asset('/images/animals/owl.webp')
	},
	{
		id: 'seal',
		nameKey: 'animal.seal',
		population: 5000000,
		factKey: 'fact.seal',
		image: asset('/images/animals/seal.webp')
	},
	{
		id: 'stork',
		nameKey: 'animal.stork',
		population: 500000,
		factKey: 'fact.stork',
		image: asset('/images/animals/stork.webp')
	},
	{
		id: 'turtle',
		nameKey: 'animal.turtle',
		population: 1000000000,
		factKey: 'fact.turtle',
		image: asset('/images/animals/turtle.webp')
	},
	{
		id: 'antelope',
		nameKey: 'animal.antelope',
		population: 2000000,
		factKey: 'fact.antelope',
		image: asset('/images/animals/antelope.webp')
	},
	{
		id: 'armadillo',
		nameKey: 'animal.armadillo',
		population: 50000000,
		factKey: 'fact.armadillo',
		image: asset('/images/animals/armadillo.webp')
	},
	{
		id: 'axolotl',
		nameKey: 'animal.axolotl',
		population: 1000,
		factKey: 'fact.axolotl',
		image: asset('/images/animals/axolotl.webp')
	},
	{
		id: 'bat',
		nameKey: 'animal.bat',
		population: 50000000000,
		factKey: 'fact.bat',
		image: asset('/images/animals/bat.webp')
	},
	{
		id: 'bear',
		nameKey: 'animal.bear',
		population: 500000,
		factKey: 'fact.bear',
		image: asset('/images/animals/bear.webp')
	},
	{
		id: 'beaver',
		nameKey: 'animal.beaver',
		population: 15000000,
		factKey: 'fact.beaver',
		image: asset('/images/animals/beaver.webp')
	},
	{
		id: 'bison',
		nameKey: 'animal.bison',
		population: 500000,
		factKey: 'fact.bison',
		image: asset('/images/animals/bison.webp')
	},
	{
		id: 'camel',
		nameKey: 'animal.camel',
		population: 35000000,
		factKey: 'fact.camel',
		image: asset('/images/animals/camel.webp')
	},
	{
		id: 'capybara',
		nameKey: 'animal.capybara',
		population: 1000000,
		factKey: 'fact.capybara',
		image: asset('/images/animals/capybara.webp')
	},
	{
		id: 'crow',
		nameKey: 'animal.crow',
		population: 1000000000,
		factKey: 'fact.crow',
		image: asset('/images/animals/crow.webp')
	},
	{
		id: 'dodo',
		nameKey: 'animal.dodo',
		population: 0,
		factKey: 'fact.dodo',
		image: asset('/images/animals/dodo.webp')
	},
	{
		id: 'duck',
		nameKey: 'animal.duck',
		population: 1000000000,
		factKey: 'fact.duck',
		image: asset('/images/animals/duck.webp')
	},
	{
		id: 'eagle',
		nameKey: 'animal.eagle',
		population: 1000000,
		factKey: 'fact.eagle',
		image: asset('/images/animals/eagle.webp')
	},
	{
		id: 'flamingo',
		nameKey: 'animal.flamingo',
		population: 5000000,
		factKey: 'fact.flamingo',
		image: asset('/images/animals/flamingo.webp')
	},
	{
		id: 'fox',
		nameKey: 'animal.fox',
		population: 10000000,
		factKey: 'fact.fox',
		image: asset('/images/animals/fox.webp')
	},
	{
		id: 'giant_anteater',
		nameKey: 'animal.giant_anteater',
		population: 5000,
		factKey: 'fact.giant_anteater',
		image: asset('/images/animals/giant_anteater.webp')
	},
	{
		id: 'goose',
		nameKey: 'animal.goose',
		population: 350000000,
		factKey: 'fact.goose',
		image: asset('/images/animals/goose.webp')
	},
	{
		id: 'hamster',
		nameKey: 'animal.hamster',
		population: 10000000,
		factKey: 'fact.hamster',
		image: asset('/images/animals/hamster.webp')
	},
	{
		id: 'hawk',
		nameKey: 'animal.hawk',
		population: 15000000,
		factKey: 'fact.hawk',
		image: asset('/images/animals/hawk.webp')
	},
	{
		id: 'hedgehog',
		nameKey: 'animal.hedgehog',
		population: 50000000,
		factKey: 'fact.hedgehog',
		image: asset('/images/animals/hedgehog.webp')
	},
	{
		id: 'honey_badger',
		nameKey: 'animal.honey_badger',
		population: 500000,
		factKey: 'fact.honey_badger',
		image: asset('/images/animals/honey_badger.webp')
	},
	{
		id: 'horse',
		nameKey: 'animal.horse',
		population: 60000000,
		factKey: 'fact.horse',
		image: asset('/images/animals/horse.webp')
	},
	{
		id: 'koala',
		nameKey: 'animal.koala',
		population: 330000,
		factKey: 'fact.koala',
		image: asset('/images/animals/koala.webp')
	},
	{
		id: 'mammoth',
		nameKey: 'animal.mammoth',
		population: 0,
		factKey: 'fact.mammoth',
		image: asset('/images/animals/mammoth.webp')
	},
	{
		id: 'manta_ray',
		nameKey: 'animal.manta_ray',
		population: 150000,
		factKey: 'fact.manta_ray',
		image: asset('/images/animals/manta_ray.webp')
	},
	{
		id: 'manul',
		nameKey: 'animal.manul',
		population: 58000,
		factKey: 'fact.manul',
		image: asset('/images/animals/manul.webp')
	},
	{
		id: 'mole',
		nameKey: 'animal.mole',
		population: 1000000000,
		factKey: 'fact.mole',
		image: asset('/images/animals/mole.webp')
	},
	{
		id: 'octopus',
		nameKey: 'animal.octopus',
		population: 300000000,
		factKey: 'fact.octopus',
		image: asset('/images/animals/octopus.webp')
	},
	{
		id: 'passenger_pigeon',
		nameKey: 'animal.passenger_pigeon',
		population: 0,
		factKey: 'fact.passenger_pigeon',
		image: asset('/images/animals/passenger_pigeon.webp')
	},
	{
		id: 'pelican',
		nameKey: 'animal.pelican',
		population: 1000000,
		factKey: 'fact.pelican',
		image: asset('/images/animals/pelican.webp')
	},
	{
		id: 'pig',
		nameKey: 'animal.pig',
		population: 1000000000,
		factKey: 'fact.pig',
		image: asset('/images/animals/pig.webp')
	},
	{
		id: 'platypus',
		nameKey: 'animal.platypus',
		population: 300000,
		factKey: 'fact.platypus',
		image: asset('/images/animals/platypus.webp')
	},
	{
		id: 'porcupine',
		nameKey: 'animal.porcupine',
		population: 10000000,
		factKey: 'fact.porcupine',
		image: asset('/images/animals/porcupine.webp')
	},
	{
		id: 'raccoon',
		nameKey: 'animal.raccoon',
		population: 20000000,
		factKey: 'fact.raccoon',
		image: asset('/images/animals/raccoon.webp')
	},
	{
		id: 'red_panda',
		nameKey: 'animal.red_panda',
		population: 10000,
		factKey: 'fact.red_panda',
		image: asset('/images/animals/red_panda.webp')
	},
	{
		id: 'shark',
		nameKey: 'animal.shark',
		population: 1000000000,
		factKey: 'fact.shark',
		image: asset('/images/animals/shark.webp')
	},
	{
		id: 'sheep',
		nameKey: 'animal.sheep',
		population: 1200000000,
		factKey: 'fact.sheep',
		image: asset('/images/animals/sheep.webp')
	},
	{
		id: 'sifaka',
		nameKey: 'animal.sifaka',
		population: 10000,
		factKey: 'fact.sifaka',
		image: asset('/images/animals/sifaka.webp')
	},
	{
		id: 'sloth',
		nameKey: 'animal.sloth',
		population: 1000000,
		factKey: 'fact.sloth',
		image: asset('/images/animals/sloth.webp')
	},
	{
		id: 'snake',
		nameKey: 'animal.snake',
		population: 3000000000,
		factKey: 'fact.snake',
		image: asset('/images/animals/snake.webp')
	},
	{
		id: 'squirrel',
		nameKey: 'animal.squirrel',
		population: 3000000000,
		factKey: 'fact.squirrel',
		image: asset('/images/animals/squirrel.webp')
	},
	{
		id: 'toucan',
		nameKey: 'animal.toucan',
		population: 10000000,
		factKey: 'fact.toucan',
		image: asset('/images/animals/toucan.webp')
	},
	{
		id: 'walrus',
		nameKey: 'animal.walrus',
		population: 250000,
		factKey: 'fact.walrus',
		image: asset('/images/animals/walrus.webp')
	},
	{
		id: 'weasel',
		nameKey: 'animal.weasel',
		population: 50000000,
		factKey: 'fact.weasel',
		image: asset('/images/animals/weasel.webp')
	},
	{
		id: 'yak',
		nameKey: 'animal.yak',
		population: 15000000,
		factKey: 'fact.yak',
		image: asset('/images/animals/yak.webp')
	},
	{
		id: 'zebra',
		nameKey: 'animal.zebra',
		population: 750000,
		factKey: 'fact.zebra',
		image: asset('/images/animals/zebra.webp')
	}
];

/**
 * `count` різних тварин із каталогу.
 *
 * Тасування — Фішер-Йетс, а не `sort(() => Math.random() - 0.5)`. Той ідіом не
 * просто недетермінований: він дає НЕРІВНОМІРНИЙ розподіл, бо компаратор
 * порушує транзитивність і результат залежить від алгоритму сортування. Тобто
 * частина тварин траплялася гравцеві частіше за інших — тихо й без жодної
 * причини. Те саме було в грі 5.
 */
export function getRandomAnimals(count: number, random: () => number): Animal[] {
	return shuffle(animals, random).slice(0, count);
}
