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

	constructor(info: RoomInfo, members: Member[]) {
		this.#info = info;
		this.#members = members;
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
				if (this.#moves.some((existing) => existing.seq === move.seq)) return false;
				this.#moves.push(move);
				this.#moves.sort((a, b) => a.seq - b.seq);
				this.#emit();
				return true;
			},

			setStatus: async (status) => {
				this.#info = { ...this.#info, status };
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
