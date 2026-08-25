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

/** Скільки СЕКУНД ще чекаємо. Нуль — пільговий час вичерпано. */
export function awaySecondsLeft(
	missing: readonly Member[],
	since: Record<string, number>,
	now: number
): number {
	const stamps = missing.map((member) => since[member.uid] ?? now);
	if (stamps.length === 0) return 0;
	return Math.max(0, Math.ceil((Math.max(...stamps) + AWAY_GRACE_MS - now) / 1000));
}

/**
 * ЧИ ЧЕКАЄ ПАРТІЯ САМЕ ЗАРАЗ — три умови, і всі три обов'язкові.
 *
 *  1. когось немає онлайн;
 *  2. пільговий час ще не вичерпано — за його межею вікно вже каже «граємо далі»,
 *     і чекати нема на що;
 *  3. зниклий ще НЕ відповів у цьому раунді — якщо відповів, його відсутність
 *     раунду не тримає, і зупиняти час означало б дарувати його присутнім.
 *
 * Третя умова — та, через яку пауза не стає способом виграти час: зниклий, що вже
 * відповів, нічого не затримує.
 */
export function shouldHoldRound(
	missing: readonly Member[],
	answered: readonly string[],
	secondsLeft: number
): boolean {
	if (missing.length === 0 || secondsLeft <= 0) return false;
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
