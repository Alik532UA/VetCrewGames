import { MemoryGameController, type MemoryPlayer } from './memoryGame.svelte';
import type { Member, Move, RoomSnapshot, RoomTransport } from '$lib/net/roomTypes';

/**
 * Спільна партія «Знайди пару»: журнал ходів → правила гри.
 *
 * Адаптер між конвертом кімнати (`net/roomTypes`) і контролером, який уже вміє
 * все потрібне: роздати колоду із зерна, тримати список гравців, приймати хід
 * даними. Мережі тут немає — є транспорт, і в тестах він живе в памʼяті.
 *
 * **Місцевий стан НІКОЛИ не змінюється кліком.** Тап дописує хід у журнал, а
 * дошка ворухнеться тоді, коли хід приїде назад. Це не педантизм: оптимістична
 * зміна вимагала б потім примиряти два стани — і саме на цьому в MindStep
 * виросли захисні періоди, прапорці «перемогу вже оголошено» й комментарі «FIX:
 * race condition». База відбиває власний запис одразу, тож на око різниці немає.
 *
 * **Незаконний хід нікого не розводить.** Правила застосування однакові в усіх:
 * хід не від того, чия черга, відкидається — отже, відкидається В УСІХ. Тому
 * учасник, який спробує зіграти позачергово, не зламає партію: його хід просто
 * нічого не означає, і всі бачать це однаково.
 */
export class PairsMatch {
	readonly game = new MemoryGameController();

	/** Скільки ходів журналу вже застосовано до дошки. */
	applied = $state(0);
	/** Стан кімнати: доки не `playing`, дошки немає. */
	status = $state<'lobby' | 'playing' | 'over'>('lobby');
	members = $state<Member[]>([]);

	readonly #me: string;
	readonly #transport: RoomTransport;
	/** Опис партії, з якого роздано поточну дошку. Зміна = роздати заново. */
	#dealt = '';

	constructor(me: string, transport: RoomTransport) {
		this.#me = me;
		this.#transport = transport;
	}

	/** Підписка на кімнату. Повертає відписку — просто в `onMount`. */
	listen(): () => void {
		return this.#transport.watch((snapshot) => this.#apply(snapshot));
	}

	/** Гравці партії — у порядку входу. Глядачі в черзі не стоять. */
	get players(): Member[] {
		return this.members
			.filter((member) => member.role === 'player')
			.sort((a, b) => a.order - b.order);
	}

	get iAmSpectator(): boolean {
		return !this.players.some((player) => player.uid === this.#me);
	}

	/** Чий зараз хід. `null` — партія не почалася або скінчилася. */
	get actor(): MemoryPlayer | null {
		if (this.status !== 'playing' || this.game.gameOver) return null;
		return this.game.current ?? null;
	}

	get myTurn(): boolean {
		return this.actor?.id === this.#me;
	}

	/**
	 * Відкрити картку. Нічого не малює — лише дописує хід.
	 *
	 * Перевірка черги стоїть і тут, і при застосуванні, і це не дублювання: тут
	 * вона береже мережу від безглуздих записів, там — партію від чужих.
	 */
	async flip(index: number): Promise<void> {
		if (!this.myTurn) return;
		await this.#send('flip', { index });
	}

	/**
	 * Прибрати невдалу пару й передати хід.
	 *
	 * У соло це робить таймер сторінки. У спільній партії — ТОЙ САМИЙ гравець,
	 * чия черга, і теж ходом: два таймери на двох пристроях спрацювали б у різні
	 * миті, і дошки розійшлися б рівно на той час, поки один уже перегорнув, а
	 * другий ще ні.
	 */
	async resolve(): Promise<void> {
		if (!this.myTurn || !this.game.awaitingPeek) return;
		await this.#send('peek');
	}

	async #send(type: string, payload?: Record<string, number>): Promise<void> {
		/*
		 * Поля `payload` НЕМАЄ, коли даних немає, — а не `undefined`.
		 *
		 * Це не охайність: `set()` у Firebase на `undefined` усередині обʼєкта кидає
		 * помилку. Хід `peek` даних не несе, тож він не записувався НІКОЛИ — дошка
		 * назавжди лишалася з двома відкритими картками. Підставний транспорт
		 * `undefined` приймав, тож тести цього не бачили; тепер не приймає й він.
		 */
		const move: Move = payload
			? { seq: this.applied + 1, by: this.#me, type, payload }
			: { seq: this.applied + 1, by: this.#me, type };
		// `false` означає, що цей номер уже зайняли. Хід зникає, і це правильно:
		// журнал — правда, а не наш намір.
		await this.#transport.append(move);
	}

	#apply(snapshot: RoomSnapshot): void {
		this.members = snapshot.members;
		this.status = snapshot.info.status;

		/*
		 * Опис партії — рядок, і порівнюється він цілком.
		 *
		 * Зерно, розмір колоди й СКЛАД ГРАВЦІВ разом задають роздачу. Змінилося
		 * будь-що з них — дошку треба роздати заново й прокрутити журнал спочатку.
		 * Саме це й робить пізнього учасника рівним усім: він не отримує стану, він
		 * відтворює його.
		 */
		const deal = JSON.stringify({
			seed: snapshot.info.seed,
			config: snapshot.info.config,
			players: this.players.map((player) => player.uid)
		});

		if (deal !== this.#dealt || snapshot.moves.length < this.applied) {
			this.#deal(snapshot);
		}

		for (const move of snapshot.moves) {
			if (move.seq <= this.applied) continue;
			// Пропуск у нумерації означає, що хід ще не приїхав. Чекаємо: застосувати
			// наступний означало б зіграти партію в іншому порядку, ніж сусід.
			if (move.seq !== this.applied + 1) break;
			this.#play(move);
			this.applied = move.seq;
		}
	}

	#deal(snapshot: RoomSnapshot): void {
		const players: MemoryPlayer[] = this.players.map((member) => ({
			id: member.uid,
			nameKey: 'memory.you',
			name: member.name,
			score: 0,
			// Очки в загальний рахунок сайту йдуть лише за СВОЇ пари.
			local: member.uid === this.#me
		}));

		this.game.start({
			seed: snapshot.info.seed,
			pairs: snapshot.info.config.pairs,
			cols: snapshot.info.config.cols,
			// Глядач дивиться партію, у якій його немає; порожній список неможливий,
			// бо кімната без гравців не переходить у `playing`.
			players: players.length > 0 ? players : undefined
		});
		this.applied = 0;
		this.#dealt = JSON.stringify({
			seed: snapshot.info.seed,
			config: snapshot.info.config,
			players: this.players.map((player) => player.uid)
		});
	}

	/** Застосувати один хід. Тут — і тільки тут — міняється дошка. */
	#play(move: Move): void {
		// Хід не від того, чия черга, не означає нічого — однаково в усіх.
		if (move.by !== this.game.current?.id) return;

		if (move.type === 'flip' && typeof move.payload?.index === 'number') {
			this.game.flip(move.payload.index);
			return;
		}
		if (move.type === 'peek') this.game.resolvePeek();
	}
}
