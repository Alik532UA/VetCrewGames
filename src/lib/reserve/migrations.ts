import { STARTING_REPUTATION } from './constants';
import { spiralCell } from './grid';
import { SPECIES } from './species';

/**
 * Сходинки міграції: `MIGRATIONS[n]` піднімає сейв версії `n` до `n + 1`.
 *
 * Окремий файл, а не хвіст `save.ts`: цей список РОСТЕ з кожною зміною схеми й
 * ніколи не скорочується — старі сейви не перестають існувати від того, що гра
 * пішла далі. Тримати вічно зростаючий список у файлі, який має лишатися
 * читабельним, означало б рано чи пізно розділити його поспіхом.
 *
 * Механізм сходами перевірений окремо, на ПІДСТАВНИХ сходинках: інакше перша
 * справжня міграція була б і першим запуском самого механізму, до того ж на
 * чужій партії.
 */

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isNumber = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value);

/**
 * Версія 1 → 2: у заповіднику зʼявилися вольєри, види й репутація.
 *
 * Партію треба ЗБЕРЕГТИ, а не почати наново, — заради цього драбина й
 * будувалася. Але у версії 1 тварини не мали ні виду, ні місця, тож те, чого в
 * сейві не було, доводиться вигадати. Правила вигадування такі:
 *
 *  * **Вид виводиться з `id` тварини й зерна партії.** Не кидком генератора:
 *    кидок зсунув би `rolls`, і партія після відновлення розгорталася б
 *    інакше, ніж розгорталася б без збереження. Це рівно та тиха розбіжність,
 *    від якої стереже весь етап 10.
 *  * **Вольєр дається рекомендованого розміру й безкоштовно.** Списати гроші
 *    заднім числом означало б покарати гравця за оновлення гри, а дати
 *    мінімальний — сповільнити вп'ятеро те, що досі йшло на повній швидкості.
 *  * **День випуску лишається `null`** — у версії 1 його ніде не було, і
 *    вигадати його неможливо. Інтерфейс покаже прочерк; вигаданий нуль читався
 *    б як «випустили в перший день», тобто був би брехнею.
 */
export function migrateV1toV2(raw: unknown): unknown {
	if (!isObject(raw)) return raw;

	const seed = isNumber(raw.seed) ? raw.seed : 0;
	const animals = Array.isArray(raw.animals) ? raw.animals : [];
	const enclosures: Array<{ id: number; size: number; quality: number; durability: number }> = [];

	const upgraded = animals.map((animal, index) => {
		if (!isObject(animal)) return animal;
		const id = isNumber(animal.id) ? animal.id : index + 1;
		const species = SPECIES[(seed + id) % SPECIES.length];
		const enclosureId = index + 1;
		// Середня якість і повна міцність: гравець не має прокинутися
		// з дірявим вольєром через те, що оновилася гра.
		enclosures.push({ id: enclosureId, size: species.recSize, quality: 2, durability: 1 });

		return {
			...animal,
			speciesId: species.id,
			enclosureId,
			releasedOnDay: null
		};
	});

	return {
		...raw,
		// Ліс — найлагідніший біом: там живуть майже всі дрібні види, тож
		// жодна стара тварина не виявиться раптом 'не звідси'.
		biome: 'forest',
		reputation: STARTING_REPUTATION,
		animals: upgraded,
		enclosures,
		nextEnclosureId: enclosures.length + 1
	};
}

/**
 * Сходинки міграції: `MIGRATIONS[n]` піднімає сейв версії `n` до `n + 1`.
 *
 * Механізм сходами перевірений окремо, на ПІДСТАВНИХ сходинках: інакше перша
 * справжня міграція була б і першим запуском самого механізму, до того ж на
 * чужій партії. Тепер, коли справжня сходинка з'явилася, ті підставні тести
 * лишаються — вони перевіряють драбину, а не її вміст.
 */

/**
 * Версія 2 → 3: зʼявилися перемога й кампанія в соцмережах.
 *
 * Обидва поля нові й обидва мають безпечні початкові значення: партія триває
 * (перемоги ще немає), кампанії ще не було. Нічого вигадувати не доводиться —
 * рідкісний випадок, коли міграція чесно тривіальна.
 */
export function migrateV2toV3(raw: unknown): unknown {
	if (!isObject(raw)) return raw;
	return { ...raw, victory: false, lastCampaignDay: -1 };
}

/**
 * Версія 3 → 4: зʼявилися контракти зі спонсорами.
 *
 * Порожні списки й нульові лічильники: перша пропозиція прийде сама, за
 * розкладом. Нічого вигадувати не доводиться.
 */
export function migrateV3toV4(raw: unknown): unknown {
	if (!isObject(raw)) return raw;
	return { ...raw, contracts: [], offered: null, lastOfferDay: 0, nextContractId: 1 };
}

/**
 * Версія 4 → 5: вольєри отримали МІСЦЕ, бо тепер їх ставить гравець.
 *
 * Доти місце виводилося з `id` по спіралі — і саме цю спіраль міграція й
 * застосовує останній раз, щоб уже збудований заповідник лишився на вигляд тим
 * самим. Гравець не має прокинутися з переставленими будівлями.
 */
export function migrateV4toV5(raw: unknown): unknown {
	if (!isObject(raw)) return raw;
	const enclosures = Array.isArray(raw.enclosures) ? raw.enclosures : [];

	return {
		...raw,
		enclosures: enclosures.map((enclosure, index) => {
			if (!isObject(enclosure)) return enclosure;
			const id = isNumber(enclosure.id) ? enclosure.id : index + 1;
			return { ...enclosure, cell: spiralCell(id - 1) };
		})
	};
}

export const MIGRATIONS: Record<number, (state: unknown) => unknown> = {
	1: migrateV1toV2,
	2: migrateV2toV3,
	3: migrateV3toV4,
	4: migrateV4toV5
};
