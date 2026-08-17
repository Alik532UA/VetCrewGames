import { FEED_PER_ANIMAL } from './constants';
import { note, spend } from './ledger';
import { RESERVE_BIOMES } from './species';
import type { CommandResult, ReserveState } from './types';

/**
 * Комора: корм, який купують, і корм, який зʼїдають.
 *
 * Доти їжа входила в «утримання» одним числом і списувалася сама. Це працювало,
 * але нічого не вчило: гравець не міг ні забути її купити, ні вирішити, скільки
 * взяти. Тепер це запас — і єдине в грі, що псується від НЕУВАГИ, а не від
 * поганого рішення.
 *
 * Ціна не зросла: з шістдесяти за тварину на день двадцять пʼять лишилося в
 * обовʼязковому утриманні (`UPKEEP_PER_ANIMAL`), а тридцять пʼять переїхали в
 * порцію корму. Разом ті самі шістдесят — просто половина з них тепер рішення.
 */

/** Скільки коштує одна порція. */
export const FEED_PRICE = 35;

/** На скільки днів вистачить запасу при такій кількості ротів. */
export const feedDays = (feed: number, mouths: number) =>
	mouths === 0 ? Infinity : Math.floor(feed / (mouths * FEED_PER_ANIMAL));

/** Скільком тваринам фонду треба їсти: випущені більше не їдять. */
export function mouthsOf(state: ReserveState): number {
	let mouths = 0;
	for (const biome of RESERVE_BIOMES) {
		for (const animal of state.sites[biome].animals) {
			if (animal.stage !== 'released') mouths++;
		}
	}
	return mouths;
}

/** Купівля корму. Порції — ціле число, більше нуля. */
export function restock(state: ReserveState, portions: number): CommandResult {
	if (!Number.isInteger(portions) || portions < 1) return { ok: false, reason: 'bad-amount' };

	const cost = portions * FEED_PRICE;
	if (state.budget < cost) return { ok: false, reason: 'no-money' };

	spend(state, cost, 'feed');
	state.feed += portions;
	note(state, 'feed', portions, 'feed');
	return { ok: true };
}

/**
 * Роздати корм на добу. Повертає, скільком тваринам його НЕ дісталося.
 *
 * Списується стільки, скільки справді зʼїли, — а не стільки, скільки треба було.
 * Різниця й є голод: якби комора йшла в мінус, гравець побачив би відʼємний запас
 * і жодних наслідків, тобто нічого.
 *
 * Порядок роздачі — фіксований (біоми, потім тварини в списку). Це не «кому
 * пощастило»: партія мусить розгортатися однаково в усіх учасників, тож
 * випадковості тут не може бути навіть заради справедливості.
 */
export function serveFeed(state: ReserveState): number {
	const mouths = mouthsOf(state);
	const needed = mouths * FEED_PER_ANIMAL;
	const eaten = Math.min(state.feed, needed);

	state.feed -= eaten;
	note(state, 'feed', -eaten, 'eaten');

	return mouths - Math.floor(eaten / FEED_PER_ANIMAL);
}
