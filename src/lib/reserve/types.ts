import type { AnimalOrigin, StaffRole } from './constants';

/**
 * Стан заповідника й ходи, якими його змінюють.
 *
 * Хід тут — ДАНІ, а не виклик методу. Це не стилістика: у спільній партії той
 * самий обʼєкт має прийти мережею й дати той самий результат. Та сама причина
 * стоїть за `MemoryGameController`, і там вона вже виправдалася.
 */

export type AnimalStage = 'recovering' | 'healthy' | 'released';

export interface Animal {
	id: number;
	origin: AnimalOrigin;
	stage: AnimalStage;
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
}

export interface ReserveState {
	/** Логічний час. Єдине джерело «коли»: годинника симуляція не знає. */
	ticks: number;
	budget: number;
	impact: number;
	animals: Animal[];
	staff: Record<StaffRole, number>;
	/**
	 * Скільки днів поспіль «Користь планеті» в мінусі. Скидається на нуль,
	 * щойно показник вийшов у плюс, — саме тому 30 днів із перервою не
	 * призводять до кінця гри.
	 */
	collapseDays: number;
	gameOver: boolean;
	/**
	 * Режим антикризової субсидії: бюджет у мінусі. Годування й ліки тривають,
	 * розширення заблоковане. Це НЕ програш — програш лише за «Користю планеті».
	 */
	subsidy: boolean;
	/** Стан генератора. Зберігається зі станом, інакше сейв не відтворюється. */
	seed: number;
	rolls: number;
	/** Наступний вільний `id` тварини. */
	nextAnimalId: number;
}

export type ReserveCommand =
	| { type: 'acquire'; origin: AnimalOrigin }
	| { type: 'release'; animalId: number }
	| { type: 'hire'; role: StaffRole }
	| { type: 'dismiss'; role: StaffRole };

/** Чому хід не пройшов. Інтерфейсу цього досить, щоб пояснити людині. */
export type RejectReason =
	| 'game-over'
	| 'no-money'
	| 'subsidy-mode'
	| 'no-such-animal'
	| 'not-healthy'
	| 'too-stressed'
	| 'not-releasable'
	| 'nobody-to-dismiss';

export type CommandResult = { ok: true } | { ok: false; reason: RejectReason };
