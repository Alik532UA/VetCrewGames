import type { Member } from '$lib/net/roomTypes';
import { votesNeeded } from './awayWait';

/**
 * «ГРАТИ ДАЛІ» ДЛЯ ТОГО, ХТО НА ЗВʼЯЗКУ, АЛЕ НЕ ВІДПОВІДАЄ (рішення автора 2026-09-27, 5-B:
 * «після прихованого ліміту показати решті „Грати далі“, як у вікні очікування, з
 * поясненням, що певний гравець чи список гравців не вибрали варіант»).
 *
 * Раунд «Не обмежений» чекає, поки відповідять усі, кого чекають, — а чекають присутніх.
 * Хто на звʼязку, але не відповідає, тримав такий раунд вічно: вікно очікування
 * відкривається лише для зниклих (`awayWait.ts`), і решті не було чим рухати партію далі.
 * Тепер, щойно минула прихована межа (`scoreLimitFor`), ті, хто вже відповів, бачать тих,
 * хто ще думає, і можуть проголосувати не чекати їх.
 *
 * ГОЛОС ОКРЕМИЙ ВІД «ГРАТИ ДАЛІ» ЗНИКЛИХ (`nowait`, а не `goon`). Спільний голос означав
 * би, що рішення «не чекати того, хто зник» на початку раунду мовчки скидало б і того,
 * хто ще думає, — а це два різні питання.
 *
 * ВИРІШУЮТЬ ТІ, ХТО ВЖЕ ВІДПОВІВ, — більшістю, як і у вікні очікування. Той, на кого
 * чекають, не голосує: питання саме про нього. Інакше вдвох рішення не набралося б
 * ніколи — один відповів, другого чекаємо, а більшість від двох — два голоси.
 */

/** Хто з тих, кого чекають, уже відповів: лише вони й вирішують. */
function votersOf(waiting: readonly Member[], answered: readonly string[]): Set<string> {
	return new Set(waiting.map((player) => player.uid).filter((uid) => answered.includes(uid)));
}

/** Чи вирішили ті, хто відповів, більше не чекати тих, хто ще думає. */
export function noWaitDecided(
	votes: readonly string[],
	waiting: readonly Member[],
	answered: readonly string[]
): boolean {
	const voters = votersOf(waiting, answered);
	const counted = votes.filter((uid) => voters.has(uid)).length;
	return voters.size > 0 && counted >= votesNeeded(voters.size);
}

/**
 * КОГО ЧЕКАЄ ПАРТІЯ — присутніх зі складу, без тих, на кого вирішили не чекати.
 *
 * Дві порожнечі означають «чекаємо всіх», і обидві — навмисно (`QuizMatch.awaited`):
 * присутність, яка ще не приїхала, і кімната, у якій за мить не стало нікого. Інакше
 * раунд закінчувався б сам собою на порожньому списку.
 */
export function awaitedOf(
	staying: readonly Member[],
	present: readonly string[],
	answered: readonly string[],
	noWait: readonly string[]
): Member[] {
	if (present.length === 0) return [...staying];
	const here = staying.filter((player) => present.includes(player.uid));
	const waiting = here.length > 0 ? here : [...staying];
	if (!noWaitDecided(noWait, waiting, answered)) return waiting;
	return waiting.filter((player) => answered.includes(player.uid));
}

/** Те, що вміє матч і потрібно цьому вікну. Інтерфейс, а не клас: тут немає мережі. */
export interface IdleSource {
	/** Поточний раунд; `-1` — його ще немає. */
	round: number;
	/** Раунд без межі: лише там кімната чекає, скільки б не минуло. */
	unlimited: boolean;
	/** Коли минає прихована межа поточного раунду, з паузами; `Infinity` — не відомо. */
	patienceAt: number;
	/** Кого партія ще чекає (`awaitedOf`). */
	awaited: readonly Member[];
	answered: readonly string[];
	noWait: readonly string[];
}

/** Усе, що екран показує про тих, хто думає. */
export interface IdleView {
	show: boolean;
	/** Хто ще не вибрав відповідь. */
	idle: Member[];
	voted: number;
	needed: number;
	iVoted: boolean;
}

const HIDDEN: IdleView = { show: false, idle: [], voted: 0, needed: 1, iVoted: false };

/**
 * ЗІБРАТИ ВІКНО «ЩЕ НЕ ВИБРАЛИ ВІДПОВІДЬ» — для того, хто вже відповів.
 *
 * Лише в раунді без межі й лише після прихованої межі: до неї чекати — і є правило
 * режиму. Той, хто думає, вікна не бачить: його дошка відкрита, і він може відповісти
 * будь-якої миті, аж до рішення.
 */
export function idleView(match: IdleSource | null, now: number, me: string): IdleView {
	if (!match || !match.unlimited || match.round < 0) return HIDDEN;
	if (!match.answered.includes(me) || now < match.patienceAt) return HIDDEN;
	const idle = match.awaited.filter((player) => !match.answered.includes(player.uid));
	if (idle.length === 0) return HIDDEN;
	const voters = votersOf(match.awaited, match.answered);
	return {
		show: true,
		idle,
		voted: match.noWait.filter((uid) => voters.has(uid)).length,
		needed: votesNeeded(voters.size),
		iVoted: match.noWait.includes(me)
	};
}
