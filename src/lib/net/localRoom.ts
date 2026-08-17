import type { Member, Move, RoomInfo, RoomSnapshot, RoomStatus, RoomTransport } from './roomTypes';

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
	transport(): RoomTransport {
		return {
			watch: (onSnapshot) => {
				this.#listeners.add(onSnapshot);
				// Перший знімок — одразу: підписка мусить давати ПОТОЧНИЙ стан, а не
				// лише майбутні зміни. Інакше учасник, який зайшов посеред партії,
				// сидів би з порожньою дошкою до чийогось наступного ходу.
				onSnapshot(this.#snapshot());
				return () => this.#listeners.delete(onSnapshot);
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
				if (this.#moves.some((existing) => existing.seq === move.seq)) return false;
				// Час ставить «сервер», а не той, хто надіслав хід, — рівно як
				// правило бази, що вимагає позначку у вікні навколо серверного часу.
				// Тому підроблений `at` тут так само нічого не означає.
				this.#moves.push({ ...move, at: this.#now });
				this.#moves.sort((a, b) => a.seq - b.seq);
				this.#emit();
				return true;
			},

			setStatus: async (status) => {
				this.#info =
					status === 'playing'
						? { ...this.#info, status, startedAt: this.#now }
						: { ...this.#info, status };
				this.#emit();
			},

			restart: async (seed) => {
				// Обидві половини одночасно, як і в справжній базі.
				this.#moves = [];
				this.#info = { ...this.#info, seed, status: 'playing', startedAt: this.#now };
				this.#emit();
			}
		};
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
