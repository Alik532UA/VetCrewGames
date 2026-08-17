import { storage } from '$lib/services/storage';
import { allBetaChecks, type Vote } from '$lib/config/betaChecks';

/**
 * Позначки тестувальника: що він уже перевірив і що з цього вийшло.
 *
 * **Позначка несе ВЕРСІЮ, і це головне тут.** Галочка «працює», поставлена
 * сорок комітів тому, у чеклисті сусіднього проєкту виглядає точно так само, як
 * поставлена сьогодні, — тобто список поступово перетворюється на звіт про
 * минуле, який читають як звіт про теперішнє. Тут позначка з чужої версії не
 * зникає (вона все ще щось означає), але видно, що вона застаріла.
 *
 * Гідрація — у конструкторі, запис — у мутаторі: `$effect` у синглтоні кидає
 * `effect_orphan`, а `$effect.root` тут уже був і був прибраний (AGENTS.md,
 * потік даних, п. 3).
 */

const KEY = 'beta.marks';

export interface Mark {
	vote: Vote;
	/** Версія застосунку, на якій цю позначку поставили. */
	version: string;
}

class BetaProgress {
	/** `id` пункта → позначка. Пункти без позначки в сховищі просто відсутні. */
	marks = $state<Record<string, Mark>>({});

	/** Версія, на якій зараз працює сторінка. Порівнюється з версією позначки. */
	readonly version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown';

	constructor() {
		const saved = storage.getJSON<Record<string, Mark>>(KEY);
		if (saved) this.marks = saved;
	}

	vote(id: string, vote: Vote): void {
		if (vote === 'none') {
			// Знята позначка ВИДАЛЯЄТЬСЯ, а не лишається як 'none': інакше запис у
			// сховищі ріс би від кожного випадкового натискання, а «не перевірено»
			// і «немає запису» — це те саме.
			const rest = { ...this.marks };
			delete rest[id];
			this.marks = rest;
		} else {
			this.marks = { ...this.marks, [id]: { vote, version: this.version } };
		}
		storage.setJSON(KEY, this.marks);
	}

	voteOf(id: string): Vote {
		return this.marks[id]?.vote ?? 'none';
	}

	/**
	 * Позначка з ІНШОЇ версії. Не помилка — попередження: код з того часу
	 * змінювався, і «працює» могло перестати бути правдою.
	 */
	isStale(id: string): boolean {
		const mark = this.marks[id];
		return Boolean(mark) && mark.version !== this.version;
	}

	clear(): void {
		this.marks = {};
		storage.remove(KEY);
	}

	/** Скільком пунктам взагалі дали відповідь на ПОТОЧНІЙ версії. */
	freshCount = $derived(
		Object.values(this.marks).filter((mark) => mark.version === this.version).length
	);

	/** Скільки пунктів у чеклисті взагалі. Стала: список — це дані збірки. */
	readonly totalCount = allBetaChecks().length;
}

export const betaProgress = new BetaProgress();
