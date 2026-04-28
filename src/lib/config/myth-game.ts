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
		isTrue: false,
		statementKey: 'myth.ant-sleep.statement',
		explanationKey: 'myth.ant-sleep.explanation'
	},
	{
		id: 'ant-wings',
		animalId: 'ant',
		isTrue: true,
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
	},
	{
		id: 'antelope-horns',
		animalId: 'antelope',
		isTrue: true,
		statementKey: 'myth.antelope-horns.statement',
		explanationKey: 'myth.antelope-horns.explanation'
	},
	{
		id: 'antelope-diet',
		animalId: 'antelope',
		isTrue: false,
		statementKey: 'myth.antelope-diet.statement',
		explanationKey: 'myth.antelope-diet.explanation'
	},
	{
		id: 'armadillo-bullet',
		animalId: 'armadillo',
		isTrue: true,
		statementKey: 'myth.armadillo-bullet.statement',
		explanationKey: 'myth.armadillo-bullet.explanation'
	},
	{
		id: 'armadillo-ball',
		animalId: 'armadillo',
		isTrue: false,
		statementKey: 'myth.armadillo-ball.statement',
		explanationKey: 'myth.armadillo-ball.explanation'
	},
	{
		id: 'axolotl-lungs',
		animalId: 'axolotl',
		isTrue: true,
		statementKey: 'myth.axolotl-lungs.statement',
		explanationKey: 'myth.axolotl-lungs.explanation'
	},
	{
		id: 'axolotl-land',
		animalId: 'axolotl',
		isTrue: false,
		statementKey: 'myth.axolotl-land.statement',
		explanationKey: 'myth.axolotl-land.explanation'
	},
	{
		id: 'bat-blind',
		animalId: 'bat',
		isTrue: false,
		statementKey: 'myth.bat-blind.statement',
		explanationKey: 'myth.bat-blind.explanation'
	},
	{
		id: 'bat-blood',
		animalId: 'bat',
		isTrue: true,
		statementKey: 'myth.bat-blood.statement',
		explanationKey: 'myth.bat-blood.explanation'
	},
	{
		id: 'bear-run',
		animalId: 'bear',
		isTrue: false,
		statementKey: 'myth.bear-run.statement',
		explanationKey: 'myth.bear-run.explanation'
	},
	{
		id: 'bear-winter',
		animalId: 'bear',
		isTrue: true,
		statementKey: 'myth.bear-winter.statement',
		explanationKey: 'myth.bear-winter.explanation'
	},
	{
		id: 'beaver-tail',
		animalId: 'beaver',
		isTrue: true,
		statementKey: 'myth.beaver-tail.statement',
		explanationKey: 'myth.beaver-tail.explanation'
	},
	{
		id: 'beaver-fish',
		animalId: 'beaver',
		isTrue: false,
		statementKey: 'myth.beaver-fish.statement',
		explanationKey: 'myth.beaver-fish.explanation'
	},
	{
		id: 'bison-snow',
		animalId: 'bison',
		isTrue: true,
		statementKey: 'myth.bison-snow.statement',
		explanationKey: 'myth.bison-snow.explanation'
	},
	{
		id: 'bison-cow',
		animalId: 'bison',
		isTrue: false,
		statementKey: 'myth.bison-cow.statement',
		explanationKey: 'myth.bison-cow.explanation'
	},
	{
		id: 'camel-water',
		animalId: 'camel',
		isTrue: false,
		statementKey: 'myth.camel-water.statement',
		explanationKey: 'myth.camel-water.explanation'
	},
	{
		id: 'camel-drink',
		animalId: 'camel',
		isTrue: true,
		statementKey: 'myth.camel-drink.statement',
		explanationKey: 'myth.camel-drink.explanation'
	},
	{
		id: 'capybara-water',
		animalId: 'capybara',
		isTrue: true,
		statementKey: 'myth.capybara-water.statement',
		explanationKey: 'myth.capybara-water.explanation'
	},
	{
		id: 'capybara-predator',
		animalId: 'capybara',
		isTrue: false,
		statementKey: 'myth.capybara-predator.statement',
		explanationKey: 'myth.capybara-predator.explanation'
	},
	{
		id: 'crow-tools',
		animalId: 'crow',
		isTrue: true,
		statementKey: 'myth.crow-tools.statement',
		explanationKey: 'myth.crow-tools.explanation'
	},
	{
		id: 'crow-lifespan',
		animalId: 'crow',
		isTrue: false,
		statementKey: 'myth.crow-lifespan.statement',
		explanationKey: 'myth.crow-lifespan.explanation'
	},
	{
		id: 'dodo-flight',
		animalId: 'dodo',
		isTrue: false,
		statementKey: 'myth.dodo-flight.statement',
		explanationKey: 'myth.dodo-flight.explanation'
	},
	{
		id: 'dodo-pigeon',
		animalId: 'dodo',
		isTrue: true,
		statementKey: 'myth.dodo-pigeon.statement',
		explanationKey: 'myth.dodo-pigeon.explanation'
	},
	{
		id: 'duck-echo',
		animalId: 'duck',
		isTrue: false,
		statementKey: 'myth.duck-echo.statement',
		explanationKey: 'myth.duck-echo.explanation'
	},
	{
		id: 'duck-sleep',
		animalId: 'duck',
		isTrue: true,
		statementKey: 'myth.duck-sleep.statement',
		explanationKey: 'myth.duck-sleep.explanation'
	},
	{
		id: 'eagle-bald',
		animalId: 'eagle',
		isTrue: false,
		statementKey: 'myth.eagle-bald.statement',
		explanationKey: 'myth.eagle-bald.explanation'
	},
	{
		id: 'eagle-nest',
		animalId: 'eagle',
		isTrue: true,
		statementKey: 'myth.eagle-nest.statement',
		explanationKey: 'myth.eagle-nest.explanation'
	},
	{
		id: 'flamingo-knees',
		animalId: 'flamingo',
		isTrue: false,
		statementKey: 'myth.flamingo-knees.statement',
		explanationKey: 'myth.flamingo-knees.explanation'
	},
	{
		id: 'flamingo-eat',
		animalId: 'flamingo',
		isTrue: true,
		statementKey: 'myth.flamingo-eat.statement',
		explanationKey: 'myth.flamingo-eat.explanation'
	},
	{
		id: 'fox-dog',
		animalId: 'fox',
		isTrue: false,
		statementKey: 'myth.fox-dog.statement',
		explanationKey: 'myth.fox-dog.explanation'
	},
	{
		id: 'fox-climb',
		animalId: 'fox',
		isTrue: true,
		statementKey: 'myth.fox-climb.statement',
		explanationKey: 'myth.fox-climb.explanation'
	},
	{
		id: 'giant_anteater-teeth',
		animalId: 'giant_anteater',
		isTrue: true,
		statementKey: 'myth.giant_anteater-teeth.statement',
		explanationKey: 'myth.giant_anteater-teeth.explanation'
	},
	{
		id: 'giant_anteater-bite',
		animalId: 'giant_anteater',
		isTrue: false,
		statementKey: 'myth.giant_anteater-bite.statement',
		explanationKey: 'myth.giant_anteater-bite.explanation'
	},
	{
		id: 'goose-teeth',
		animalId: 'goose',
		isTrue: true,
		statementKey: 'myth.goose-teeth.statement',
		explanationKey: 'myth.goose-teeth.explanation'
	},
	{
		id: 'goose-flight',
		animalId: 'goose',
		isTrue: false,
		statementKey: 'myth.goose-flight.statement',
		explanationKey: 'myth.goose-flight.explanation'
	},
	{
		id: 'hamster-nocturnal',
		animalId: 'hamster',
		isTrue: true,
		statementKey: 'myth.hamster-nocturnal.statement',
		explanationKey: 'myth.hamster-nocturnal.explanation'
	},
	{
		id: 'hamster-vision',
		animalId: 'hamster',
		isTrue: false,
		statementKey: 'myth.hamster-vision.statement',
		explanationKey: 'myth.hamster-vision.explanation'
	},
	{
		id: 'hawk-speed',
		animalId: 'hawk',
		isTrue: false,
		statementKey: 'myth.hawk-speed.statement',
		explanationKey: 'myth.hawk-speed.explanation'
	},
	{
		id: 'hawk-vision',
		animalId: 'hawk',
		isTrue: true,
		statementKey: 'myth.hawk-vision.statement',
		explanationKey: 'myth.hawk-vision.explanation'
	},
	{
		id: 'hedgehog-shoot',
		animalId: 'hedgehog',
		isTrue: false,
		statementKey: 'myth.hedgehog-shoot.statement',
		explanationKey: 'myth.hedgehog-shoot.explanation'
	},
	{
		id: 'hedgehog-lactose',
		animalId: 'hedgehog',
		isTrue: true,
		statementKey: 'myth.hedgehog-lactose.statement',
		explanationKey: 'myth.hedgehog-lactose.explanation'
	},
	{
		id: 'honey_badger-venom',
		animalId: 'honey_badger',
		isTrue: true,
		statementKey: 'myth.honey_badger-venom.statement',
		explanationKey: 'myth.honey_badger-venom.explanation'
	},
	{
		id: 'honey_badger-honey',
		animalId: 'honey_badger',
		isTrue: false,
		statementKey: 'myth.honey_badger-honey.statement',
		explanationKey: 'myth.honey_badger-honey.explanation'
	},
	{
		id: 'horse-breathe',
		animalId: 'horse',
		isTrue: true,
		statementKey: 'myth.horse-breathe.statement',
		explanationKey: 'myth.horse-breathe.explanation'
	},
	{
		id: 'horse-blind',
		animalId: 'horse',
		isTrue: false,
		statementKey: 'myth.horse-blind.statement',
		explanationKey: 'myth.horse-blind.explanation'
	},
	{
		id: 'koala-bear',
		animalId: 'koala',
		isTrue: false,
		statementKey: 'myth.koala-bear.statement',
		explanationKey: 'myth.koala-bear.explanation'
	},
	{
		id: 'koala-sleep',
		animalId: 'koala',
		isTrue: true,
		statementKey: 'myth.koala-sleep.statement',
		explanationKey: 'myth.koala-sleep.explanation'
	},
	{
		id: 'mammoth-ice',
		animalId: 'mammoth',
		isTrue: false,
		statementKey: 'myth.mammoth-ice.statement',
		explanationKey: 'myth.mammoth-ice.explanation'
	},
	{
		id: 'mammoth-tusk',
		animalId: 'mammoth',
		isTrue: true,
		statementKey: 'myth.mammoth-tusk.statement',
		explanationKey: 'myth.mammoth-tusk.explanation'
	},
	{
		id: 'manta_ray-sting',
		animalId: 'manta_ray',
		isTrue: false,
		statementKey: 'myth.manta_ray-sting.statement',
		explanationKey: 'myth.manta_ray-sting.explanation'
	},
	{
		id: 'manta_ray-jump',
		animalId: 'manta_ray',
		isTrue: true,
		statementKey: 'myth.manta_ray-jump.statement',
		explanationKey: 'myth.manta_ray-jump.explanation'
	},
	{
		id: 'manul-pupil',
		animalId: 'manul',
		isTrue: true,
		statementKey: 'myth.manul-pupil.statement',
		explanationKey: 'myth.manul-pupil.explanation'
	},
	{
		id: 'manul-speed',
		animalId: 'manul',
		isTrue: false,
		statementKey: 'myth.manul-speed.statement',
		explanationKey: 'myth.manul-speed.explanation'
	},
	{
		id: 'mole-blind',
		animalId: 'mole',
		isTrue: false,
		statementKey: 'myth.mole-blind.statement',
		explanationKey: 'myth.mole-blind.explanation'
	},
	{
		id: 'mole-eat',
		animalId: 'mole',
		isTrue: true,
		statementKey: 'myth.mole-eat.statement',
		explanationKey: 'myth.mole-eat.explanation'
	},
	{
		id: 'octopus-tentacle',
		animalId: 'octopus',
		isTrue: true,
		statementKey: 'myth.octopus-tentacle.statement',
		explanationKey: 'myth.octopus-tentacle.explanation'
	},
	{
		id: 'octopus-bones',
		animalId: 'octopus',
		isTrue: false,
		statementKey: 'myth.octopus-bones.statement',
		explanationKey: 'myth.octopus-bones.explanation'
	},
	{
		id: 'passenger_pigeon-number',
		animalId: 'passenger_pigeon',
		isTrue: true,
		statementKey: 'myth.passenger_pigeon-number.statement',
		explanationKey: 'myth.passenger_pigeon-number.explanation'
	},
	{
		id: 'passenger_pigeon-disease',
		animalId: 'passenger_pigeon',
		isTrue: false,
		statementKey: 'myth.passenger_pigeon-disease.statement',
		explanationKey: 'myth.passenger_pigeon-disease.explanation'
	},
	{
		id: 'pelican-food',
		animalId: 'pelican',
		isTrue: false,
		statementKey: 'myth.pelican-food.statement',
		explanationKey: 'myth.pelican-food.explanation'
	},
	{
		id: 'pelican-dive',
		animalId: 'pelican',
		isTrue: true,
		statementKey: 'myth.pelican-dive.statement',
		explanationKey: 'myth.pelican-dive.explanation'
	},
	{
		id: 'pig-sweat',
		animalId: 'pig',
		isTrue: false,
		statementKey: 'myth.pig-sweat.statement',
		explanationKey: 'myth.pig-sweat.explanation'
	},
	{
		id: 'pig-snout',
		animalId: 'pig',
		isTrue: true,
		statementKey: 'myth.pig-snout.statement',
		explanationKey: 'myth.pig-snout.explanation'
	},
	{
		id: 'platypus-stomach',
		animalId: 'platypus',
		isTrue: true,
		statementKey: 'myth.platypus-stomach.statement',
		explanationKey: 'myth.platypus-stomach.explanation'
	},
	{
		id: 'platypus-beak',
		animalId: 'platypus',
		isTrue: false,
		statementKey: 'myth.platypus-beak.statement',
		explanationKey: 'myth.platypus-beak.explanation'
	},
	{
		id: 'porcupine-shoot',
		animalId: 'porcupine',
		isTrue: false,
		statementKey: 'myth.porcupine-shoot.statement',
		explanationKey: 'myth.porcupine-shoot.explanation'
	},
	{
		id: 'porcupine-antibiotic',
		animalId: 'porcupine',
		isTrue: true,
		statementKey: 'myth.porcupine-antibiotic.statement',
		explanationKey: 'myth.porcupine-antibiotic.explanation'
	},
	{
		id: 'raccoon-wash',
		animalId: 'raccoon',
		isTrue: true,
		statementKey: 'myth.raccoon-wash.statement',
		explanationKey: 'myth.raccoon-wash.explanation'
	},
	{
		id: 'raccoon-winter',
		animalId: 'raccoon',
		isTrue: false,
		statementKey: 'myth.raccoon-winter.statement',
		explanationKey: 'myth.raccoon-winter.explanation'
	},
	{
		id: 'red_panda-bear',
		animalId: 'red_panda',
		isTrue: false,
		statementKey: 'myth.red_panda-bear.statement',
		explanationKey: 'myth.red_panda-bear.explanation'
	},
	{
		id: 'red_panda-stand',
		animalId: 'red_panda',
		isTrue: true,
		statementKey: 'myth.red_panda-stand.statement',
		explanationKey: 'myth.red_panda-stand.explanation'
	},
	{
		id: 'shark-cancer',
		animalId: 'shark',
		isTrue: false,
		statementKey: 'myth.shark-cancer.statement',
		explanationKey: 'myth.shark-cancer.explanation'
	},
	{
		id: 'shark-sleep',
		animalId: 'shark',
		isTrue: true,
		statementKey: 'myth.shark-sleep.statement',
		explanationKey: 'myth.shark-sleep.explanation'
	},
	{
		id: 'sheep-memory',
		animalId: 'sheep',
		isTrue: true,
		statementKey: 'myth.sheep-memory.statement',
		explanationKey: 'myth.sheep-memory.explanation'
	},
	{
		id: 'sheep-wool',
		animalId: 'sheep',
		isTrue: false,
		statementKey: 'myth.sheep-wool.statement',
		explanationKey: 'myth.sheep-wool.explanation'
	},
	{
		id: 'sifaka-trees',
		animalId: 'sifaka',
		isTrue: true,
		statementKey: 'myth.sifaka-trees.statement',
		explanationKey: 'myth.sifaka-trees.explanation'
	},
	{
		id: 'sifaka-monkey',
		animalId: 'sifaka',
		isTrue: false,
		statementKey: 'myth.sifaka-monkey.statement',
		explanationKey: 'myth.sifaka-monkey.explanation'
	},
	{
		id: 'sloth-digestion',
		animalId: 'sloth',
		isTrue: true,
		statementKey: 'myth.sloth-digestion.statement',
		explanationKey: 'myth.sloth-digestion.explanation'
	},
	{
		id: 'sloth-sleep',
		animalId: 'sloth',
		isTrue: false,
		statementKey: 'myth.sloth-sleep.statement',
		explanationKey: 'myth.sloth-sleep.explanation'
	},
	{
		id: 'snake-milk',
		animalId: 'snake',
		isTrue: false,
		statementKey: 'myth.snake-milk.statement',
		explanationKey: 'myth.snake-milk.explanation'
	},
	{
		id: 'snake-jaw',
		animalId: 'snake',
		isTrue: true,
		statementKey: 'myth.snake-jaw.statement',
		explanationKey: 'myth.snake-jaw.explanation'
	},
	{
		id: 'squirrel-fall',
		animalId: 'squirrel',
		isTrue: true,
		statementKey: 'myth.squirrel-fall.statement',
		explanationKey: 'myth.squirrel-fall.explanation'
	},
	{
		id: 'squirrel-rabies',
		animalId: 'squirrel',
		isTrue: false,
		statementKey: 'myth.squirrel-rabies.statement',
		explanationKey: 'myth.squirrel-rabies.explanation'
	},
	{
		id: 'toucan-beak',
		animalId: 'toucan',
		isTrue: false,
		statementKey: 'myth.toucan-beak.statement',
		explanationKey: 'myth.toucan-beak.explanation'
	},
	{
		id: 'toucan-temp',
		animalId: 'toucan',
		isTrue: true,
		statementKey: 'myth.toucan-temp.statement',
		explanationKey: 'myth.toucan-temp.explanation'
	},
	{
		id: 'walrus-tusk',
		animalId: 'walrus',
		isTrue: false,
		statementKey: 'myth.walrus-tusk.statement',
		explanationKey: 'myth.walrus-tusk.explanation'
	},
	{
		id: 'walrus-sleep',
		animalId: 'walrus',
		isTrue: true,
		statementKey: 'myth.walrus-sleep.statement',
		explanationKey: 'myth.walrus-sleep.explanation'
	},
	{
		id: 'weasel-winter',
		animalId: 'weasel',
		isTrue: true,
		statementKey: 'myth.weasel-winter.statement',
		explanationKey: 'myth.weasel-winter.explanation'
	},
	{
		id: 'weasel-blood',
		animalId: 'weasel',
		isTrue: false,
		statementKey: 'myth.weasel-blood.statement',
		explanationKey: 'myth.weasel-blood.explanation'
	},
	{
		id: 'yak-altitude',
		animalId: 'yak',
		isTrue: false,
		statementKey: 'myth.yak-altitude.statement',
		explanationKey: 'myth.yak-altitude.explanation'
	},
	{
		id: 'yak-sweat',
		animalId: 'yak',
		isTrue: true,
		statementKey: 'myth.yak-sweat.statement',
		explanationKey: 'myth.yak-sweat.explanation'
	},
	{
		id: 'zebra-black',
		animalId: 'zebra',
		isTrue: true,
		statementKey: 'myth.zebra-black.statement',
		explanationKey: 'myth.zebra-black.explanation'
	},
	{
		id: 'zebra-horse',
		animalId: 'zebra',
		isTrue: false,
		statementKey: 'myth.zebra-horse.statement',
		explanationKey: 'myth.zebra-horse.explanation'
	}
];

export interface GameQuestion extends MythStatement {
	animal: Animal;
}

export function getNextQuestion(excludeIds: string[] = []): GameQuestion | null {
	const available = myths.filter((m) => !excludeIds.includes(m.id));
	if (available.length === 0) return null;

	const randomMyth = available[Math.floor(Math.random() * available.length)];
	const animal = animals.find((a) => a.id === randomMyth.animalId)!;

	return {
		...randomMyth,
		animal
	};
}
