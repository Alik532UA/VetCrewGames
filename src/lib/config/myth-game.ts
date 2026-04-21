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
		id: 'cow-red',
		animalId: 'cow',
		isTrue: false,
		statementKey: 'myth.cow-red.statement',
		explanationKey: 'myth.cow-red.explanation'
	},
	{
		id: 'cow-stomach',
		animalId: 'cow',
		isTrue: true,
		statementKey: 'myth.cow-stomach.statement',
		explanationKey: 'myth.cow-stomach.explanation'
	},
	{
		id: 'cat-vision',
		animalId: 'cat',
		isTrue: false,
		statementKey: 'myth.cat-vision.statement',
		explanationKey: 'myth.cat-vision.explanation'
	},
	{
		id: 'cat-sleep',
		animalId: 'cat',
		isTrue: true,
		statementKey: 'myth.cat-sleep.statement',
		explanationKey: 'myth.cat-sleep.explanation'
	},
	{
		id: 'dog-bw',
		animalId: 'dog',
		isTrue: false,
		statementKey: 'myth.dog-bw.statement',
		explanationKey: 'myth.dog-bw.explanation'
	},
	{
		id: 'dog-nose',
		animalId: 'dog',
		isTrue: true,
		statementKey: 'myth.dog-nose.statement',
		explanationKey: 'myth.dog-nose.explanation'
	},
	{
		id: 'elephant-trunk',
		animalId: 'elephant',
		isTrue: false,
		statementKey: 'myth.elephant-trunk.statement',
		explanationKey: 'myth.elephant-trunk.explanation'
	},
	{
		id: 'elephant-jump',
		animalId: 'elephant',
		isTrue: true,
		statementKey: 'myth.elephant-jump.statement',
		explanationKey: 'myth.elephant-jump.explanation'
	},
	{
		id: 'ant-sleep',
		animalId: 'ant',
		isTrue: true,
		statementKey: 'myth.ant-sleep.statement',
		explanationKey: 'myth.ant-sleep.explanation'
	},
	{
		id: 'ant-wings',
		animalId: 'ant',
		isTrue: false,
		statementKey: 'myth.ant-wings.statement',
		explanationKey: 'myth.ant-wings.explanation'
	},
	{
		id: 'bee-sting',
		animalId: 'bee',
		isTrue: false,
		statementKey: 'myth.bee-sting.statement',
		explanationKey: 'myth.bee-sting.explanation'
	},
	{
		id: 'bee-dance',
		animalId: 'bee',
		isTrue: true,
		statementKey: 'myth.bee-dance.statement',
		explanationKey: 'myth.bee-dance.explanation'
	},
	{
		id: 'wolf-alpha',
		animalId: 'wolf',
		isTrue: false,
		statementKey: 'myth.wolf-alpha.statement',
		explanationKey: 'myth.wolf-alpha.explanation'
	},
	{
		id: 'wolf-howl',
		animalId: 'wolf',
		isTrue: true,
		statementKey: 'myth.wolf-howl.statement',
		explanationKey: 'myth.wolf-howl.explanation'
	},
	{
		id: 'penguin-love',
		animalId: 'penguin',
		isTrue: false,
		statementKey: 'myth.penguin-love.statement',
		explanationKey: 'myth.penguin-love.explanation'
	},
	{
		id: 'penguin-egg',
		animalId: 'penguin',
		isTrue: true,
		statementKey: 'myth.penguin-egg.statement',
		explanationKey: 'myth.penguin-egg.explanation'
	},
	{
		id: 'dolphin-sleep',
		animalId: 'dolphin',
		isTrue: true,
		statementKey: 'myth.dolphin-sleep.statement',
		explanationKey: 'myth.dolphin-sleep.explanation'
	},
	{
		id: 'dolphin-fish',
		animalId: 'dolphin',
		isTrue: false,
		statementKey: 'myth.dolphin-fish.statement',
		explanationKey: 'myth.dolphin-fish.explanation'
	},
	{
		id: 'parrot-mimic',
		animalId: 'parrot',
		isTrue: false,
		statementKey: 'myth.parrot-mimic.statement',
		explanationKey: 'myth.parrot-mimic.explanation'
	},
	{
		id: 'parrot-age',
		animalId: 'parrot',
		isTrue: true,
		statementKey: 'myth.parrot-age.statement',
		explanationKey: 'myth.parrot-age.explanation'
	},
	{
		id: 'chicken-fly',
		animalId: 'chicken',
		isTrue: false,
		statementKey: 'myth.chicken-fly.statement',
		explanationKey: 'myth.chicken-fly.explanation'
	},
	{
		id: 'chicken-population',
		animalId: 'chicken',
		isTrue: true,
		statementKey: 'myth.chicken-population.statement',
		explanationKey: 'myth.chicken-population.explanation'
	},
	{
		id: 'rat-dirty',
		animalId: 'rat',
		isTrue: false,
		statementKey: 'myth.rat-dirty.statement',
		explanationKey: 'myth.rat-dirty.explanation'
	},
	{
		id: 'rat-laugh',
		animalId: 'rat',
		isTrue: true,
		statementKey: 'myth.rat-laugh.statement',
		explanationKey: 'myth.rat-laugh.explanation'
	},
	{
		id: 'sparrow-migrate',
		animalId: 'sparrow',
		isTrue: false,
		statementKey: 'myth.sparrow-migrate.statement',
		explanationKey: 'myth.sparrow-migrate.explanation'
	},
	{
		id: 'sparrow-human',
		animalId: 'sparrow',
		isTrue: true,
		statementKey: 'myth.sparrow-human.statement',
		explanationKey: 'myth.sparrow-human.explanation'
	},
	{
		id: 'tiger-stripes',
		animalId: 'tiger',
		isTrue: false,
		statementKey: 'myth.tiger-stripes.statement',
		explanationKey: 'myth.tiger-stripes.explanation'
	},
	{
		id: 'tiger-swim',
		animalId: 'tiger',
		isTrue: true,
		statementKey: 'myth.tiger-swim.statement',
		explanationKey: 'myth.tiger-swim.explanation'
	},
	{
		id: 'panda-diet',
		animalId: 'panda',
		isTrue: false,
		statementKey: 'myth.panda-diet.statement',
		explanationKey: 'myth.panda-diet.explanation'
	},
	{
		id: 'panda-thumb',
		animalId: 'panda',
		isTrue: true,
		statementKey: 'myth.panda-thumb.statement',
		explanationKey: 'myth.panda-thumb.explanation'
	},
	{
		id: 'alligator-tongue',
		animalId: 'alligator',
		isTrue: false,
		statementKey: 'myth.alligator-tongue.statement',
		explanationKey: 'myth.alligator-tongue.explanation'
	},
	{
		id: 'alligator-teeth',
		animalId: 'alligator',
		isTrue: true,
		statementKey: 'myth.alligator-teeth.statement',
		explanationKey: 'myth.alligator-teeth.explanation'
	},
	{
		id: 'chameleon-color',
		animalId: 'chameleon',
		isTrue: false,
		statementKey: 'myth.chameleon-color.statement',
		explanationKey: 'myth.chameleon-color.explanation'
	},
	{
		id: 'chameleon-eyes',
		animalId: 'chameleon',
		isTrue: true,
		statementKey: 'myth.chameleon-eyes.statement',
		explanationKey: 'myth.chameleon-eyes.explanation'
	},
	{
		id: 'giraffe-sound',
		animalId: 'giraffe',
		isTrue: false,
		statementKey: 'myth.giraffe-sound.statement',
		explanationKey: 'myth.giraffe-sound.explanation'
	},
	{
		id: 'giraffe-tongue',
		animalId: 'giraffe',
		isTrue: true,
		statementKey: 'myth.giraffe-tongue.statement',
		explanationKey: 'myth.giraffe-tongue.explanation'
	},
	{
		id: 'jellyfish-immortal',
		animalId: 'jellyfish',
		isTrue: false,
		statementKey: 'myth.jellyfish-immortal.statement',
		explanationKey: 'myth.jellyfish-immortal.explanation'
	},
	{
		id: 'jellyfish-brain',
		animalId: 'jellyfish',
		isTrue: true,
		statementKey: 'myth.jellyfish-brain.statement',
		explanationKey: 'myth.jellyfish-brain.explanation'
	},
	{
		id: 'kangaroo-pouch',
		animalId: 'kangaroo',
		isTrue: false,
		statementKey: 'myth.kangaroo-pouch.statement',
		explanationKey: 'myth.kangaroo-pouch.explanation'
	},
	{
		id: 'kangaroo-backward',
		animalId: 'kangaroo',
		isTrue: true,
		statementKey: 'myth.kangaroo-backward.statement',
		explanationKey: 'myth.kangaroo-backward.explanation'
	},
	{
		id: 'lemur-dog',
		animalId: 'lemur',
		isTrue: false,
		statementKey: 'myth.lemur-dog.statement',
		explanationKey: 'myth.lemur-dog.explanation'
	},
	{
		id: 'lemur-madagascar',
		animalId: 'lemur',
		isTrue: true,
		statementKey: 'myth.lemur-madagascar.statement',
		explanationKey: 'myth.lemur-madagascar.explanation'
	},
	{
		id: 'lion-jungle',
		animalId: 'lion',
		isTrue: false,
		statementKey: 'myth.lion-jungle.statement',
		explanationKey: 'myth.lion-jungle.explanation'
	},
	{
		id: 'lion-hunt',
		animalId: 'lion',
		isTrue: true,
		statementKey: 'myth.lion-hunt.statement',
		explanationKey: 'myth.lion-hunt.explanation'
	},
	{
		id: 'monkey-tail',
		animalId: 'monkey',
		isTrue: false,
		statementKey: 'myth.monkey-tail.statement',
		explanationKey: 'myth.monkey-tail.explanation'
	},
	{
		id: 'monkey-tools',
		animalId: 'monkey',
		isTrue: true,
		statementKey: 'myth.monkey-tools.statement',
		explanationKey: 'myth.monkey-tools.explanation'
	},
	{
		id: 'panther-species',
		animalId: 'panther',
		isTrue: false,
		statementKey: 'myth.panther-species.statement',
		explanationKey: 'myth.panther-species.explanation'
	},
	{
		id: 'panther-melanism',
		animalId: 'panther',
		isTrue: true,
		statementKey: 'myth.panther-melanism.statement',
		explanationKey: 'myth.panther-melanism.explanation'
	},
	{
		id: 'peacock-fly',
		animalId: 'peacock',
		isTrue: false,
		statementKey: 'myth.peacock-fly.statement',
		explanationKey: 'myth.peacock-fly.explanation'
	},
	{
		id: 'peacock-male',
		animalId: 'peacock',
		isTrue: true,
		statementKey: 'myth.peacock-male.statement',
		explanationKey: 'myth.peacock-male.explanation'
	},
	{
		id: 'rhino-eyesight',
		animalId: 'rhino',
		isTrue: false,
		statementKey: 'myth.rhino-eyesight.statement',
		explanationKey: 'myth.rhino-eyesight.explanation'
	},
	{
		id: 'rhino-horn',
		animalId: 'rhino',
		isTrue: true,
		statementKey: 'myth.rhino-horn.statement',
		explanationKey: 'myth.rhino-horn.explanation'
	},
	{
		id: 'spider-web',
		animalId: 'spider',
		isTrue: false,
		statementKey: 'myth.spider-web.statement',
		explanationKey: 'myth.spider-web.explanation'
	},
	{
		id: 'spider-arachnid',
		animalId: 'spider',
		isTrue: true,
		statementKey: 'myth.spider-arachnid.statement',
		explanationKey: 'myth.spider-arachnid.explanation'
	},
	{
		id: 'blue_whale-heart',
		animalId: 'blue_whale',
		isTrue: true,
		statementKey: 'myth.blue_whale-heart.statement',
		explanationKey: 'myth.blue_whale-heart.explanation'
	},
	{
		id: 'blue_whale-swallow',
		animalId: 'blue_whale',
		isTrue: false,
		statementKey: 'myth.blue_whale-swallow.statement',
		explanationKey: 'myth.blue_whale-swallow.explanation'
	},
	{
		id: 'deer-speed',
		animalId: 'deer',
		isTrue: true,
		statementKey: 'myth.deer-speed.statement',
		explanationKey: 'myth.deer-speed.explanation'
	},
	{
		id: 'deer-hearing',
		animalId: 'deer',
		isTrue: false,
		statementKey: 'myth.deer-hearing.statement',
		explanationKey: 'myth.deer-hearing.explanation'
	},
	{
		id: 'falcon-dive',
		animalId: 'falcon',
		isTrue: true,
		statementKey: 'myth.falcon-dive.statement',
		explanationKey: 'myth.falcon-dive.explanation'
	},
	{
		id: 'falcon-beak',
		animalId: 'falcon',
		isTrue: false,
		statementKey: 'myth.falcon-beak.statement',
		explanationKey: 'myth.falcon-beak.explanation'
	},
	{
		id: 'frog-freeze',
		animalId: 'frog',
		isTrue: true,
		statementKey: 'myth.frog-freeze.statement',
		explanationKey: 'myth.frog-freeze.explanation'
	},
	{
		id: 'frog-warts',
		animalId: 'frog',
		isTrue: false,
		statementKey: 'myth.frog-warts.statement',
		explanationKey: 'myth.frog-warts.explanation'
	},
	{
		id: 'hippo-swim',
		animalId: 'hippo',
		isTrue: true,
		statementKey: 'myth.hippo-swim.statement',
		explanationKey: 'myth.hippo-swim.explanation'
	},
	{
		id: 'hippo-meat',
		animalId: 'hippo',
		isTrue: false,
		statementKey: 'myth.hippo-meat.statement',
		explanationKey: 'myth.hippo-meat.explanation'
	},
	{
		id: 'leopard-habitat',
		animalId: 'leopard',
		isTrue: true,
		statementKey: 'myth.leopard-habitat.statement',
		explanationKey: 'myth.leopard-habitat.explanation'
	},
	{
		id: 'leopard-jaguar',
		animalId: 'leopard',
		isTrue: false,
		statementKey: 'myth.leopard-jaguar.statement',
		explanationKey: 'myth.leopard-jaguar.explanation'
	},
	{
		id: 'lizard-blood',
		animalId: 'lizard',
		isTrue: true,
		statementKey: 'myth.lizard-blood.statement',
		explanationKey: 'myth.lizard-blood.explanation'
	},
	{
		id: 'lizard-slimy',
		animalId: 'lizard',
		isTrue: false,
		statementKey: 'myth.lizard-slimy.statement',
		explanationKey: 'myth.lizard-slimy.explanation'
	},
	{
		id: 'ostrich-speed',
		animalId: 'ostrich',
		isTrue: true,
		statementKey: 'myth.ostrich-speed.statement',
		explanationKey: 'myth.ostrich-speed.explanation'
	},
	{
		id: 'ostrich-hide',
		animalId: 'ostrich',
		isTrue: false,
		statementKey: 'myth.ostrich-hide.statement',
		explanationKey: 'myth.ostrich-hide.explanation'
	},
	{
		id: 'owl-flight',
		animalId: 'owl',
		isTrue: true,
		statementKey: 'myth.owl-flight.statement',
		explanationKey: 'myth.owl-flight.explanation'
	},
	{
		id: 'owl-blind',
		animalId: 'owl',
		isTrue: false,
		statementKey: 'myth.owl-blind.statement',
		explanationKey: 'myth.owl-blind.explanation'
	},
	{
		id: 'seal-whiskers',
		animalId: 'seal',
		isTrue: true,
		statementKey: 'myth.seal-whiskers.statement',
		explanationKey: 'myth.seal-whiskers.explanation'
	},
	{
		id: 'seal-lion',
		animalId: 'seal',
		isTrue: false,
		statementKey: 'myth.seal-lion.statement',
		explanationKey: 'myth.seal-lion.explanation'
	},
	{
		id: 'stork-nest',
		animalId: 'stork',
		isTrue: true,
		statementKey: 'myth.stork-nest.statement',
		explanationKey: 'myth.stork-nest.explanation'
	},
	{
		id: 'stork-baby',
		animalId: 'stork',
		isTrue: false,
		statementKey: 'myth.stork-baby.statement',
		explanationKey: 'myth.stork-baby.explanation'
	},
	{
		id: 'turtle-gender',
		animalId: 'turtle',
		isTrue: true,
		statementKey: 'myth.turtle-gender.statement',
		explanationKey: 'myth.turtle-gender.explanation'
	},
	{
		id: 'turtle-shell',
		animalId: 'turtle',
		isTrue: false,
		statementKey: 'myth.turtle-shell.statement',
		explanationKey: 'myth.turtle-shell.explanation'
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
