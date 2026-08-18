import { MemoryGameController, type MemoryPlayer } from './memoryGame.svelte';
import type { Member, Move, RoomSnapshot, RoomTransport } from '$lib/net/roomTypes';
import { isYieldLegal, yieldReadyAt, type TurnState } from './turnLimit';

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
	/**
	 * Хто господар — з КІМНАТИ, а не з порядку у списку.
	 *
	 * Саме для цього поле й існує в `info`. Спершу сторінка рахувала господаря як
	 * «перший у складі» — і кнопка «Почати» зникала в нього, щойно заходив хтось із
	 * «меншим» `uid`: база віддає склад за алфавітом ключів, а не за входом.
	 * Знайдено живим прогоном із трьома учасниками.
	 */
	hostUid = $state('');

	/**
	 * Серверний час, від якого йде відлік поточної черги.
	 *
	 * Це `at` останнього застосованого ходу, а на початку партії — `startedAt`
	 * кімнати. Обидві позначки ставить сервер, тож усі учасники рахують межу
	 * очікування від того самого числа. `null` означає «межі ще немає»: партія не
	 * почалася або кімнату створила збірка, старша за це поле.
	 */
	turnSince = $state<number | null>(null);

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

	/**
	 * Гравці партії — у порядку входу; глядачі в черзі не стоять.
	 * **Тайбрейк за `uid` обовʼязковий:** однакові `order` правило бази виключити
	 * не вміє, а без тайбрейка порядок різниться між пристроями — чому це страшніше
	 * за вкрадену чергу, розписано в `src/cloud-database.test.ts`.
	 */
	get players(): Member[] {
		return this.members
			.filter((member) => member.role === 'player')
			.sort((a, b) => a.order - b.order || (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
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
	 *
	 * **Поки дошка чекає на перегортання, клік ПЕРЕГОРТАЄ, а не відкриває.**
	 *
	 * У соло третя картка навмисно гортає невдалу пару одразу: хто вже все
	 * запамʼятав, не мусить чекати таймера. У спільній партії те саме правило
	 * оберталося на дірку: перегортання передає хід СУПЕРНИКОВІ, і та сама третя
	 * картка ставала його першою — вибраною мною. Тобто я грав за нього.
	 *
	 * Тому швидкість лишається, а дірка зникає: клік означає «я подивився, далі»,
	 * і хід іде наступному чистим.
	 */
	async flip(index: number): Promise<void> {
		if (!this.myTurn) return;
		if (this.game.awaitingPeek) {
			await this.resolve();
			return;
		}
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

	/** Стан черги для `turnLimit`: одне джерело і для кнопки, і для застосування. */
	get #turnState(): TurnState {
		return {
			actorId: this.actor?.id,
			playerIds: this.players.map((player) => player.uid),
			turnSince: this.turnSince
		};
	}

	/** Коли чергу можна буде забрати — серверним часом; `null` — не можна. */
	get yieldReadyAt(): number | null {
		return yieldReadyAt(this.#me, this.#turnState);
	}

	/** Чи вже можна забрати чергу, якщо на годиннику `now`. */
	canYieldAt(now: number): boolean {
		const ready = this.yieldReadyAt;
		return ready !== null && now >= ready;
	}

	/**
	 * Забрати чергу в того, хто зник.
	 *
	 * **Це ХІД, а не місцева дія, і саме тому воно працює.** Присутність гасне сама
	 * (`onDisconnect`), але вона не лежить у журналі — отже, не має права впливати
	 * на стан партії, інакше дошки розійшлися б залежно від того, чий сокет
	 * обірвався першим. «Суперник відпав» не змінює нічого сам: він лише вмикає
	 * кнопку. Умови законності — у `turnLimit.ts`.
	 */
	async yieldTurn(now: number): Promise<void> {
		if (!this.canYieldAt(now)) return;
		await this.#send('yield');
	}

	async #send(type: string, payload?: Record<string, number | string>): Promise<void> {
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
		this.hostUid = snapshot.info.hostUid;

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
			const changed = this.#play(move);
			this.applied = move.seq;
			/*
			 * Відлік черги зсуває лише хід, який СПРАВДІ щось змінив.
			 *
			 * Це не оптимізація, а закриття дірки. Номер у журналі займає будь-який
			 * учасник, включно з глядачем: правило бази дозволяє створити хід,
			 * підписаний своїм uid, а законність його вже перевіряють правила гри. Якби
			 * відлік зсував кожен доданий хід, глядач міг би дописувати сміття раз на
			 * хвилину — і суперник, чий партнер зник, не забрав би чергу НІКОЛИ.
			 */
			if (changed && move.at !== undefined) this.turnSince = move.at;
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
		/*
		 * Відлік першої черги — від позначки початку партії, поставленої сервером.
		 * Без неї суперник, який зайшов у кімнату й одразу зник, тримав би першу
		 * чергу назавжди: межа очікування не мала б від чого рахуватися.
		 */
		this.turnSince = snapshot.info.startedAt ?? null;
		this.#dealt = JSON.stringify({
			seed: snapshot.info.seed,
			config: snapshot.info.config,
			players: this.players.map((player) => player.uid)
		});
	}

	/**
	 * Застосувати один хід. Тут — і тільки тут — міняється дошка.
	 *
	 * Повертає `true`, якщо хід справді щось змінив. За цим — і лише за цим —
	 * зсувається відлік черги: інакше сміттєвий хід від будь-кого в кімнаті
	 * подовжував би очікування (див. `#apply`).
	 */
	#play(move: Move): boolean {
		// `yield` — єдиний хід, який робить НЕ той, чия черга, тож він стоїть вище
		// загальної перевірки. Умови законності — у `turnLimit.ts`, і вони спираються
		// лише на журнал, тож рішення в усіх учасників збігається.
		if (move.type === 'yield') {
			if (!isYieldLegal(move, this.#turnState)) return false;
			this.game.passTurn();
			return true;
		}

		// Хід не від того, чия черга, не означає нічого — однаково в усіх.
		if (move.by !== this.game.current?.id) return false;

		/*
		 * Відкриття, коли дошка чекає на перегортання, не означає нічого — і це не
		 * дублювання перевірки з `flip()`.
		 *
		 * Там вона береже мережу, тут — партію: `game.flip()` усередині сам гортає
		 * невдалу пару (швидкий шлях соло), а разом із нею передає хід — і картка
		 * дісталася б уже СУПЕРНИКОВІ. Дописати такий хід у журнал може будь-хто
		 * напряму, тож відкидати його мусять усі однаково.
		 */
		if (move.type === 'flip' && this.game.awaitingPeek) return false;

		if (move.type === 'flip' && typeof move.payload?.index === 'number') {
			return this.game.flip(move.payload.index);
		}
		if (move.type === 'peek') {
			if (!this.game.awaitingPeek) return false;
			this.game.resolvePeek();
			return true;
		}
		// Невідомий тип ходу — від новішої збірки або від чужих рук. Нічого не
		// означає, і відлік черги не зсуває.
		return false;
	}
}
