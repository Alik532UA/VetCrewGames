import type { Member } from '$lib/net/roomTypes';

/**
 * ПРАВИЛА ОЧІКУВАННЯ ЗНИКЛОГО: скільки ще чекаємо і чи стоїть партія.
 *
 * ## Навіщо окремий модуль
 *
 * Сторінка кімнати стоїть на межі розміру (400 рядків), а ці два правила до
 * розмітки не мають стосунку зовсім. Обидва — ЧИСТІ ФУНКЦІЇ від «кого немає»,
 * «хто відповів» і часу, тобто їх можна перевірити в `npm test` без браузера, чого
 * в компоненті не зробити: там вони живуть у похідних над станом присутності.
 *
 * ## Пільговий час
 *
 * За НАЙПІЗНІШИМ зникненням, а не за найранішим: інакше поява другого зниклого не
 * подовжила б відлік, і вікно сказало б «більше не чекають» про того, хто зник
 * секунду тому.
 */
export const AWAY_GRACE_MS = 15000;

/**
 * Найменша пільга, яку лишаємо навіть тому, хто вже все витратив.
 *
 * Три секунди — не поступка зловживанню, а захист від протилежного: у гравця з
 * поганим звʼязком, що відпадає по дві секунди, пільга скінчилася б за пʼять
 * разів, і далі його виключали б МИТТЮ. Три секунди дають шанс на кожне
 * зникнення, але не дають чекати нескінченно.
 */
export const AWAY_GRACE_FLOOR_MS = 3000;

/**
 * Скільки СЕКУНД ще чекаємо. Нуль — пільговий час вичерпано.
 *
 * ПІЛЬГА НАКОПИЧУВАЛЬНА: `spent` — це те, що гравець уже витратив за партію, і
 * відлік починається з решти. Автор описав дефект точно: «можна відключатися на
 * 14 секунд і повертатися, і знову буде таймер на 15 секунд». Так і було —
 * позначка зникнення скидалася разом із поверненням, тобто повний відлік
 * повертався щоразу.
 */
export function awaySecondsLeft(
	missing: readonly Member[],
	since: Record<string, number>,
	now: number,
	spent: (uid: string) => number = () => 0
): number {
	if (missing.length === 0) return 0;

	/*
	 * За НАЙПІЗНІШИМ зникненням, і в кожного своя решта пільги: чекаємо доти, доки
	 * чекає хоч один. Інакше поява другого зниклого не подовжила б відлік.
	 */
	const ends = missing.map((member) => {
		const left = Math.max(AWAY_GRACE_FLOOR_MS, AWAY_GRACE_MS - spent(member.uid));
		return (since[member.uid] ?? now) + left;
	});
	return Math.max(0, Math.ceil((Math.max(...ends) - now) / 1000));
}

/**
 * СКІЛЬКИ ГОЛОСІВ ПОТРІБНО, щоб не чекати далі: більшість ПРИСУТНІХ.
 *
 * Присутніх, а не всіх: зниклі не голосують за визначенням, і вимагати їхніх
 * голосів означало б вимагати одностайності від решти. Троє з чотирьох на місці —
 * потрібно два.
 *
 * Один присутній — один голос, і це не помилка округлення: коли решта пішла,
 * рішення нема з кем ділити. Слово «більшість» у цьому випадку нічого не обіцяє
 * зверх того, що є.
 */
export const votesNeeded = (presentCount: number): number =>
	Math.max(1, Math.floor(presentCount / 2) + 1);

/** Чи вже досить голосів «граємо далі». */
export const goOnDecided = (votes: readonly string[], presentCount: number): boolean =>
	votes.length >= votesNeeded(presentCount);

/**
 * ЧИ ЧЕКАЄ ПАРТІЯ САМЕ ЗАРАЗ.
 *
 * Три умови, і жодна не є таймером:
 *
 *  1. когось немає онлайн;
 *  2. зниклий ще НЕ відповів у цьому раунді — якщо відповів, його відсутність
 *     раунду не тримає, і зупиняти час означало б дарувати його присутнім;
 *  3. присутні ще не вирішили грати далі.
 *
 * ПІЛЬГОВИЙ ЧАС БІЛЬШЕ НЕ ЗНІМАЄ ПАУЗУ, і це вимога автора: «після таймеру
 * автоматично НЕ зникає вікно і не продовжується гра, а кнопка розблоковується».
 * Причина в житті: гравець перезавантажує комп'ютер, і 15 секунд на це не хватає
 * нікому — а рішення чекати чи ні належить тим, хто грає, не таймеру.
 *
 * Ціна названа прямо: якщо ніхто з присутніх не натисне кнопку, партія стоятиме
 * доти, доки хтось не повернеться або не натисне. Стелі немає за рішенням автора;
 * покинуту кімнату прибирає щоденний прибиральник.
 */
export function shouldHoldRound(
	missing: readonly Member[],
	answered: readonly string[],
	votes: readonly string[],
	presentCount: number,
	pausedBy: string | null = null
): boolean {
	/*
	 * ПАУЗА ТРИМАЄ РАУНД БЕЗЗАСТЕРЕЖНО, і це головна різниця з зникненням.
	 *
	 * Зникнення можна не чекати: якщо зниклий уже відповів, він нічого не тримає.
	 * Паузу поставили НАВМИСНО — і зняти її може або той, хто ставив, або
	 * голосування присутніх. Інакше кнопка «пауза» була б пропозицією, а не дією.
	 */
	if (pausedBy !== null) return !goOnDecided(votes, presentCount);

	if (missing.length === 0) return false;
	if (goOnDecided(votes, presentCount)) return false;
	return missing.some((member) => !answered.includes(member.uid));
}

/**
 * Мить зникнення для кожного, кого немає.
 *
 * Із самого переліку її не вивести: він каже, КОГО немає, а не відколи. Тому
 * попередній знімок передається сюди — той, хто зник раніше, зберігає свою мітку.
 */
export function awayStamps(
	players: readonly Member[],
	presentUids: readonly string[],
	previous: Record<string, number>,
	now: number
): Record<string, number> {
	const next: Record<string, number> = {};
	for (const member of players) {
		if (presentUids.includes(member.uid)) continue;
		next[member.uid] = previous[member.uid] ?? now;
	}
	return next;
}

/**
 * Скільки СЕКУНД лишилося з паузи, поставленої навмисно.
 *
 * Той самий запас, що в зникнення (вимога автора: одна межа на два стани), і та
 * сама підлога. Нуль означає рівно те, що й там: решта може зняти паузу — але
 * НЕ те, що пауза скінчилася сама. Паузу знімає людина або голос.
 */
export function pauseSecondsLeft(pausedAt: number, spent: number, now: number): number {
	const left = Math.max(AWAY_GRACE_FLOOR_MS, AWAY_GRACE_MS - spent);
	return Math.max(0, Math.ceil((pausedAt + left - now) / 1000));
}

/** Те, що вміє матч і потрібно чеканню. Інтерфейс, а не клас: тут немає мережі. */
export interface WaitSource {
	away: readonly Member[];
	answered: readonly string[];
	goOn: readonly string[];
	present: readonly string[];
	players: readonly Member[];
	pausedBy: string | null;
	pausedAt: number;
	graceSpent(uid: string): number;
	pauseReadyAt(uid: string): number;
}

/** Усе, що екран показує про чекання. Одна відповідь замість семи похідних. */
export interface WaitView {
	hold: boolean;
	needed: number;
	/** Скільки секунд показувати: пільга зникнення або відлік паузи. */
	left: number;
	pausedBy: Member | null;
	canPause: boolean;
}

/**
 * ЗІБРАТИ СТАН ЧЕКАННЯ — і зібрати його ТУТ, а не на сторінці.
 *
 * Сторінка кімнати стоїть на межі розміру (400 рядків), а це не розмітка й не
 * мережа: це ті самі правила, що вище, лише прикладені до полів матчу. Заразом
 * вони перестають залежати від того, чи матч уже існує: `null` означає «чекати
 * нема на що».
 *
 * Пауза й зникнення дають ОДИН відлік навмисно: на екрані це одне вікно з однією
 * межею, і два різні числа в ньому читалися б як випадковість.
 */
export function waitView(
	match: WaitSource | null,
	since: Record<string, number>,
	now: number,
	me: string
): WaitView {
	if (!match) return { hold: false, needed: 1, left: 0, pausedBy: null, canPause: false };

	const present = Math.max(1, match.present.length);
	const paused = match.pausedBy;

	return {
		hold: shouldHoldRound(match.away, match.answered, match.goOn, present, paused),
		needed: votesNeeded(present),
		left:
			paused === null
				? awaySecondsLeft(match.away, since, now, (uid) => match.graceSpent(uid))
				: pauseSecondsLeft(match.pausedAt, match.graceSpent(paused), now),
		pausedBy: paused === null ? null : (match.players.find((p) => p.uid === paused) ?? null),
		canPause: paused === null && now >= match.pauseReadyAt(me)
	};
}
