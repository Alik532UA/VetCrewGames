import type { Member, Move, RoomInfo, RoomSnapshot, RoomStatus, RoomTransport } from './roomTypes';

/** Як поводиться транспорт ОДНОГО учасника. */
export interface LocalTransportOptions {
	/**
	 * ЛОКАЛЬНЕ ВІДЛУННЯ ЗАПИСУ — так, як це робить Firebase.
	 *
	 * SDK показує власний запис ОДРАЗУ, ще до відповіді бази, а якщо база його
	 * відкинула — прибирає наступним знімком, і на тому самому номері з'являється
	 * чужий хід. Без цього режиму підставка була лагіднішою за оригінал: відкинутий
	 * хід тут просто не з'являвся ніколи, тож контролер, що не вміє розібратися з
	 * відкатом, проходив би кожен тест (аудит 2026-09-23, «Знайди пару»: пристрій,
	 * чий хід відкинуто, лишався з чужою дошкою до перезавантаження).
	 *
	 * Відлуння бачить лише ЦЕЙ учасник — як і в житті: чужий незакомічений запис
	 * до інших клієнтів не доходить.
	 */
	echo?: boolean;
}

/**
 * Кімната в памʼяті: той самий транспорт, тільки без мережі.
 *
 * Потрібна не «для гнучкості», а тому що інакше правила спільної партії
 * неперевірні. Із живою базою кожна перевірка вимагала б мережі, ключів і
 * чужого часу — і саме тому в MindStep мережевий шар не має жодного тесту, про
 * що там і сказано в комментарі. Тут двоє учасників живуть в одному процесі, і
 * перевірка «обидва бачать однакову дошку» стає звичайним `expect`.
 *
 * Заразом це чесна модель обмежень справжньої бази: `append` відмовляє на
 * зайнятому номері рівно так, як відмовить правило «лише створити».
 */
export class LocalRoom {
	#info: RoomInfo;
	#members: Member[];
	#moves: Move[] = [];
	#listeners = new Set<(snapshot: RoomSnapshot) => void>();
	/**
	 * Хто «на звʼязку» — для правила передачі ведення. `null` — присутність не
	 * задано: тоді господар вважається НА МІСЦІ, і ведення не передається, як і в
	 * справжній базі, поки його присутність існує.
	 */
	#present: Set<string> | null = null;
	/**
	 * «Серверний» час кімнати. Не `Date.now()`: правило межі очікування залежить
	 * від часу, а перевірка, яка залежить від справжнього годинника, або чекає
	 * реальні секунди, або зеленіє випадково. Тест рухає час `tick()`.
	 */
	#now: number;

	constructor(info: RoomInfo, members: Member[], startAt = 1_000_000) {
		this.#info = info;
		this.#members = members;
		this.#now = startAt;
		// Партія, яка вже `playing`, мусить мати позначку початку — інакше межа
		// очікування першого ходу не має від чого рахуватися.
		if (info.status === 'playing' && info.startedAt === undefined) {
			this.#info = { ...info, startedAt: startAt };
		}
	}

	/** Просунути «серверний» час кімнати. Повертає нове значення. */
	tick(ms: number): number {
		this.#now += ms;
		return this.#now;
	}

	/**
	 * Транспорт для одного учасника.
	 *
	 * Кожен отримує свій обʼєкт, але кімната одна — як і в житті. Саме через це
	 * тест може дати двом адаптерам «різні пристрої» й порівняти, що вони бачать.
	 */
	transport(options: LocalTransportOptions = {}): RoomTransport {
		/** Підписки САМЕ ЦЬОГО учасника: відлуння бачить лише він. */
		const own = new Set<(snapshot: RoomSnapshot) => void>();

		return {
			watch: (onSnapshot) => {
				this.#listeners.add(onSnapshot);
				own.add(onSnapshot);
				// Перший знімок — одразу: підписка мусить давати ПОТОЧНИЙ стан, а не
				// лише майбутні зміни. Інакше учасник, який зайшов посеред партії,
				// сидів би з порожньою дошкою до чийогось наступного ходу.
				onSnapshot(this.#snapshot());
				return () => {
					this.#listeners.delete(onSnapshot);
					own.delete(onSnapshot);
				};
			},

			append: async (move) => {
				/*
				 * `undefined` усередині ходу — помилка програмування, і тут вона кидає
				 * рівно так, як кидає `set()` у Firebase.
				 *
				 * Доти підставний транспорт таке приймав, і саме через це тести
				 * пропустили справжній дефект: хід `peek` ніс `payload: undefined`, жива
				 * база його відкидала, і перегортання не оголошувалося ніколи. Підставка,
				 * добріша за оригінал, доводить не те, що треба.
				 */
				for (const [key, value] of Object.entries(move)) {
					if (value === undefined) throw new Error(`move.${key} is undefined`);
				}
				if (options.echo) {
					/*
					 * Свій хід — на місці свого номера, навіть якщо номер уже зайнятий:
					 * так Firebase накладає незакомічений запис поверх того, що знає.
					 * Мікрозадача між відлунням і відповіддю — це «мить до бази».
					 */
					const echoed = this.#snapshot();
					echoed.moves = [
						...echoed.moves.filter((existing) => existing.seq !== move.seq),
						{ ...move, at: this.#now }
					].sort((a, b) => a.seq - b.seq);
					for (const listener of own) listener(echoed);
					await Promise.resolve();
				}
				const refused =
					!this.#allowed(move) || this.#moves.some((existing) => existing.seq === move.seq);
				if (options.echo && refused) {
					// Відмова бази (номер зайнятий або хід недозволений): відлуння зникає, і на
					// номері лишається те, що там було.
					const truth = this.#snapshot();
					for (const listener of own) listener(truth);
					return false;
				}
				if (refused) return false;
				// Час ставить «сервер», а не той, хто надіслав хід, — рівно як
				// правило бази, що вимагає позначку у вікні навколо серверного часу.
				// Тому підроблений `at` тут так само нічого не означає.
				this.#moves.push({ ...move, at: this.#now });
				this.#moves.sort((a, b) => a.seq - b.seq);
				this.#emit();
				return true;
			},

			setStatus: async (status) => {
				/*
				 * `countdownAt` гасне разом із початком партії — так само, як у справжній
				 * базі (там це один `update` із `null`).
				 *
				 * Розходження цих двох реалізацій зловив тест
				 * `pairsMatch.svelte.test.ts` → «початок партії гасить відлік»: гасіння
				 * було дописане лише в `rtdbRoom`, і підставний транспорт лишав позначку
				 * назавжди. Саме той клас дефекту, від якого тест на підставному
				 * транспорті беззахисний, якщо контракти розійшлися: перевірка доводила б
				 * властивість реалізації, якої в продакшні немає.
				 */
				const { countdownAt: _stale, ...rest } = this.#info;
				this.#info =
					status === 'playing' ? { ...rest, status, startedAt: this.#now } : { ...rest, status };
				this.#emit();
			},

			setAutoStart: async (on) => {
				// Той самий контракт, що в справжній базі: зміна режиму гасить відлік.
				const { countdownAt: _reset, ...rest } = this.#info;
				this.#info = { ...rest, autoStart: on };
				this.#emit();
			},

			setConfig: async (config) => {
				this.#info = { ...this.#info, config };
				this.#emit();
			},

			takeLead: async (move) => {
				/*
				 * Ті самі умови, що в правилі бази: автор — гравець і на звʼязку, господаря
				 * на звʼязку немає, у `from` — саме він, номер вільний. І все одним
				 * записом: господар і хід разом або ніяк.
				 */
				const author = this.#members.find((member) => member.uid === move.by);
				const hostAway = this.#present !== null && !this.#present.has(this.#info.hostUid);
				const authorHere = this.#present !== null && this.#present.has(move.by);
				if (author?.role !== 'player' || !hostAway || !authorHere) return false;
				if (move.type !== 'lead' || move.payload?.from !== this.#info.hostUid) return false;
				if (
					!this.#validSeq(move.seq) ||
					this.#moves.some((existing) => existing.seq === move.seq)
				) {
					return false;
				}
				this.#info = { ...this.#info, hostUid: move.by };
				this.#moves.push({ ...move, at: this.#now });
				this.#moves.sort((a, b) => a.seq - b.seq);
				this.#emit();
				return true;
			},

			touch: async () => {
				// Той самий контракт, що в справжній базі: позначка серверного часу.
				this.#info = { ...this.#info, aliveAt: this.#now };
				this.#emit();
			},

			removeMember: async (uid) => {
				// Той самий контракт, що в справжній базі: рядок учасника зникає цілком.
				// Підставка, добріша за оригінал, доводила б не те, що треба.
				this.#members = this.#members.filter((member) => member.uid !== uid);
				this.#emit();
			},

			setCountdown: async (active) => {
				// Підставний транспорт тримає той самий контракт: увімкнено — число,
				// скасовано — поля немає. Саме на це й дивиться сторінка.
				const { countdownAt: _drop, ...rest } = this.#info;
				this.#info = active ? { ...rest, countdownAt: this.#now } : rest;
				this.#emit();
			},

			restart: async (seed) => {
				// Усе одночасно, як і в справжній базі: зерно, журнал, початок, відлік.
				this.#moves = [];
				const { countdownAt: _stale, ...rest } = this.#info;
				this.#info = { ...rest, seed, status: 'playing', startedAt: this.#now };
				this.#emit();
			}
		};
	}

	/**
	 * Хто на звʼязку — так, наче змінилася присутність. Потрібне лише правилу
	 * передачі ведення: стану партії присутність не змінює.
	 */
	setPresent(uids: readonly string[]): void {
		this.#present = new Set(uids);
	}

	/**
	 * ТЕ САМЕ, ЩО ПЕРЕВІРЯЄ ПРАВИЛО БАЗИ `moves/$seq` — окрім підпису (транспорт тут
	 * не знає, хто за ним сидить).
	 *
	 * Доти підставка приймала будь-що: хід від не-учасника, номер `1e20`, `lead` без
	 * передачі ведення. Тобто тест проходив там, де жива база відмовить, — підставка,
	 * лагідніша за оригінал (аудит 2026-09-23).
	 */
	#allowed(move: Move): boolean {
		if (!this.#members.some((member) => member.uid === move.by)) return false;
		if (!this.#validSeq(move.seq)) return false;
		if (move.type === 'lead') {
			return move.by === this.#info.hostUid && move.payload?.from === this.#info.hostUid;
		}
		return true;
	}

	/** Ключ ходу — рівно шість цифр, тобто номер від 1 до 999999. */
	#validSeq(seq: number): boolean {
		return Number.isInteger(seq) && seq >= 1 && seq <= 999_999;
	}

	/** Змінити склад — так, наче хтось зайшов або вийшов. */
	setMembers(members: Member[]): void {
		this.#members = members;
		this.#emit();
	}

	get status(): RoomStatus {
		return this.#info.status;
	}

	get moves(): readonly Move[] {
		return this.#moves;
	}

	#snapshot(): RoomSnapshot {
		/*
		 * Копії, а не посилання. Адаптер не має жодного права правити журнал у
		 * себе «на місці»: у справжній базі це просто неможливо, і підставний
		 * транспорт мусить бути так само суворим — інакше тест пройде на тому, що
		 * в житті зламається.
		 */
		return {
			info: { ...this.#info, config: { ...this.#info.config } },
			members: this.#members.map((member) => ({ ...member })),
			moves: this.#moves.map((move) => ({ ...move }))
		};
	}

	#emit(): void {
		const snapshot = this.#snapshot();
		for (const listener of this.#listeners) listener(snapshot);
	}
}
