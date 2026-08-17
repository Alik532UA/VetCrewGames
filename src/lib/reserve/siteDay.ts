import {
	ANIMALS_PER_KEEPER,
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
import { addImpact, addReputation, spend } from './ledger';
import { HEAL_IMPACT, HEAL_REPUTATION } from './constants';
import { comfortOf, speciesById } from './species';
import { unmetNeeds } from './modules';
import type { Animal, Enclosure, ReserveState, Site } from './types';

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
export function siteDay(state: ReserveState, site: Site, hungry: number): number {
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
		// Зусилля ветеринарів ділиться порівну: черги в MVP немає.
		const perAnimal = (site.staff.vet * RECOVERY_PER_VET_DAY) / recovering.length;
		for (const animal of recovering) {
			/*
			 * Голод спиняє одужання ПОВНІСТЮ, а не гальмує.
			 *
			 * Єдина причина в грі, яка діє так. Решта — стрес, тіснота, знос — множники:
			 * вони роблять довше. Голодна тварина не одужує взагалі, і саме тому забути
			 * купити корм дорожче, ніж помилитися з розміром вольєра.
			 */
			const fasting = starving.has(animal.id) ? 0 : 1;
			// Стрес не спиняє одужання, а гальмує його; тіснота множить те, що лишилося.
			const rate = perAnimal * fasting * (1 - animal.stress / 2) * comfortFor(site, animal);
			animal.recovery = Math.min(1, animal.recovery + rate);
			if (animal.recovery >= 1) {
				animal.stage = 'healthy';
				// Вилікувана тварина в неволі допомагає природі мало (+1), а от
				// публіці видно саме одужання (+5).
				addImpact(state, HEAL_IMPACT, 'heal');
				addReputation(state, HEAL_REPUTATION, 'heal');
			}
		}
	}

	const cared = site.staff.keeper * ANIMALS_PER_KEEPER;
	for (const [index, animal] of here.entries()) {
		// Простір заспокоює, тіснота — ні. Тому множник діє лише на спад:
		// у тісноті стрес росте з тією самою швидкістю, а сходить уп'ятеро довше.
		const change =
			index < cared ? -STRESS_RELIEF_PER_DAY * comfortFor(site, animal) : STRESS_PER_DAY;

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
