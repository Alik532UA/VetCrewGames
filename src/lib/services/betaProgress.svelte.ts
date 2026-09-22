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

const VOTES: readonly Vote[] = ['fail', 'weird', 'ok'];

function isMark(value: unknown): value is Mark {
	if (typeof value !== 'object' || value === null) return false;
	const m = value as Record<string, unknown>;
	return VOTES.includes(m.vote as Vote) && typeof m.version === 'string';
}

/**
 * Прочитане зі сховища — НЕДОВІРЕНИЙ ВВІД (BETA-CHECKLIST-v9 § 8.6).
 *
 * Ключ переживає і зміну чеклиста, і зміну формату позначки. Найчастіший
 * випадок безневинний і найгірший: пункт ПРИБРАЛИ зі списку, а позначка
 * лишилася — вона далі рахувалася б у `freshCount`, і поступ показував би
 * «172 / 169», число, яке не означає нічого й не має де виправитися. При 169
 * пунктах і одинадцятьох вкладках такий дрейф непомітний доти, доки не стане
 * абсурдним.
 */
function readMarks(): Record<string, Mark> {
	const raw = storage.getJSON<unknown>(KEY);
	if (typeof raw !== 'object' || raw === null) return {};

	const known = new Set(allBetaChecks().map((check) => check.id));
	const out: Record<string, Mark> = {};
	for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
		if (known.has(id) && isMark(value)) out[id] = value;
	}
	return out;
}

class BetaProgress {
	/** `id` пункта → позначка. Пункти без позначки в сховищі просто відсутні. */
	marks = $state<Record<string, Mark>>({});

	/** Версія, на якій зараз працює сторінка. Порівнюється з версією позначки. */
	readonly version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown';

	/**
	 * Чи зведена кнопка стирання (§ 6.3).
	 *
	 * «Стерти позначки» — єдина незворотна дія на сторінці, і вона стоїть у тому
	 * самому рядку, що й «скопіювати звіт», до якого тягнуться щоразу. При 169
	 * пунктах ціна помилки тут — вечір роботи проти одного зайвого кліка.
	 *
	 * Не `confirm()`: нативний діалог блокує потік, не перекладається,
	 * виглядає чужим у будь-якій темі й у headless вимагає окремого обробника.
	 */
	clearArmed = $state(false);

	constructor() {
		this.marks = readMarks();
	}

	/**
	 * Поставити стан. Повторне натискання того самого — знімає (§ 3.3).
	 *
	 * РІШЕННЯ ПРО ЗНЯТТЯ ЖИВЕ ТУТ, А НЕ В РОЗМІТЦІ. Доти рядок чеклиста сам
	 * рахував `mine === vote ? 'none' : vote`, а `mine` приходив із `voteOf()`,
	 * який версії не дивиться. Тобто на позначці З ІНШОЇ ЗБІРКИ повторне
	 * натискання того самого стану її СТИРАЛО: людина, яка прийшла на новій
	 * версії підтвердити торішнє «працює», натомість його втрачала. Умова
	 * `version === this.version` у каноні названа недекоративною прямим текстом
	 * (§ 3.3, `BETA-VOTE-UNDO`), і саме її в цьому місці не було.
	 *
	 * `'none'` лишається явним зняттям — його кличе код, який ЗНАЄ, що хоче
	 * стерти, а не вгадує це з поточного стану.
	 */
	vote(id: string, vote: Vote): void {
		const current = this.marks[id];
		const undo = vote === 'none' || (current?.vote === vote && current.version === this.version);

		if (undo) {
			// Знята позначка ВИДАЛЯЄТЬСЯ, а не лишається як 'none': інакше запис у
			// сховищі ріс би від кожного випадкового натискання, а «не перевірено»
			// і «немає запису» — це те саме.
			const rest = { ...this.marks };
			delete rest[id];
			this.marks = rest;
		} else {
			this.marks = { ...this.marks, [id]: { vote, version: this.version } };
		}
		storage.setJSON(KEY, $state.snapshot(this.marks));
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

	/**
	 * Стирання у два кроки (§ 6.3): перший виклик лише зводить кнопку, другий
	 * стирає. Повертає `true`, коли позначки справді зникли.
	 */
	requestClear(): boolean {
		if (!this.clearArmed) {
			this.clearArmed = true;
			return false;
		}
		this.clear();
		return true;
	}

	/** Знімає зведення, нічого не стираючи: кнопка не лишається зарядженою. */
	disarmClear(): void {
		this.clearArmed = false;
	}

	clear(): void {
		this.marks = {};
		this.clearArmed = false;
		storage.remove(KEY);
	}

	/** Скільком пунктам взагалі дали відповідь на ПОТОЧНІЙ версії. */
	freshCount = $derived(
		Object.values(this.marks).filter((mark) => mark.version === this.version).length
	);

	/**
	 * Поступ ОКРЕМОЇ вкладки (§ 8.1, `BETA-TAB-PROGRESS`).
	 *
	 * Загальне «17 / 169» не відповідає на єдине питання, яке тестувальник собі
	 * ставить: чи закінчена ця вкладка. Вкладок тут одинадцять, а в найбільшій —
	 * 33 пункти, тобто без лічильника позицію доводиться тримати в голові.
	 */
	progressOf(tab: { checks: readonly { id: string }[] }): { done: number; total: number } {
		const done = tab.checks.filter(
			(check) => this.marks[check.id]?.version === this.version
		).length;
		return { done, total: tab.checks.length };
	}

	/** Скільки пунктів у чеклисті взагалі. Стала: список — це дані збірки. */
	readonly totalCount = allBetaChecks().length;
}

export const betaProgress = new BetaProgress();
