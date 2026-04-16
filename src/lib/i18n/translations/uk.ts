export const uk = {
	// App
	'app.title': 'Vet Crew Games',

	// Main menu
	'menu.title': 'Vet Crew Games',
	'menu.game.feeding': 'Що їмо?',
	'menu.game.population': 'Кого більше?',
	'menu.game.habitat': 'Де живем?',
	'menu.game.mythbusters': 'Правда чи міф?',
	'menu.game.family': 'Хто з іншої родини?',
	'menu.link.vetcrew': 'Vet Crew',
	'menu.link.order': 'Замовити гру чи сайт',

	// Common
	'common.check': 'Перевірити',
	'common.playAgain': 'Грати знову',
	'common.next': 'Далі',
	'common.back': 'Назад',
	'common.correct': 'Правильно!',
	'common.incorrect': 'Неправильно!',

	// Game: Population
	'population.title': 'Кого більше?',
	'population.round': 'Раунд',
	'population.description': 'Розташуй від найменшої до найбільшої популяції',
	'population.least': 'Найменша',
	'population.middle': 'Середня',
	'population.most': 'Найбільша',

	'population.check': 'Перевірити',
	'population.nextRound': 'Далі',
	'population.dropHere': 'Перетягни сюди',
	'population.yourAnimals': 'Перетягніть картки у відповідні слоти вище!',
	'population.population': 'Популяція',
	'population.fact': 'Цікавий факт',

	// Animals
	'animal.chicken': 'Курка',
	'animal.cow': 'Корова',
	'animal.dog': 'Собака',
	'animal.cat': 'Кіт',
	'animal.rat': 'Щур',
	'animal.sparrow': 'Горобець',
	'animal.ant': 'Мураха',
	'animal.elephant': 'Слон',
	'animal.tiger': 'Тигр',
	'animal.penguin': 'Пінгвін',
	'animal.bee': 'Бджола',
	'animal.panda': 'Панда',
	'animal.wolf': 'Вовк',
	'animal.dolphin': 'Дельфін',
	'animal.parrot': 'Папуга',

	// Facts
	'fact.chicken': 'Курей на Землі більше, ніж будь-яких інших птахів. На кожну людину припадає приблизно 4 курки.',
	'fact.cow': 'Корови мають найкращих друзів і стресують, коли їх розлучають.',
	'fact.dog': 'Собаки можуть розуміти до 250 слів та жестів, а їхній інтелект порівнюють з дворічною дитиною.',
	'fact.cat': 'Коти проводять 70% свого життя уві сні — це приблизно 13-16 годин на день.',
	'fact.rat': 'Щури сміються, коли їх лоскочуть, і можуть виражати радість ультразвуком.',
	'fact.sparrow': 'Горобці живуть поруч з людьми вже понад 10 000 років.',
	'fact.ant': 'Загальна маса всіх мурах на Землі приблизно дорівнює загальній масі всіх людей.',
	'fact.elephant': 'Слони — єдині тварини, які не можуть стрибати, але вони вміють плавати на великі відстані.',
	'fact.tiger': 'Смуги тигра унікальні, як відбитки пальців у людини — немає двох однакових.',
	'fact.penguin': 'Імператорські пінгвіни можуть пірнати на глибину до 500 метрів і затримувати подих на 20 хвилин.',
	'fact.bee': 'Одна бджола за все своє життя виробляє лише 1/12 чайної ложки меду.',
	'fact.panda': 'Панди їдять бамбук до 14 годин на день і з\'їдають до 38 кг за добу.',
	'fact.wolf': 'Вовки можуть пробігти до 60 км/год і подолати 30 км за ніч у пошуках їжі.',
	'fact.dolphin': 'Дельфіни сплять з одним відкритим оком — одна половина мозку спить, а інша чергує.',
	'fact.parrot': 'Деякі папуги можуть жити понад 80 років і вивчити більше 100 слів.'
} as const;

export type TranslationKey = keyof typeof uk;
