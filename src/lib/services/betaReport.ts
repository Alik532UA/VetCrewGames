import { BETA_TABS, type BetaCheck, type Vote } from '$lib/config/betaChecks';
import type { Mark } from '$lib/services/betaProgress.svelte';

/**
 * Звіт тестувальника — ТЕКСТ у буфер обміну, а не запис у базу.
 *
 * Так вирішено свідомо, і вибір недорогий скасувати. Збирати відповіді на сервер
 * означало б завести таблицю, правила доступу до неї й чужі імена в ній — усе це
 * заради даних, яких поки ніхто не читає. Текст, який людина вкидає в чат,
 * доходить рівно так само, а коштує нуль.
 *
 * Формат — рядки, а не JSON: звіт читає людина, і перше, що вона хоче знати, —
 * що саме НЕ працює. Тому найгірше стоїть найвище.
 */

/** Позначки в порядку розбору: спершу поламане. */
const VOTE_ORDER: Vote[] = ['fail', 'weird', 'ok'];

const VOTE_LABEL: Record<Vote, string> = {
	fail: 'НЕ ПРАЦЮЄ',
	weird: 'ПРАЦЮЄ, АЛЕ ДИВНО',
	ok: 'працює',
	none: 'не перевірено'
};

export interface ReportContext {
	/** Версія збірки, на якій перевіряли. Без неї звіт ні з чим не звірити. */
	version: string;
	/** Що саме за браузер і пристрій: половина «нічого не працює» — це саме він. */
	userAgent: string;
	language: string;
	theme: string;
	/** Час у ISO: звіт читає той, хто розбирає, а не той, хто скопіював. */
	at: string;
}

interface Line {
	vote: Vote;
	text: string;
}

/**
 * Рядок про один пункт.
 *
 * `fail` на покритому пункті позначається окремо, і це не косметика: така
 * відповідь означає, що бреше ТЕСТ, а не гра. Новина гірша за звичайний баг,
 * бо знецінює всі зелені прогони — і мусить бути видна з першого погляду.
 */
function lineFor(check: BetaCheck, mark: Mark, tabTitle: string): Line {
	const stale = mark.version;
	const suspectTest = mark.vote === 'fail' && check.coverage === 'covered';
	const parts = [
		`[${VOTE_LABEL[mark.vote]}] ${check.id} (${tabTitle})`,
		`    ${check.text.uk}`,
		`    позначено на версії ${stale}`
	];
	if (suspectTest) {
		parts.push(`    !!! ПУНКТ ПОКРИТО АВТОТЕСТОМ ${check.test} — тест не побачив цієї помилки`);
	}
	return { vote: mark.vote, text: parts.join('\n') };
}

/**
 * Текст звіту. У ньому лише ПОЗНАЧЕНІ пункти: перелік того, чого людина не
 * дивилася, нікому не потрібен і робить звіт нечитним.
 */
export function buildBetaReport(marks: Record<string, Mark>, context: ReportContext): string {
	const lines: Line[] = [];
	for (const tab of BETA_TABS) {
		for (const check of tab.checks) {
			const mark = marks[check.id];
			if (mark && mark.vote !== 'none') lines.push(lineFor(check, mark, tab.title.uk));
		}
	}

	const counts = VOTE_ORDER.map((vote) => {
		const n = lines.filter((line) => line.vote === vote).length;
		return `${VOTE_LABEL[vote]}: ${n}`;
	}).join(', ');

	const body = VOTE_ORDER.flatMap((vote) =>
		lines.filter((line) => line.vote === vote).map((line) => line.text)
	);

	return [
		'--- ЗВІТ БЕТА-ТЕСТУВАННЯ VetCrewGames ---',
		`ВЕРСІЯ: ${context.version}`,
		`ДАТА: ${context.at}`,
		`ПРИСТРІЙ: ${context.userAgent}`,
		`МОВА: ${context.language}   ТЕМА: ${context.theme}`,
		`ПОЗНАЧЕНО: ${lines.length} — ${counts}`,
		'-----------------------------------------',
		body.length ? body.join('\n') : 'Жодного пункта не позначено.',
		'',
		'Тут можна дописати словами те, чого немає в пунктах:'
	].join('\n');
}
