import { randomCrewName } from '$lib/config/crewNames';
import { NAME_KEY, initialName, rerollIfTaken } from '$lib/config/playerName';
import { crewTranslate, loadCrewNames } from '$lib/i18n/crew';
import { storage } from '$lib/services/storage';

/**
 * Підпис гравця у формі входу: значення, словник і межа «наше/людське».
 *
 * ## Чому окремий контролер, а не поля сторінки
 *
 * Це вже не одне поле. Тут зійшлися чотири речі: збережений вибір людини,
 * підставлене нами імʼя, ДОВАНТАЖУВАНИЙ словник імен (окремий чанк — див.
 * `i18n/crew/index.ts`) і перелік імен, уже зайнятих тими, хто онлайн. Розсипані
 * по сторінці, вони давали три різні місця, кожне з яких могло переписати поле, —
 * і сторінка через це двічі виходила за власну межу розміру файлу.
 *
 * ## Що тут головне
 *
 * Межа «наше/людське». Підставлене нами імʼя ми маємо право перекинути, коли
 * виявиться, що воно вже зайняте; введене людиною — ні. Помилка в цій межі не
 * падає й не видна на тесті: вона виглядає як «поле саме перескочило», і
 * побачить її лише той, хто саме друкував. Тримають її чисті функції в
 * `config/playerName.ts`, а тут — руни, сховище й завантаження.
 *
 * ## Чому джерело випадковості ПЕРЕДАЄТЬСЯ
 *
 * Той самий підпис, що в `crewNames.ts` і `pickOne`: `Math.random()` усередині
 * робить поведінку неперевірною точно, а лише ймовірно.
 */
export class PlayerName {
	/** Що стоїть у полі. Двобічне: форма прив'язується просто до нього. */
	value = $state('');

	/**
	 * Словник імен для поточної мови. Порожній, поки не приїхав чанк.
	 *
	 * До його приїзду підставляти НІЧИМ: перекладач на невідомому ключі віддає
	 * сам ключ, тобто в полі стояло б «pairs.crew.owl».
	 */
	#dict = $state<Record<string, string>>({});

	/** Що з поля підставили МИ. Порожньо — вибір людини. */
	#assigned = '';

	readonly #random: () => number;

	constructor(random: () => number) {
		this.#random = random;
	}

	/** Перекладач над уже завантаженим словником. */
	get text() {
		return crewTranslate(this.#dict);
	}

	/**
	 * Довантажити словник для мови й підставити перше імʼя. Кличеться з `$effect`
	 * сторінки, бо залежить від `settings.locale`.
	 *
	 * Перше імʼя ставиться ЛИШЕ в порожнє поле: після перемикання мови ефект
	 * перезапускається, і підпис, який людина вже бачить, мінятися не мусить —
	 * інакше вибір злітав би від дотику до перемикача мов.
	 */
	async load(locale: string, taken: readonly string[]): Promise<void> {
		this.#dict = await loadCrewNames(locale);
		if (this.value !== '') return;
		const chosen = initialName(storage.get(NAME_KEY), this.text, this.#random, taken);
		this.value = chosen.name;
		this.#assigned = chosen.assigned;
	}

	/**
	 * Кубик: інше імʼя, і воно теж НАШЕ — отже, його можна буде перекинути, коли
	 * виявиться зайнятим. Виключаються і зайняті, і поточне.
	 */
	reroll(taken: readonly string[]): void {
		this.value = randomCrewName(this.text, this.#random, [...taken, this.value.trim()]);
		this.#assigned = this.value;
	}

	/**
	 * Перелік кімнат приїхав — перекинути СВОЄ імʼя, якщо воно виявилося зайнятим.
	 *
	 * Кличеться з обробника підписки, а не з `$effect`: імʼя підставляється до
	 * приїзду переліку, а ефект, що читає й пише те саме значення, довелося б
	 * стерегти від самозапуску.
	 */
	settle(taken: readonly string[]): void {
		const swap = rerollIfTaken(this.value, this.#assigned, this.text, this.#random, taken);
		if (swap === null) return;
		this.value = swap;
		this.#assigned = swap;
	}

	/**
	 * Імʼя для входу в кімнату — і запамʼятати його.
	 *
	 * Порожнє поле означає «хай буде будь-яке»: людина стерла підставлене й не
	 * вписала свого. Вигадувати за неї нікому, тож беремо зі списку.
	 */
	forEntry(taken: readonly string[]): string {
		const who = this.value.trim() || randomCrewName(this.text, this.#random, taken);
		storage.set(NAME_KEY, who);
		return who;
	}
}
