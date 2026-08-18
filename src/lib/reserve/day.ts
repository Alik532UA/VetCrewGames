import {
	COLLAPSE_DAYS,
	DONATION_PER_REPUTATION,
	REPUTATION_DECAY_RATE,
	TICKS_PER_DAY
} from './constants';
import { CONTRACT_INTERVAL_DAYS, isDone, MAX_ACTIVE_CONTRACTS, offerContract } from './contracts';
import { closeDay } from './journal';
import { serveFeed } from './larder';
import { addReputation, earn } from './ledger';
import { expireRaid, maybeRaid } from './raids';
import { RESERVE_BIOMES } from './species';
import { siteDay } from './siteDay';
import type { ReserveState } from './types';

/*
 * Доба ДІЛЯНКИ — у `siteDay.ts`: знос, одужання, стрес, витрати на місці. Тут
 * лишилася доба ФОНДУ. Реекспорт якості потрібен тому, що по неї ходить
 * інтерфейс, а він знає одні двері — `simulation.ts`.
 */
export { effectiveQuality } from './siteDay';

/**
 * Кінець ігрової доби: гроші, знос, одужання, стрес, підсумок.
 *
 * Винесено з `simulation.ts` не заради краси, а тому що це ІНША відповідальність:
 * там — правила ходів, тут — те, що відбувається саме собою, поки гравець нічого
 * не робить. Обидва файли перейшли межу розміру одночасно, і саме по цій лінії
 * вони й розходяться без жодного спільного стану.
 */

/**
 * Один ігровий день: гроші, одужання, стрес, підсумок.
 *
 * Викликається лише з `tick()` на межі доби — і саме тому кількість тіків за
 * виклик не впливає на результат.
 */
/**
 * Контракти на межі доби: прострочені провалюються, нова пропозиція приходить.
 *
 * Провал коштує РЕПУТАЦІЇ, а не грошей: спонсор нічого не забирає, але про
 * невиконану обіцянку дізнаються. Саме тому брати все підряд невигідно.
 */
function settleContracts(state: ReserveState, day: number): void {
	const missed = state.contracts.filter((c) => day > c.dueDay && !isDone(state, c));
	for (const contract of missed) {
		addReputation(state, -contract.penalty, 'penalty');
	}
	state.contracts = state.contracts.filter((c) => !missed.includes(c));

	// Пропозиція, яку не взяли, теж не висить вічно: спонсор іде до інших.
	if (state.offered && day > state.offered.dueDay) state.offered = null;

	const canOffer =
		!state.offered &&
		state.contracts.length < MAX_ACTIVE_CONTRACTS &&
		day - state.lastOfferDay >= CONTRACT_INTERVAL_DAYS;
	if (canOffer) {
		state.offered = offerContract(state, day);
		state.lastOfferDay = day;
		state.nextContractId += 1;
	}
}

export function endOfDay(state: ReserveState): void {
	const day = Math.floor(state.ticks / TICKS_PER_DAY);

	/*
	 * Пожертви йдуть за РЕПУТАЦІЄЮ, а не за «Користю планеті»: перша — це те, що про
	 * фонд знають, друга — те, що він насправді зробив. Одні на весь фонд.
	 *
	 * Нижче нуля — нуль, а не мінус: ненависть не виносить грошей із каси, вона
	 * просто нічого не приносить. Відʼємні пожертви читалися б як штраф, якого ніхто
	 * не оголошував.
	 */
	/*
	 * Округлення до цілого — не косметика, а умова того, щоб каса лишалася касою.
	 *
	 * Решта грошей у грі цілі: зарплати, утримання, ціни вольєрів, порція корму.
	 * Відколи репутація стала дробовою, пожертви перестали бути — 39.6 × 4 дає
	 * 158.4, і бюджет переставав бути цілим числом назавжди. У шапці це виглядало
	 * б як «−321.79999999998836», а в підказці — як розбіжність між сумою рядків
	 * і виміряною різницею.
	 */
	earn(state, Math.round(Math.max(0, state.reputation) * DONATION_PER_REPUTATION), 'donations');

	/*
	 * Життя йде на ВСІХ чотирьох землях, а не лише на відкритій.
	 *
	 * Це й є та властивість, заради якої зʼявився фонд: повернувшись у ліс, гравець
	 * має знайти його таким, яким його зробили тридцять прожитих днів, а не таким,
	 * яким він його покинув. Ділянка, у яку не заходили, теж їсть, зношується й
	 * лікує.
	 */
	/*
	 * Корм роздається ПЕРЕД добою ділянок: комора спільна, а стрес і одужання
	 * рахуються по ділянках. Скільком не дісталося — єдине число, яке при цьому
	 * мандрує між ними.
	 */
	let hungry = serveFeed(state);
	for (const biome of RESERVE_BIOMES) hungry = siteDay(state, state.sites[biome], hungry);

	state.subsidy = state.budget < 0;

	/*
	 * Програш — лише за «Користю планеті», і лише за ПОСПІЛЬ прожиті дні в
	 * мінусі. Вихід у нуль обнуляє лічильник: тридцять днів із перервою не
	 * означають, що фонд шкодить постійно.
	 */
	settleContracts(state, day);

	/*
	 * Публіка забуває — але тільки про те, що знала.
	 *
	 * Спад ПРОПОРЦІЙНИЙ і не переступає нуля. Умова `> 0` тут несе всю різницю:
	 * без неї відʼємна репутація «спадала» б у бік нуля, тобто час сам би змивав
	 * наслідки чорного ринку й зірваних контрактів. Нижче нуля веде лише вчинок,
	 * і повертатися звідти теж треба вчинком — випуском, одужанням, кампанією.
	 *
	 * Множник менший за одиницю, тож відняте ніколи не перевищує наявне: окремий
	 * `Math.min` тут був би захистом від того, чого не буває.
	 */
	if (state.reputation > 0) {
		addReputation(state, -state.reputation * REPUTATION_DECAY_RATE, 'decay');
	}

	state.collapseDays = state.impact < 0 ? state.collapseDays + 1 : 0;
	if (state.collapseDays >= COLLAPSE_DAYS) state.gameOver = true;

	/*
	 * Браконьєри — остання подія доби, і порядок тут важливий.
	 *
	 * Спершу закривається невирішений наліт (терпіння події вийшло), і лише потім
	 * кидається новий: інакше сьогоднішнє вікно перетерло б учорашнє, і людина
	 * втратила б тварину, навіть не побачивши, що її прийшли крати.
	 */
	expireRaid(state, day);
	maybeRaid(state, day);

	// Журнал — ОСТАННІМ рядком: він міряє добу, тож мусить бачити її всю.
	closeDay(state, day);
}
