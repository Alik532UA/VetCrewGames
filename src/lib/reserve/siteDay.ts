import {
	ANIMALS_PER_KEEPER,
	ANIMALS_PER_VET,
	DEATH_IMPACT,
	DEATH_REPUTATION,
	HEALTH_DECAY_PER_DAY,
	HEALTH_SELF_RECOVERY_ABOVE,
	STRESS_BLOCKS_RELEASE,
	HEALTH_SELF_RECOVERY_PER_DAY,
	QUALITY_SPEED,
	RECOVERY_PER_VET_DAY,
	STRESS_PER_DAY,
	STRESS_FLOOR_PER_UNMET,
	STRESS_PER_HUNGER,
	STRESS_RELIEF_PER_DAY,
	UPKEEP_PER_ANIMAL,
	UPKEEP_PER_SIZE,
	WAGES,
	WEAR_ONE_STEP,
	WEAR_PER_DAY,
	WEAR_TWO_STEPS,
	type Quality
} from './constants';
import { addImpact, addReputation, countAnimal, spend } from './ledger';
import { HEAL_IMPACT, HEAL_REPUTATION } from './constants';
import { comfortOf, speciesById, type ReserveBiome } from './species';
import { unmetNeeds } from './modules';
import type { Animal, Enclosure, ReserveState, Site } from './types';
import type { EventSink } from './events';

/**
 * Доба однієї ДІЛЯНКИ: знос, витрати, одужання, стрес.
 *
 * Відокремлено від `day.ts` по тій самій лінії, що вже ділить предметну область:
 * там доба ФОНДУ — пожертви, контракти, репутація, наліт, журнал; тут те, що
 * відбувається з тваринами на конкретній землі. Гроші при цьому лишаються
 * фондові: витрати всіх ділянок ідуть з однієї каси, і саме це робить четверту
 * землю рішенням, а не безкоштовним додатком.
 */

/** Тварини ділянки, які ще на місці: випущені не їдять і не займають вольєра. */
const presentAt = (site: Site): Animal[] => site.animals.filter((a) => a.stage !== 'released');

/**
 * Яка якість у вольєра НАСПРАВДІ, з поправкою на знос.
 *
 * Сходинками, а не плавно: гравець має бачити, що вольєр «став гіршим», а не
 * здогадуватися, чому числа поповзли. Це те, що робить ремонт помітною дією, а
 * не абстрактною гігієною.
 */
export function effectiveQuality(enclosure: Enclosure): Quality {
	const drop =
		enclosure.durability >= WEAR_ONE_STEP ? 0 : enclosure.durability >= WEAR_TWO_STEPS ? 1 : 2;
	return Math.max(1, enclosure.quality - drop) as Quality;
}

/**
 * Наскільки добре тварині живеться: простір × якість.
 *
 * Два множники, а не один, бо це два різні рішення гравця. Розмір вирішує, хто
 * тут узагалі поміститься; якість — наскільки йому тут добре. Дешевий великий
 * вольєр і дорогий тісний мають відчуватися по-різному.
 */
function comfortFor(site: Site, animal: Animal): number {
	const species = speciesById(animal.speciesId);
	const enclosure = site.enclosures.find((e) => e.id === animal.enclosureId);
	// Вид або вольєр могли зникнути лише через зіпсований сейв. Базова
	// швидкість тут безпечніша за нуль: тварина, яка НІКОЛИ не одужає,
	// виглядає як поламана гра, а не як наслідок тісноти.
	if (!species || !enclosure) return 1;
	return comfortOf(species, enclosure.size) * QUALITY_SPEED[effectiveQuality(enclosure)];
}

/**
 * Доба однієї ділянки: знос, витрати, одужання, стрес.
 *
 * Гроші лишаються ФОНДОВІ — витрати всіх ділянок ідуть з однієї каси, і саме це
 * робить четверту землю рішенням, а не безкоштовним додатком. А от ветеринар
 * лікує лише своїх: штат належить землі.
 */
export function siteDay(
	state: ReserveState,
	site: Site,
	hungry: number,
	/**
	 * Куди й кому оголосити про смерть і одужання.
	 *
	 * Одним параметром, а не двома: подія несе біом, а `Site` його не знає — біом
	 * тут ключ у `state.sites`, і питати його в самої ділянки нема в кого. Разом
	 * вони або є, або їх немає, і тип це й каже.
	 *
	 * Необовʼязковий: тести симуляції прогонюють сотні діб, і слухач їм не
	 * потрібен (`reserve/events.ts`).
	 */
	news?: { at: ReserveBiome; emit: EventSink }
): number {
	// Вольєри зношуються щодня — незалежно від того, живе там хтось чи ні.
	// Порожній вольєр, який стоїть п'ятдесят днів, теж потребує ремонту.
	for (const enclosure of site.enclosures) {
		enclosure.durability = Math.max(0, enclosure.durability - WEAR_PER_DAY);
	}

	const here = presentAt(site);
	/*
	 * Кожна витрата — окремим рядком із причиною.
	 *
	 * Доти всі чотири складалися в одне число, з якого не видно жодного рішення: чи
	 * то штат завеликий, чи то вольєрів набудували. Сума однакова, причини різні, і
	 * саме причина каже, що робити далі. Чотири ділянки складаються в ті самі
	 * рядки: реєстр додає до наявної причини, а не пише пʼятий раз те саме.
	 */
	spend(state, here.length * UPKEEP_PER_ANIMAL, 'upkeep.animals');
	spend(
		state,
		site.enclosures.reduce((sum, e) => sum + e.size * UPKEEP_PER_SIZE, 0),
		'upkeep.enclosures'
	);
	spend(state, site.staff.vet * WAGES.vet, 'wage.vet');
	spend(state, site.staff.keeper * WAGES.keeper, 'wage.keeper');
	spend(state, site.staff.ranger * WAGES.ranger, 'wage.ranger');

	/*
	 * Голодні — ПЕРШІ в списку, і це не жорстокість, а детермінізм.
	 *
	 * Порцій може не хопити, і комусь вони не дістануться. Кому саме — мусить
	 * вирішувати фіксований порядок, а не кидок: інакше та сама партія розгорталася
	 * б у двох учасників по-різному. Число приходить іззовні, бо комора спільна на
	 * весь фонд: ліс не має доїдати те, що лишилося саванні.
	 */
	const starving = new Set(here.slice(0, Math.min(hungry, here.length)).map((a) => a.id));
	const left = hungry - starving.size;

	const recovering = here.filter((a) => a.stage === 'recovering');
	if (recovering.length > 0) {
		/*
		 * Ветеринар має ЄМНІСТЬ, а не ділить себе між усіма.
		 *
		 * Доти було `(vet × 0.1) / recovering.length` — і одужання сповільнювалося
		 * квадратично від того, що фонд росте: один ветеринар на трьох витягував
		 * кожну тридцять днів замість десяти. Порядок фіксований (перші в списку), як
		 * і в доглядача та в роздачі корму: кому пощастило, не може вирішувати кидок,
		 * інакше та сама партія розгорнеться в двох учасників по-різному.
		 */
		const treated = site.staff.vet * ANIMALS_PER_VET;
		/*
		 * Померлих збираємо, а не видаляємо на місці: масив саме зараз перебирається,
		 * і виривати з нього елемент означало б пропустити наступного.
		 */
		const dead: number[] = [];

		for (const [place, animal] of recovering.entries()) {
			// Понад ємність не лікують зовсім — так само, як понад ємність доглядача
			// стрес не спадає, а росте.
			const cared = place < treated;
			/*
			 * НЕМАЄ КОМУ ЛІКУВАТИ — це питання до гравця, а не приговор тварині.
			 *
			 * Оголошується лише для тих, хто НЕ пройшов межу самоодужання: вище неї
			 * організм дає раду сам, і питати там нема про що — лікар лише прискорює.
			 * Нижче межі відсутність лікаря означає смерть, і саме тоді рішення варте
			 * того, щоб спинити час і спитати.
			 */
			if (!cared && animal.health <= HEALTH_SELF_RECOVERY_ABOVE) {
				news?.emit({
					kind: 'needs-care',
					role: 'vet',
					animalId: animal.id,
					speciesId: animal.speciesId,
					biome: news.at
				});
			}
			/*
			 * Голод спиняє одужання ПОВНІСТЮ, а не гальмує.
			 *
			 * Єдина причина в грі, яка діє так. Решта — стрес, тіснота, знос — множники:
			 * вони роблять довше. Голодна тварина не одужує взагалі, і саме тому забути
			 * купити корм дорожче, ніж помилитися з розміром вольєра.
			 */
			const fasting = starving.has(animal.id) ? 0 : 1;
			// Стрес не спиняє одужання, а гальмує його; тіснота множить те, що лишилося.
			const modifiers = fasting * (1 - animal.stress / 2) * comfortFor(site, animal);

			/*
			 * Три гілки, і межа між ними — головне число нової шкали.
			 *
			 * Лікують — росте швидко. Не лікують, але здоровʼя вище межі — організм
			 * дає раду сам, уп’ятеро повільніше. Не лікують і межу не пройдено —
			 * ГАСНЕ, і на нулі тварина помирає.
			 *
			 * Спад НЕ множиться на голод, стрес і тісноту навмисно. Ті три множники
			 * описують, наскільки добре лікується; спад — це відсутність лікування
			 * взагалі, і робити занедбану тварину «менш занедбаною» від того, що вона
			 * сита, означало б винагороджувати половину догляду за цілий.
			 */
			if (cared) {
				animal.health = Math.min(1, animal.health + RECOVERY_PER_VET_DAY * modifiers);
			} else if (animal.health > HEALTH_SELF_RECOVERY_ABOVE) {
				animal.health = Math.min(1, animal.health + HEALTH_SELF_RECOVERY_PER_DAY * modifiers);
			} else {
				animal.health = Math.max(0, animal.health - HEALTH_DECAY_PER_DAY);
			}

			if (animal.health <= 0) {
				dead.push(animal.id);
				// Саме тут і зникала тварина «без причини»: запис лишався тільки в
				// реєстрі показників рядком «−30, причина death».
				news?.emit({ kind: 'death', speciesId: animal.speciesId, biome: news.at });
				continue;
			}
			if (animal.health >= 1) {
				const recovered = animal.stage !== 'healthy';
				animal.stage = 'healthy';
				if (recovered) {
					news?.emit({ kind: 'healed', speciesId: animal.speciesId, biome: news.at });
				}
				// Вилікувана тварина в неволі допомагає природі мало (+1), а от
				// публіці видно саме одужання (+5).
				addImpact(state, HEAL_IMPACT, 'heal');
				addReputation(state, HEAL_REPUTATION, 'heal');
			}
		}

		if (dead.length > 0) {
			site.animals = site.animals.filter((animal) => !dead.includes(animal.id));
			addImpact(state, DEATH_IMPACT * dead.length, 'death');
			addReputation(state, DEATH_REPUTATION * dead.length, 'death');
			countAnimal(state, 'inReserve', -dead.length, 'death');
		}
	}

	const cared = site.staff.keeper * ANIMALS_PER_KEEPER;
	for (const [index, animal] of here.entries()) {
		// Простір заспокоює, тіснота — ні. Тому множник діє лише на спад:
		// у тісноті стрес росте з тією самою швидкістю, а сходить уп'ятеро довше.
		const change =
			index < cared ? -STRESS_RELIEF_PER_DAY * comfortFor(site, animal) : STRESS_PER_DAY;

		/*
		 * НЕМАЄ КОМУ ДОГЛЯДАТИ — так само питання, як і з лікарем.
		 *
		 * Але межа інша: стрес питає не з першого відсотка, а з половини. Нижче того
		 * він лише гальмує одужання, і спиняти час заради цього означало б питати
		 * щодня про кожну тварину. Від половини він уже наближається до порогу, за
		 * яким випуск неможливий (`STRESS_BLOCKS_RELEASE`), — і ось це вже рішення.
		 */
		if (index >= cared && animal.stress >= STRESS_BLOCKS_RELEASE / 2) {
			news?.emit({
				kind: 'needs-care',
				role: 'keeper',
				animalId: animal.id,
				speciesId: animal.speciesId,
				biome: news.at
			});
		}

		/*
		 * Незакрита потреба вольєра ставить ДНО, а не додає щодня.
		 *
		 * У цьому суть етапу: доглядач заспокоює тварину лише до тієї межі, яку лишає
		 * їй вольєр. Лисиця без нори завмирає на чверті стресу, хоч скільком людям за
		 * неї плати, — гроші не заміняють знання, кому що потрібно.
		 *
		 * Перша версія просто додавала 0.08 на добу, і тест показав, що це не працює:
		 * доглядач знімає 0.12, тобто перебивав потребу повністю й безкоштовно.
		 *
		 * Голод рахується ПОНАД дно: він додається до зміни й може підняти стрес куди
		 * вище, ніж будь-яка незакрита потреба.
		 */
		const floor = needsUnmet(site, animal) * STRESS_FLOOR_PER_UNMET;
		const hunger = starving.has(animal.id) ? STRESS_PER_HUNGER : 0;

		animal.stress = Math.min(1, Math.max(floor, animal.stress + change + hunger));
	}

	return left;
}

/** Скільком потребам виду цей вольєр не відповідає. */
function needsUnmet(site: Site, animal: Animal): number {
	const species = speciesById(animal.speciesId);
	const enclosure = site.enclosures.find((e) => e.id === animal.enclosureId);
	if (!species || !enclosure) return 0;
	return unmetNeeds(species.needs, enclosure).length;
}
