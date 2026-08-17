import type { AnimalOrigin, Quality, StaffRole } from './constants';
import type { ContractGoal } from './contracts';
import type { ReserveBiome } from './species';

/**
 * Стан заповідника й ходи, якими його змінюють.
 *
 * Хід тут — ДАНІ, а не виклик методу. Це не стилістика: у спільній партії той
 * самий обʼєкт має прийти мережею й дати той самий результат. Та сама причина
 * стоїть за `MemoryGameController`, і там вона вже виправдалася.
 */

export type AnimalStage = 'recovering' | 'healthy' | 'released';

export interface Enclosure {
	id: number;
	/** 1–10. Від нього залежить і ціна, і кого сюди можна поселити. */
	size: number;
	/** 1–3. Розмір вирішує ХТО поміститься, якість — наскільки йому тут добре. */
	quality: Quality;
	/** 1 — щойно збудований, 0 — руїна. Спадає щодня, підіймається ремонтом. */
	durability: number;
}

export interface Animal {
	id: number;
	/** Вид із `species.ts`. Вирішує, який вольєр підходить. */
	speciesId: string;
	origin: AnimalOrigin;
	stage: AnimalStage;
	/**
	 * Де живе. Вольєр займається на весь час перебування й звільняється лише
	 * випуском — тварина не «стоїть у черзі», вона або має місце, або її немає.
	 */
	enclosureId: number;
	/** 0 → 1. Дійшовши до одиниці, тварина стає здоровою. */
	recovery: number;
	/** 0 → 1. Вище за поріг випуск блокується. */
	stress: number;
	/**
	 * Чи придатна ця особина до життя в дикій природі. Вирішується ОДИН раз,
	 * при надходженні, зерновим генератором — щоб та сама партія розгорталася
	 * однаково в усіх учасників.
	 */
	releasable: boolean;
	/** Якого дня випустили. `null`, доки тварина в заповіднику. */
	releasedOnDay: number | null;
}

export interface Contract {
	id: number;
	goal: ContractGoal;
	titleKey: import('$lib/i18n/translations/uk').TranslationKey;
	/** Скільки треба зробити ПОНАД зроблене на момент видачі. */
	amount: number;
	/**
	 * Знімок лічильника на момент видачі. Без нього «випустити двох» означало б
	 * двох за всю партію, і контракт приходив би вже виконаним.
	 */
	startedAt: number;
	/** До якого дня включно. Після нього — провал і мінус репутації. */
	dueDay: number;
	reward: number;
	penalty: number;
}

export interface ReserveState {
	/**
	 * Біом заповідника. Обирається ОДИН раз, на початку партії, і далі не
	 * міняється: він вирішує, які види сюди взагалі приїжджають, а отже — які
	 * вольєри мають сенс. Змінити його посеред гри означало б викинути все
	 * збудоване.
	 */
	biome: ReserveBiome;
	/** Логічний час. Єдине джерело «коли»: годинника симуляція не знає. */
	ticks: number;
	budget: number;
	impact: number;
	/**
	 * Публічне ім'я фонду, 0–100. Керує пожертвами. Окрема від `impact`, бо
	 * розходиться з ним там, де це щось означає, — див. докблок у `constants`.
	 */
	reputation: number;
	animals: Animal[];
	enclosures: Enclosure[];
	staff: Record<StaffRole, number>;
	/**
	 * Скільки днів поспіль «Користь планеті» в мінусі. Скидається на нуль,
	 * щойно показник вийшов у плюс, — саме тому 30 днів із перервою не
	 * призводять до кінця гри.
	 */
	collapseDays: number;
	gameOver: boolean;
	/** Партія виграна: набрано поріг «Користі планеті». Час зупиняється так само. */
	victory: boolean;
	/** Якого дня востаннє була кампанія. −1 — жодної. Тримає межу «раз на день». */
	lastCampaignDay: number;
	/**
	 * Режим антикризової субсидії: бюджет у мінусі. Годування й ліки тривають,
	 * розширення заблоковане. Це НЕ програш — програш лише за «Користю планеті».
	 */
	subsidy: boolean;
	/** Стан генератора. Зберігається зі станом, інакше сейв не відтворюється. */
	seed: number;
	rolls: number;
	/** Чинні контракти: обіцянки з дедлайном. */
	contracts: Contract[];
	/** Пропозиція, яку ще не прийняли й не відхилили. */
	offered: Contract | null;
	/** Якого дня востаннє пропонували контракт. */
	lastOfferDay: number;
	/** Наступні вільні `id`. */
	nextAnimalId: number;
	nextEnclosureId: number;
	nextContractId: number;
}

export type ReserveCommand =
	| { type: 'build'; size: number; quality: Quality }
	| { type: 'demolish'; enclosureId: number }
	| { type: 'repair'; enclosureId: number }
	| { type: 'upgrade'; enclosureId: number; quality: Quality }
	| { type: 'acquire'; origin: AnimalOrigin; speciesId: string; enclosureId: number }
	| { type: 'release'; animalId: number }
	| { type: 'hire'; role: StaffRole }
	| { type: 'dismiss'; role: StaffRole }
	| { type: 'campaign' }
	| { type: 'accept'; contractId: number }
	| { type: 'claim'; contractId: number };

/** Чому хід не пройшов. Інтерфейсу цього досить, щоб пояснити людині. */
export type RejectReason =
	| 'game-over'
	| 'no-money'
	| 'subsidy-mode'
	| 'no-such-animal'
	| 'not-healthy'
	| 'too-stressed'
	| 'not-releasable'
	| 'nobody-to-dismiss'
	| 'no-such-species'
	| 'no-such-enclosure'
	| 'enclosure-taken'
	| 'enclosure-too-small'
	| 'bad-size'
	| 'bad-quality'
	/** Вид не живе в цьому біомі — і саме це гра пояснює, а не обходить. */
	| 'wrong-biome'
	| 'already-sound'
	| 'not-an-upgrade'
	| 'campaign-done'
	/** Наступне місце в сітці випало б за межу ділянки. */
	| 'out-of-bounds'
	| 'no-such-contract'
	| 'contract-unfinished'
	| 'too-many-contracts';

export type CommandResult = { ok: true } | { ok: false; reason: RejectReason };
