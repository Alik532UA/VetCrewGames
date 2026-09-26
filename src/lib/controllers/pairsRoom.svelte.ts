import { playerData } from '$lib/services/playerData.svelte';
import { PAIRS_DRAW_POINTS, PAIRS_WIN_POINTS } from '$lib/config/scoring';
import { layoutForViewport } from '$lib/config/memory-game';
import { PAIRS_RULES_VERSION } from '$lib/config/roomRules';
import { PairsMatch, PEEK_MS } from './pairsMatch.svelte';
import type { RoomGame } from './roomGame';

/**
 * «ЗНАЙДИ ПАРУ» ДЛЯ СЕСІЇ КІМНАТИ — рівно те, чим вона відрізняється від вікторини.
 *
 * Доти адаптер і реакції жили в маршруті, де їх не бере жоден тест (аудит
 * 2026-09-24). Тепер це модуль, і його перевіряє `pairsRoom.svelte.test.ts` на тій
 * самій кімнаті в памʼяті. Тест сесії (`roomSession.svelte.test.ts`) — на мініатюрі гри.
 */

/** Годинник для ЦИФРИ відліку в лобі: вона міняється раз на секунду. */
const CLOCK_MS = 1000;

/**
 * Годинник для СМУГИ часу ходу — те саме число, що у вікторині: на секунді смуга
 * рухалася б стрибками, на ста мілісекундах читається як час, що спливає.
 */
const TURN_CLOCK_MS = 100;

/**
 * Двоє — це сама гра, а не налаштування: дошка ділиться між двома чергами, і
 * автостарт — рівно на двох. Не з правил бази: там стеля 12 на всі ігри.
 */
export const PAIRS_PLAYERS = 2;

/** Що адаптерові треба від підсвітки наведення (`HoverBeam`). */
export interface PairsBeam {
	listen(code: string): Promise<() => void>;
	clear(): void;
}

/**
 * Новачок у вже розпочату партію заходить ГЛЯДАЧЕМ: роздача залежить від складу,
 * і гравець, що зайшов за запрошенням посеред партії, перероздав би дошку всім —
 * зібрані пари зникали (аудит 2026-09-23).
 *
 * `random` — звідки зерно нової кімнати: випадковість живе на сторінці, а не в
 * контролері (`quizSeed.test.ts`). `layout` — розкладка для НОВОЇ кімнати; у
 * тесті — стала, на сторінці — від вікна того, хто створює.
 */
export function pairsGame(
	beam: PairsBeam,
	random: () => number,
	layout: () => { pairs: number; cols: number } = layoutForViewport
): RoomGame<PairsMatch> {
	return {
		gameId: 'pairs',
		rulesVersion: PAIRS_RULES_VERSION,
		minPlayers: PAIRS_PLAYERS,
		quickSeats: PAIRS_PLAYERS,
		lateRole: 'spectator',
		autoStartReady: (players) => players === PAIRS_PLAYERS,
		newRoom: () => {
			// Розкладка належить КІМНАТІ, а не екрану того, хто створив: сітка, різна
			// на двох пристроях, дала б різні дошки з того самого зерна.
			const { pairs, cols } = layout();
			return { seed: Math.floor(random() * 2 ** 31), config: { pairs, cols } };
		},
		createMatch: (me, transport) => new PairsMatch(me, transport),
		listen: async (code) => [await beam.listen(code)],
		award: (match) => {
			if (match.iAmSpectator) return;
			if (match.iWon) playerData.awardOnline(PAIRS_WIN_POINTS);
			else if (match.drawn) playerData.awardOnline(PAIRS_DRAW_POINTS);
		},
		clockEvery: (match) =>
			match.turnEndsAt !== null ? TURN_CLOCK_MS : match.countdownAt !== null ? CLOCK_MS : null
	};
}

/** Що реакціям треба від сесії: лише поточний матч. */
export interface PairsHost {
	readonly match: PairsMatch | null;
}

/**
 * РЕАКЦІЇ, ЩО НАЛЕЖАТЬ САМЕ «ЗНАЙДИ ПАРУ». Кличе сторінка під час ініціалізації,
 * тож ефекти гаснуть разом із нею — той самий взірець, що `roomPolicies`.
 */
export function attachPairsPolicies(host: PairsHost, beam: PairsBeam): void {
	/*
	 * Пауза після невдалої пари — і тільки на пристрої того, чия черга. `$effect`, а
	 * не таймер у кліку: перегорнути треба й тоді, коли дошка чекає після
	 * перезавантаження посеред чужого ходу.
	 */
	$effect(() => {
		const match = host.match;
		if (!match?.game.awaitingPeek || !match.myTurn) return;
		const timer = setTimeout(() => void match.resolve(), PEEK_MS);
		return () => clearTimeout(timer);
	});

	/*
	 * НАВЕДЕННЯ ТРАНСЛЮЄТЬСЯ ЛИШЕ В СВОЮ ЧЕРГУ — вибір автора: «він зараз тицьне ось
	 * у цю». Умова тут, а не в контролері підсвітки: «чия черга» — правило гри.
	 */
	$effect(() => {
		if (host.match?.myTurn === false) beam.clear();
	});
}
