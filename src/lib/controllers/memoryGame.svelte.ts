import { buildDeck, MEMORY_PAIRS, type MemoryCard } from '$lib/config/memory-game';
import { settings } from '$lib/services/settings.svelte';
import type { TranslationKey } from '$lib/i18n/translations/uk';

/**
 * Стан гри «Знайди пару».
 *
 * **Написано під спільну партію з першого дня, хоча грає поки що один.**
 * Дописати мультиплеєр у гру, яка про нього не знає, означає переписати її:
 * гравець із «я» перетворюється на список, черга з'являється там, де її не
 * було, а очко раптом належить комусь конкретному. Тому тут від початку:
 *
 *  * `players` — список, а не одиничне «я». Соло — це список із одного;
 *  * хід виражений ДАНИМИ (`flip(index)`), а не подією інтерфейсу, тож той
 *    самий виклик може прийти й з мережі;
 *  * колода будується із ЗЕРНА, тож усім учасникам досить надіслати одне
 *    число замість усієї розкладки;
 *  * партію описує ОДИН обʼєкт — зерно, гравці, кількість пар. Це рівно те, що
 *    колись надішле кімната; розмір колоди вирішує партія, а не пристрій, бо
 *    інакше двоє учасників розклали б різні колоди з того самого зерна;
 *  * приховування невдалої пари — окремий перехід (`resolvePeek()`), а не
 *    таймер усередині. Хто його викличе — інтерфейс чи сервер, — правилам
 *    байдуже, а тести обходяться без підробленого часу.
 *
 * Чого тут свідомо НЕМАЄ: мережі, кімнат і синхронізації. Це наступний шар, і
 * він стане поверх цього, не переписуючи його.
 */

export interface MemoryPlayer {
	id: string;
	nameKey: TranslationKey;
	/** Скільки пар зібрав. Переможець — той, у кого більше. */
	score: number;
	/** Чи це гравець за цим пристроєм: очки в загальний рахунок ідуть лише йому. */
	local: boolean;
}

/** Стан однієї картки на дошці. */
export interface MemorySlot {
	card: MemoryCard;
	/** Відкрита зараз — або тимчасово, або назавжди. */
	faceUp: boolean;
	/** Хто забрав пару; `null` — ще на дошці. */
	takenBy: string | null;
}

/** Опис партії: усе, про що учасники мусять домовитися перед роздачею. */
export interface MemoryParty {
	/** Зерно колоди. Однакове в усіх — однакова розкладка. */
	seed: number;
	/** Скільки пар роздати. За замовчуванням — те, з чим створили контролер. */
	pairs?: number;
	/**
	 * На скільки колонок класти. Належить ПАРТІЇ, а не екрану: сітка, що
	 * перебудовується посеред гри, стирає те, що гравець уже запам'ятав.
	 */
	cols?: number;
	/** Хто грає. Соло — це список із одного. */
	players?: MemoryPlayer[];
}

const SOLO_PLAYER: MemoryPlayer = { id: 'you', nameKey: 'memory.you', score: 0, local: true };

export class MemoryGameController {
	/**
	 * Не `readonly`: розмір колоди задає партія, і на телефоні він менший, ніж
	 * на комп'ютері. Вирішується один раз, у `start()`, — під час гри мінятися
	 * не може, інакше поворот екрана перероздав би колоду посеред ходу.
	 */
	pairs = $state(MEMORY_PAIRS);

	/**
	 * Колонки зафіксовані на всю партію. Медіазапит перебудовував сітку на
	 * кожну зміну ширини вікна — і 4×5 ставало 7×2 з хвостиком просто тому, що
	 * вікно потягнули. Гра при цьому вся про те, ЩО ДЕ ЛЕЖИТЬ.
	 */
	cols = $state(7);

	slots = $state<MemorySlot[]>([]);
	players = $state<MemoryPlayer[]>([]);
	currentPlayerIndex = $state(0);
	/** Скільки разів гравці відкривали пару карток. Менше — краще. */
	moves = $state(0);
	gameOver = $state(false);

	/** Індекси відкритих зараз карток: нуль, один або два. */
	#peek: number[] = $state([]);

	get current(): MemoryPlayer {
		return this.players[this.currentPlayerIndex];
	}

	/** Дві картки відкриті й не збіглися — дошка чекає на `resolvePeek()`. */
	awaitingPeek = $derived(this.#peek.length === 2);

	/** Пари, які вже забрали. Потрібне і для рахунку, і для кінця партії. */
	takenPairs = $derived(this.slots.filter((slot) => slot.takenBy !== null).length / 2);

	/** Рахунок гравця за цим пристроєм — його показує картка кінця партії. */
	localScore = $derived(this.players.find((player) => player.local)?.score ?? 0);

	/**
	 * Почати партію за її описом. Один обʼєкт, а не три аргументи: це те саме,
	 * що колись прийде з мережі одним повідомленням.
	 */
	start({
		seed,
		pairs = this.pairs,
		cols = this.cols,
		players = [{ ...SOLO_PLAYER }]
	}: MemoryParty): void {
		this.pairs = pairs;
		this.cols = cols;
		this.slots = buildDeck(seed, pairs).map((card) => ({
			card,
			faceUp: false,
			takenBy: null
		}));
		this.players = players.map((player) => ({ ...player, score: 0 }));
		this.currentPlayerIndex = 0;
		this.moves = 0;
		this.gameOver = false;
		this.#peek = [];
	}

	/**
	 * Відкрити картку. Єдиний хід у грі — і єдине, що колись прийде з мережі.
	 *
	 * Повертає `true`, якщо хід зараховано: інтерфейсу цього досить, щоб знати,
	 * чи перезапускати таймер приховування.
	 */
	flip(index: number): boolean {
		if (this.gameOver) return false;

		const slot = this.slots[index];
		if (!slot || slot.takenBy !== null || slot.faceUp) return false;

		/*
		 * Дві невдалі картки не блокують дошку: клік по третій гортає їх ОДРАЗУ
		 * й починає новий хід. Пауза лишається для тих, хто хоче роздивитися, і
		 * зникає для тих, хто вже все запам'ятав, — гра йде в темпі гравця, а не
		 * таймера.
		 *
		 * Перевірка самої картки стоїть ВИЩЕ навмисно: клік по вже відкритій
		 * нічого не гортає, інакше промах по власній парі закривав би її сам.
		 */
		if (this.awaitingPeek) this.resolvePeek();

		slot.faceUp = true;
		this.#peek = [...this.#peek, index];
		if (this.#peek.length < 2) return true;

		this.moves++;
		const [first, second] = this.#peek;
		if (this.slots[first].card.pairKey !== this.slots[second].card.pairKey) return true;

		// Збіг зараховується ОДРАЗУ: ховати нема чого, і хід лишається за тим-таки
		// гравцем — це і є вся нагорода за влучну пам'ять.
		this.#takePair(first, second);
		return true;
	}

	/**
	 * Прибрати невдалу пару й передати хід.
	 *
	 * Викликає той, хто відміряв паузу: інтерфейс — таймером, спільна партія —
	 * повідомленням. Правила часу не знають і знати не мають.
	 */
	resolvePeek(): void {
		if (!this.awaitingPeek) return;
		for (const index of this.#peek) this.slots[index].faceUp = false;
		this.#peek = [];
		this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
	}

	#takePair(first: number, second: number): void {
		const player = this.current;
		this.slots[first].takenBy = player.id;
		this.slots[second].takenBy = player.id;
		player.score++;
		this.#peek = [];

		// У загальний рахунок сайту йдуть лише пари гравця за цим пристроєм:
		// чужі очки — не його досягнення.
		if (player.local) settings.addScore(1);

		if (this.takenPairs === this.pairs) this.gameOver = true;
	}
}
