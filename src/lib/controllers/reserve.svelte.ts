import { createReserve, dayOf, execute, residents, sitesOf, tick } from '$lib/reserve/simulation';
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
	state = $state<ReserveState>(createReserve(1));
	speed = $state<Speed>(1);
	/** Яку тварину показує картка; `null` — картки немає. */
	selectedId = $state<number | null>(null);
	/**
	 * Який ВОЛЬЄР показує картка; `null` — не показує.
	 *
	 * Друга мітка, а не одна на двох: у вольєра своя картка (міцність, ремонт,
	 * покращення), у мешканця своя. Але ВИБІР один — див. `selectAnimal`.
	 */
	selectedEnclosureId = $state<number | null>(null);
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
	isFresh = $derived(this.state.ticks === 0 && residents(this.state).length === 0);
	/**
	 * Вибрана тварина шукається по ВСЬОМУ фонду.
	 *
	 * Ділянку тут питати нема в кого: картку відкриває сцена однієї землі, але
	 * `id` унікальні на весь фонд, тож пошук по всіх дає ту саму відповідь і не
	 * вимагає тягнути біом у контролер.
	 */
	selected = $derived(
		sitesOf(this.state)
			.flatMap(([, site]) => site.animals)
			.find((a) => a.id === this.selectedId) ?? null
	);

	/** Вибраний вольєр — так само по всьому фонду й з тієї самої причини. */
	selectedEnclosure = $derived(
		sitesOf(this.state)
			.flatMap(([, site]) => site.enclosures)
			.find((e) => e.id === this.selectedEnclosureId) ?? null
	);

	/*
	 * Вибір ОДИН, хоч міток дві.
	 *
	 * Обидві картки спливають над тим самим кутом карти, тож два відкритих вікна
	 * означали б одне під іншим — саме той дефект, який щойно виправляли з
	 * мінікартою. Тому взяти тварину знімає вольєр, і навпаки; переходи між ними
	 * дають кнопки в самих картках, і шлях туди-назад лишається в один тап.
	 */
	selectAnimal(id: number): void {
		this.selectedId = id;
		this.selectedEnclosureId = null;
	}

	selectEnclosure(id: number): void {
		this.selectedEnclosureId = id;
		this.selectedId = null;
	}

	clearSelection(): void {
		this.selectedId = null;
		this.selectedEnclosureId = null;
	}

	/** Недокручені мілісекунди: те, що не дотягнуло до цілого тіку. */
	#carry = 0;
	#frame: number | null = null;
	#last = 0;
	/** День, яким партія лежить у сховищі. Різниця — привід зберегти. */
	#savedDay = 0;
	/** Чи фонд уже піднято зі сховища. Синглтон, а сторінок — пʼять. */
	#started = false;

	/**
	 * Почати партію: відновити збережену або створити нову.
	 *
	 * Зерно нової береться з годинника — це ЄДИНЕ місце, де недетермінованість
	 * доречна. Далі партія розгортається лише з нього, тож двом учасникам
	 * колись вистачить переслати одне число замість усього світу.
	 */
	start(): void {
		// Двічі не піднімаємо: сторінки ділянок і сторінка вибору тримають ОДИН фонд,
		// і другий `start()` затер би те, що перша сторінка вже награла.
		if (this.#started) return;
		this.#started = true;

		const restored = loadReserve();
		if (restored.ok) {
			this.state = restored.state;
			this.#savedDay = dayOf(restored.state);
		} else {
			// «Збереження немає» — це звичайний перший запуск, а не проблема.
			this.restoreProblem = restored.reason === 'empty' ? null : restored;
			this.reset();
		}
	}

	reset(seed = Date.now() >>> 0): void {
		this.state = createReserve(seed);
		this.clearSelection();
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

	/**
	 * Єдиний шлях зміни фонду. Пара «де + що» колись прийде мережею саме такою.
	 */
	run(command: ReserveCommand, at: ReserveBiome): CommandResult {
		const result = execute(this.state, command, at);
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

/**
 * Фонд ОДИН на весь застосунок.
 *
 * Синглтон, а не інстанс на сторінку: каса, шкали й годинник спільні, тож два
 * контролери писали б у той самий ключ і затирали один одного. Заразом це те, що
 * дає сторінці вибору ділянки показувати ті самі показники, які бачить карта.
 */
export const reserve = new ReserveController();
