import { createReserve, dayOf, execute, tick } from '$lib/reserve/simulation';
import type { CommandResult, ReserveCommand, ReserveState } from '$lib/reserve/types';
import { loadReserve, saveReserve } from '$lib/services/reserveSave';
import type { RestoreFailure } from '$lib/reserve/save';
import type { ReserveBiome } from '$lib/reserve/species';

/**
 * Партія заповідника в рунах: місток між чистою симуляцією й екраном.
 *
 * Симуляція не знає ні про час, ні про кадри — вона рахує тіки. Хтось мусить
 * перекласти реальні мілісекунди в кількість тіків, і це рівно те, що робить
 * контролер. Розрив свідомий: `Date.now()` тут законний, а на десять рядків
 * глибше, у `src/lib/reserve/`, заборонений інваріантом. Саме тому спільна
 * партія колись стане можливою — час у неї приходить ЗВІДСИ, а не зсередини.
 *
 * Швидкості x1/x2/x5 множать КІЛЬКІСТЬ тіків за кадр, а не тривалість дня.
 * Пауза — це швидкість 0, а не зупинений цикл: зупинений цикл довелося б
 * відновлювати, і накопичений час поїхав би разом із ним.
 */

/** Скільки реального часу коштує один логічний тік при x1. */
export const TICK_MS = 100;

export const SPEEDS = [0, 1, 2, 5] as const;
export type Speed = (typeof SPEEDS)[number];

/**
 * Скільки часу максимум надолужується за один кадр.
 *
 * Вкладка у фоні не отримує кадрів. Без межі повернення через десять хвилин
 * дало б 6 000 тіків одним махом — двадцять ігрових днів, за які заповідник
 * міг би збанкрутувати, поки на нього ніхто не дивився. Це не симуляція, це
 * звіт про помилку. Тому надолужується щонайбільше чверть секунди, а решта
 * пропущеного часу просто не була прожита.
 */
const MAX_CATCH_UP_MS = 250;

export class ReserveController {
	/**
	 * Біом задається при створенні й далі не міняється: він визначає і адресу
	 * сторінки, і ключ у сховищі. Контролер без біома не знав би, яку саме з
	 * чотирьох партій він веде.
	 */
	readonly biome: ReserveBiome;

	/*
	 * Заглушка тут не косметична: ініціалізатори полів виконуються ДО тіла
	 * конструктора, а `day` і `isFresh` нижче читають `state`. Поле без значення
	 * зробило б їх читанням `undefined` — саме це й ловить перевірка типів.
	 */
	state = $state<ReserveState>(createReserve(1));

	constructor(biome: ReserveBiome) {
		this.biome = biome;
		// Справжня стартова партія — уже з біомом. `start()` перезапише її сейвом,
		// якщо він є, але до того моменту сцена мусить бачити правильний біом.
		this.state = createReserve(1, biome);
	}
	speed = $state<Speed>(1);
	/** Яку тварину показує картка; `null` — картки немає. */
	selectedId = $state<number | null>(null);
	/** Чому не вдалося відновити партію. Показує екран, вирішує людина. */
	restoreProblem = $state<RestoreFailure | null>(null);

	day = $derived(dayOf(this.state));
	/**
	 * Партія, у якій ще нічого не сталося.
	 *
	 * Саме за цим екран вирішує, питати біом чи ні. Не за наявністю сейва:
	 * контролер зберігається одразу при створенні, тож сейв є завжди — уже
	 * через мілісекунду після першого заходу.
	 */
	isFresh = $derived(
		this.state.ticks === 0 && this.state.animals.length === 0 && this.state.enclosures.length === 0
	);
	selected = $derived(this.state.animals.find((a) => a.id === this.selectedId) ?? null);

	/** Недокручені мілісекунди: те, що не дотягнуло до цілого тіку. */
	#carry = 0;
	#frame: number | null = null;
	#last = 0;
	/** День, яким партія лежить у сховищі. Різниця — привід зберегти. */
	#savedDay = 0;

	/**
	 * Почати партію: відновити збережену або створити нову.
	 *
	 * Зерно нової береться з годинника — це ЄДИНЕ місце, де недетермінованість
	 * доречна. Далі партія розгортається лише з нього, тож двом учасникам
	 * колись вистачить переслати одне число замість усього світу.
	 */
	start(): void {
		const restored = loadReserve(this.biome);
		if (restored.ok) {
			this.state = restored.state;
			this.#savedDay = dayOf(restored.state);
		} else {
			// «Збереження немає» — це звичайний перший запуск, а не проблема.
			this.restoreProblem = restored.reason === 'empty' ? null : restored;
			this.reset();
		}
	}

	reset(seed = Date.now() >>> 0, biome: ReserveBiome = this.biome): void {
		this.state = createReserve(seed, biome);
		this.selectedId = null;
		this.#carry = 0;
		this.#savedDay = 0;
		this.save();
	}

	/**
	 * Просунути партію на `elapsed` реального часу.
	 *
	 * Публічний і окремий від циклу кадрів навмисно: так тест веде час прямо, без
	 * підробленого `requestAnimationFrame`, а сам метод лишається тим самим
	 * шматком коду, який працює у грі. Метод, який у тестах підмінений, нічого
	 * про гру не доводить.
	 */
	advance(elapsed: number): void {
		if (this.state.gameOver || this.speed === 0) return;

		this.#carry += Math.min(elapsed, MAX_CATCH_UP_MS) * this.speed;
		const ticks = Math.floor(this.#carry / TICK_MS);
		if (ticks <= 0) return;

		this.#carry -= ticks * TICK_MS;
		tick(this.state, ticks);

		// Зберігаємося на межі доби, а не щокадру: сховище синхронне, і запис
		// шістдесят разів на секунду підвісив би саме той кадр, який малює гру.
		if (this.day !== this.#savedDay) this.save();
	}

	/** Єдиний шлях зміни партії. Той самий обʼєкт колись прийде мережею. */
	run(command: ReserveCommand): CommandResult {
		const result = execute(this.state, command);
		if (result.ok) this.save();
		return result;
	}

	save(): boolean {
		this.#savedDay = this.day;
		return saveReserve(this.state);
	}

	/** Цикл кадрів. Повертає функцію зупинки — просто в `onMount`. */
	startClock(): () => void {
		this.#last = performance.now();
		const step = (now: number) => {
			this.advance(now - this.#last);
			this.#last = now;
			this.#frame = requestAnimationFrame(step);
		};
		this.#frame = requestAnimationFrame(step);

		return () => {
			if (this.#frame !== null) cancelAnimationFrame(this.#frame);
			this.#frame = null;
			// Пішли зі сторінки — зберігаємо, навіть якщо доба не скінчилася.
			this.save();
		};
	}
}
