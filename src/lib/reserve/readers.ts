import { RESERVE_BIOMES, type ReserveBiome } from './species';
import type { Animal, ReserveState, Site } from './types';

/**
 * Питання до фонду, які нічого в ньому не міняють.
 *
 * «Скільки в мене мешканців», «які вольєри вільні», «чи заселена друга земля» —
 * усе це читання, і саме тому воно тут, а не серед ходів. Розділ не косметичний:
 * `execute()` мусить лишатися коротким і одноріднім, інакше правило губиться
 * серед лічильників.
 *
 * Найважливіша різниця, яку ці функції тримають, — ФОНД проти ДІЛЯНКИ.
 * Показники спільні, тож `residents` рахує всіх; карта малює одну землю, тож їй
 * потрібен `residentsAt`. Сплутати їх легко, і саме тому вони названі по-різному,
 * а не одним іменем із необовʼязковим аргументом.
 */

/** Тварини ділянки, які ще на місці: випущені не їдять і не займають вольєра. */
const presentAt = (site: Site): Animal[] => site.animals.filter((a) => a.stage !== 'released');

/** Чи хтось уже живе в цьому вольєрі ЦІЄЇ ділянки. */
export const occupant = (site: Site, enclosureId: number) =>
	presentAt(site).find((a) => a.enclosureId === enclosureId);

/** Усі ділянки фонду парами «біом → земля». Порядок — як у `RESERVE_BIOMES`. */
export const sitesOf = (state: ReserveState): Array<[ReserveBiome, Site]> =>
	RESERVE_BIOMES.map((biome) => [biome, state.sites[biome]]);

/** Мешканці ФОНДУ — без випущених. Це те, що показує шапка. */
export const residents = (state: ReserveState): Animal[] =>
	RESERVE_BIOMES.flatMap((biome) => presentAt(state.sites[biome]));

/** Мешканці ОДНІЄЇ землі. Це те, що малює сцена й перелічує список. */
export const residentsAt = (state: ReserveState, at: ReserveBiome): Animal[] =>
	presentAt(state.sites[at]);

/** Ті, кого вже повернули в природу, — по всьому фонду. */
export const released = (state: ReserveState): Animal[] =>
	RESERVE_BIOMES.flatMap((biome) =>
		state.sites[biome].animals.filter((a) => a.stage === 'released')
	);

export const releasedAt = (state: ReserveState, at: ReserveBiome): Animal[] =>
	state.sites[at].animals.filter((a) => a.stage === 'released');

/**
 * Скільки ділянок фонду ЗАСЕЛЕНІ.
 *
 * За цим шапка вибирає між «У заповіднику» й «У заповідниках»: множина
 * зʼявляється тоді, коли вона правдива, а не тоді, коли ділянок чотири.
 */
export const populatedSites = (state: ReserveState): number =>
	RESERVE_BIOMES.filter((biome) => presentAt(state.sites[biome]).length > 0).length;

/** Вольєри ділянки, у яких зараз нікого немає, — саме туди можна прийняти тварину. */
export const freeEnclosures = (state: ReserveState, at: ReserveBiome) =>
	state.sites[at].enclosures.filter((e) => !occupant(state.sites[at], e.id));
