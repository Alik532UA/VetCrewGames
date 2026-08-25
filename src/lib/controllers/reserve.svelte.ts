import { createReserve, dayOf, execute, residents, sitesOf, tick } from '$lib/reserve/simulation';
import type { CommandResult, ReserveCommand, ReserveState } from '$lib/reserve/types';
import { loadReserve, saveReserve } from '$lib/services/reserveSave';
import type { RestoreFailure } from '$lib/reserve/save';
import type { ReserveBiome } from '$lib/reserve/species';
import type { ReserveEvent } from '$lib/reserve/events';
import { logService } from '$lib/services/logService.svelte';

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

	/**
	 * Кому розповідати про події доби, крім журналу. Ставить екран.
	 *
	 * Логування живе ТУТ і завжди: воно відповідає на питання «що сталося», яке
	 * ставлять уже після того, як щось сталося. Сповіщення ставить екран, бо лише
	 * він знає мову й місце на екрані.
	 */
	onEvent: ((event: ReserveEvent) => void) | null = null;

	/**
	 * Записати подію в журнал і віддати екрану.
	 *
	 * ## Навіщо це взагалі
	 *
	 * Скарга автора: «взяв тварину, а наступний день вона зникла, без сповіщення і
	 * без пояснень». Причин зникнення дві — смерть від хвороби й браконьєри, — і
	 * жодна не лишала слідів, окрім рядка в реєстрі показників. Тобто відповісти на
	 * питання «що сталося вчора» не міг ніхто, зокрема й я.
	 *
	 * Тепер кожна подія доби йде в журнал `game_engine` разом із днем: журнал
	 * зберігається в сесії й видний у чеклисті, тож розбір «чому зникла тварина»
	 * зводиться до читання, а не до припущень.
	 *
	 * ## Чому категорія `game_engine`, а не `app`
	 *
	 * Це події СИМУЛЯЦІЇ, а не застосунку: вони походять від того самого коду, що
	 * рахує добу, і читати їх треба разом із рештою того, що робить світ. `app`
	 * лишається для життєвого циклу сторінки.
	 */
	#announce(event: ReserveEvent): void {
		logService.info('game_engine', `reserve: ${event.kind}`, { day: this.day, ...event });
		this.onEvent?.(event);
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
			logService.info('game_engine', 'reserve: restored', { day: this.#savedDay });
		} else {
			// «Збереження немає» — це звичайний перший запуск, а не проблема.
			this.restoreProblem = restored.reason === 'empty' ? null : restored;
			/*
			 * ЧОМУ партія не піднялася — у журнал, і саме тут.
			 *
			 * `empty` — звичайний перший запуск. Решта причин означає, що запис БУВ, а
			 * прочитати його не вдалося: несумісний формат, зіпсований JSON. Для
			 * гравця це виглядає точно як «моя партія зникла», і без цього рядка
			 * відрізнити одне від одного неможливо навіть мені.
			 */
			logService[restored.reason === 'empty' ? 'info' : 'warn'](
				'game_engine',
				'reserve: fresh start',
				{ reason: restored.reason }
			);
			this.reset();
		}
	}

	/**
	 * Стерти партію й почати з нуля — ЄДИНИЙ правильний шлях скидання.
	 *
	 * Саме тут, а не в сховищі, і це не смак. Сторінка вибору ділянки стирала запис
	 * напряму (`dropReserve`, тепер прибрано), а фонд лишався в памʼяті: контролер —
	 * синглтон, і другий `start()` нічого не піднімає. Кнопка «почати всі заново»
	 * через це не робила нічого — шапка показувала стару партію, а перший же запис
	 * повертав її й у сховище.
	 *
	 * Скидання мусить належати тому, хто тримає стан. Тут воно робить обидві
	 * половини одним рухом: новий фонд у памʼяті й він же в сховищі.
	 */
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
		tick(this.state, ticks, (event) => this.#announce(event));

		// Зберігаємося на межі доби, а не щокадру: сховище синхронне, і запис
		// шістдесят разів на секунду підвісив би саме той кадр, який малює гру.
		if (this.day !== this.#savedDay) this.save();
	}

	/**
	 * Єдиний шлях зміни фонду. Пара «де + що» колись прийде мережею саме такою.
	 */
	run(command: ReserveCommand, at: ReserveBiome): CommandResult {
		const result = execute(this.state, command, at);
		/*
		 * КОЖЕН ХІД У ЖУРНАЛ — і вдалий, і відкинутий.
		 *
		 * Відкинутий важливіший: гравець бачить тост із причиною й закриває його, а
		 * за годину питає, чому тварини немає. Без цього рядка відповідь доводилося
		 * вгадувати за станом, а стан до того часу вже інший.
		 *
		 * Причина відмови пишеться кодом (`no-money`, `enclosure-too-small`) — тим
		 * самим, що йде в переклад: шукати в журналі за словом із екрана тоді
		 * можна, а за вигаданим тут описом — ні.
		 */
		logService.info('game_engine', `reserve: ${command.type}`, {
			day: this.day,
			at,
			...command,
			...(result.ok ? { ok: true } : { ok: false, reason: result.reason })
		});
		if (result.ok) this.save();
		return result;
	}

	save(): boolean {
		this.#savedDay = this.day;
		const done = saveReserve(this.state);
		/*
		 * Невдача запису — `warn`, а не тиша. Партія при цьому ЖИВА: вона в памʼяті,
		 * і гра йде далі. Але наступне відкриття сторінки покаже вчорашній фонд, і
		 * саме цей рядок відрізнить «сховище повне» від «партія зникла сама».
		 */
		if (!done) logService.warn('game_engine', 'reserve: save failed', { day: this.day });
		return done;
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
