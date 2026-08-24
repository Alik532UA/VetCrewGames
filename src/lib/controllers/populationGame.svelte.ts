import { randomFor } from '$lib/utils/seededRandom';
import { getRandomAnimals, type Animal } from '$lib/config/population-game';
import { playerData } from '$lib/services/playerData.svelte';
import { GAME_ID } from '$lib/config/menu-games';
import { maxSessionPoints, roundPoints } from '$lib/config/scoring';
import type { RoundOutcome } from '$lib/types/game';

/**
 * Стан гри «Кого більше?»: дошка, вибір картки й правила раунду.
 *
 * Межа з компонентом проведена так: **тут — що станеться**, у `+page.svelte` —
 * **чим це викликано**. Контролер не знає ні про `DragEvent`, ні про
 * `TouchEvent`, ні про клон, який їздить за пальцем; сторінка не знає, за яким
 * правилом картки міняються місцями (SVELTE-CORE-v8 § 3.1, HIGH).
 *
 * Ця межа й пояснює, чому «перетягування» лишилося у сторінці, а «покласти
 * картку в комірку» переїхало сюди: перше — спосіб введення, друге — правило
 * гри. Той самий `dropOnSlot()` викликають і миша, і палець, і подвійний клік,
 * і клавіатура, якщо колись з'явиться.
 *
 * Контролер створює компонент (`new`), а не модуль: партія має гинути разом зі
 * сторінкою, і `reset()` тут відповідає кнопці «Грати знову» (§ 1.4).
 */

/** Звідки взяли картку: з ряду-джерела чи з комірки на дошці. */
export type Place = { type: 'source'; index: number } | { type: 'slot'; index: number };

export class PopulationGameController {
	readonly slotCount: number;
	readonly totalRounds: number;

	roundNumber = $state(1);
	roundResults = $state<RoundOutcome[]>([]);
	sessionScore = $state(0);
	gameOver = $state(false);

	/** Картки в ряду-джерелі; `null` — картку звідти вже забрали. */
	sourceAnimals = $state<(Animal | null)[]>([]);
	/** Комірки дошки в порядку, який склав гравець. */
	slots = $state<(Animal | null)[]>([]);
	/** Початковий склад раунду — потрібен, щоб знати «рідне» місце картки. */
	initialSourceAnimals = $state<(Animal | null)[]>([]);
	correctOrder = $state<Animal[]>([]);
	checked = $state(false);

	/** Вибрана картка й місце, звідки її взяли. Спільне для миші, дотику й кліку. */
	picked = $state<Animal | null>(null);
	pickedFrom = $state<Place | null>(null);

	/**
	 * Чи був останній хід ОБМІНОМ (на місці призначення вже щось лежало).
	 * Читає лише анімація переходу: обмін летить дугою, просте перенесення — ні.
	 */
	isSwapping = $state(false);

	allSlotsFilled = $derived(this.slots.every((slot) => slot !== null));

	/**
	 * Порівнюється ЧИСЕЛЬНІСТЬ, а не `id`: дві тварини з однаковою популяцією
	 * дають однаково правильний порядок, і карати за вибір «не тієї» з них
	 * було б неправильно.
	 */
	slotResults = $derived.by(() =>
		this.checked
			? this.slots.map((animal, i) => animal?.population === this.correctOrder[i]?.population)
			: ([] as boolean[])
	);

	availableAnimals = $derived(
		this.initialSourceAnimals.filter((animal): animal is Animal => animal !== null)
	);

	/**
	 * Максимум за партію.
	 *
	 * Було `totalRounds * slotCount` — по очку за позицію, і це занижувало
	 * максимум на десять балів: раунд без жодної помилки дає ще й
	 * `PERFECT_BONUS`, тобто 3 + 1 = 4. Тепер число бере `maxSessionPoints`, і
	 * надбавка враховується сама.
	 */
	get maxScore(): number {
		return maxSessionPoints(this.slotCount, this.totalRounds);
	}

	/**
	 * Джерело випадковості ПАРТІЇ — одне на всю партію, а не на раунд.
	 *
	 * Саме тому воно поле, а не виклик у `#next()`: послідовність раундів мусить
	 * відтворюватися цілком. Новий генератор на кожен раунд дав би однакове перше
	 * питання й розбіжність далі — найгірший різновид розбіжності, бо схожий на
	 * робочу гру.
	 *
	 * Без зерна тут `Math.random`: соло-партія має бути іншою щоразу. Із зерном —
	 * та сама гра в усіх учасників, і для цього досить переслати одне число.
	 */
	#random: () => number;

	/** Зерно партії; `undefined` — соло, кожен захід інший. */
	readonly #seed: number | undefined;

	constructor(slotCount = 3, totalRounds = 10, seed?: number) {
		this.#seed = seed;
		this.#random = randomFor(seed);
		this.slotCount = slotCount;
		this.totalRounds = totalRounds;
	}

	/** Новий розклад карток. Викликається на старті раунду й на «Грати знову». */
	startRound(): void {
		const picked = getRandomAnimals(this.slotCount, this.#random);
		this.sourceAnimals = picked;
		this.initialSourceAnimals = [...picked];
		this.slots = Array(this.slotCount).fill(null);
		this.checked = false;
		this.correctOrder = [...picked].sort((a, b) => a.population - b.population);
		this.clearSelection();
	}

	clearSelection(): void {
		this.picked = null;
		this.pickedFrom = null;
	}

	/**
	 * Клік по картці: вибрати, зняти вибір або поміняти місцями з уже вибраною.
	 * Повертає `true`, якщо хід відбувся, — сторінці це потрібно, щоб не
	 * тлумачити той самий клік іще й як початок перетягування.
	 */
	select(animal: Animal, from: Place): boolean {
		if (this.checked) return false;

		// Вибрано іншу картку — це обмін, а не новий вибір.
		if (this.picked && this.picked.id !== animal.id) {
			return from.type === 'slot' ? this.dropOnSlot(from.index) : this.dropOnSource(from.index);
		}

		if (this.picked?.id === animal.id) this.clearSelection();
		else {
			this.picked = animal;
			this.pickedFrom = from;
		}
		return false;
	}

	dropOnSlot(targetIndex: number): boolean {
		const animal = this.picked;
		const from = this.pickedFrom;
		if (this.checked || !animal || !from) return false;

		this.isSwapping = this.slots[targetIndex] !== null;

		if (from.type === 'slot') {
			this.slots[from.index] = this.slots[targetIndex];
		} else {
			this.sourceAnimals[from.index] = this.slots[targetIndex];
		}
		this.slots[targetIndex] = animal;

		this.clearSelection();
		return true;
	}

	dropOnSource(targetIndex: number): boolean {
		const animal = this.picked;
		const from = this.pickedFrom;
		if (this.checked || !animal || !from) return false;

		this.isSwapping = this.sourceAnimals[targetIndex] !== null;

		if (from.type === 'source') {
			this.sourceAnimals[from.index] = this.sourceAnimals[targetIndex];
		} else {
			this.slots[from.index] = this.sourceAnimals[targetIndex];
		}
		this.sourceAnimals[targetIndex] = animal;

		this.clearSelection();
		return true;
	}

	/**
	 * Подвійний клік: відправити картку туди, де для неї є вільне місце.
	 * З ряду — у першу порожню комірку; з дошки — на своє початкове місце, а
	 * якщо воно зайняте, то в будь-яке вільне.
	 */
	sendToFreeSpot(animal: Animal, from: Place): void {
		if (this.checked) return;
		if (this.picked?.id === animal.id) this.clearSelection();

		if (from.type === 'source') {
			const freeSlot = this.slots.indexOf(null);
			if (freeSlot === -1) return;
			this.isSwapping = false;
			this.slots[freeSlot] = animal;
			this.sourceAnimals[from.index] = null;
			return;
		}

		const home = this.initialSourceAnimals.findIndex((a) => a?.id === animal.id);
		const target =
			home !== -1 && this.sourceAnimals[home] === null ? home : this.sourceAnimals.indexOf(null);
		if (target === -1) return;

		this.isSwapping = false;
		this.sourceAnimals[target] = animal;
		this.slots[from.index] = null;
	}

	/** Перемістити картку в конкретне місце, звідки б вона зараз не була. */
	moveTo(animal: Animal, targetType: 'slot' | 'source', targetIndex: number): void {
		if (this.checked) return;

		const slotIndex = this.slots.findIndex((a) => a?.id === animal.id);
		const sourceIndex =
			slotIndex === -1 ? this.sourceAnimals.findIndex((a) => a?.id === animal.id) : -1;

		const from: Place | null =
			slotIndex !== -1
				? { type: 'slot', index: slotIndex }
				: sourceIndex !== -1
					? { type: 'source', index: sourceIndex }
					: null;
		if (!from) return;
		if (from.type === targetType && from.index === targetIndex) return;

		this.picked = animal;
		this.pickedFrom = from;
		if (targetType === 'slot') this.dropOnSlot(targetIndex);
		else this.dropOnSource(targetIndex);
	}

	/** Перевірити порядок. Очко за кожну правильну позицію, не за весь раунд. */
	check(): void {
		if (!this.allSlotsFilled || this.checked) return;
		this.checked = true;

		const correctCount = this.slotResults.filter(Boolean).length;

		let outcome: RoundOutcome = 'incorrect';
		if (correctCount === this.slotCount) outcome = 'correct';
		else if (correctCount > 0) outcome = 'partial';
		this.roundResults.push(outcome);

		if (correctCount > 0) {
			// По очку за слот, надбавка за повний ряд (config/scoring.ts).
			const points = roundPoints(correctCount, this.slotCount);
			this.sessionScore += points;
			playerData.addScore(points);
		}
	}

	nextRound(): void {
		if (this.roundNumber < this.totalRounds) {
			this.roundNumber++;
			this.startRound();
		} else {
			this.#finish();
		}
	}

	/**
	 * Кінець партії — і рекорд гри пишеться РІВНО ТУТ, один раз.
	 *
	 * Перевірка `gameOver` на вході не про обережність: кінець партії настає з
	 * кількох місць (раунди скінчилися, набори скінчилися), і кожне з них раніше
	 * просто ставило прапорець. Рекорд, записаний двічі, зіпсував би `plays` —
	 * тобто число партій, яких не було.
	 */
	#finish(): void {
		if (this.gameOver) return;
		this.gameOver = true;
		playerData.finishGame(GAME_ID.population, this.sessionScore);
	}

	/**
	 * Те саме зерно — та сама гра, і ПІСЛЯ «грати знову»: генератор створюється
	 * заново. Для соло це нічого не міняє (там він і був `Math.random`), а для
	 * спільної партії робить повтор передбачуваним, а не «майже тим самим».
	 */
	reset(): void {
		this.#random = randomFor(this.#seed);
		this.roundNumber = 1;
		this.roundResults = [];
		this.sessionScore = 0;
		this.gameOver = false;
		this.startRound();
	}
}
