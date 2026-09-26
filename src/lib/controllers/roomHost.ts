import { rosterOf } from '$lib/utils/roster';
import { toast } from './toast.svelte';
import type { RoomMatch, RoomSession } from './roomSession.svelte';

/**
 * ДІЇ ГОСПОДАРЯ — старт, реванш і закриття кімнати (сьомий аудит, A7-3).
 *
 * Окремо від `RoomSession` з тієї самої причини, що `roomPolicies` і `roomAvatar`: сесія
 * стояла на межі розміру контролера, а наступні правки — межа часу входу, зміна акаунта
 * в іншій вкладці — лягають саме в неї. Тут лише логіка кроку; каркас запису (перевірка,
 * транспорт, помилка вголос) — `RoomSession.hostAction`, і сесія кличе ці функції своїми
 * методами з тими самими іменами.
 */

/** Почати партію. `auto` — це відлік, а не людина: невдача зупиняє автоматику. */
export async function hostStart<M extends RoomMatch>(
	session: RoomSession<M>,
	auto = false
): Promise<void> {
	const match = session.match;
	// Партія вже йде (друга вкладка господаря встигла першою): дубль старту база
	// відкидає цілком (A2), тож і писати його нема чого.
	if (!match || match.status === 'playing' || (auto && session.autoHalted)) return;
	if (!session.canStart) {
		toast.info('pairs.needPlayers');
		return;
	}
	// Склад заморожується тим самим записом, що й старт (`RoomInfo.roster`).
	const config = session.game.startConfig?.(match.members, session.online);
	const started = await session.hostAction((transport) =>
		transport.setStatus('playing', rosterOf(session.presentPlayers), config)
	);
	if (!started) {
		// Відмову дубля (партію почала інша вкладка) зупинкою автоматики не рахуємо.
		if (auto && session.match?.status !== 'playing') session.autoHalted = true;
		return;
	}
	// Партія, що вже йде, у переліку обіцяла б гру, а давала роль глядача. Лише
	// ПІСЛЯ старту: доти невдалий старт ще й прибирав кімнату з переліку.
	session.lobby.unpublish();
}

/** Закрити кімнату — ЯВНОЮ дією: «пішов назовсім» від «перезавантажив» не відрізнити. */
export async function hostClose<M extends RoomMatch>(session: RoomSession<M>): Promise<void> {
	if (!session.match || !session.amHost) return;
	// Спершу з переліку: навпаки був би рядок кімнати, якої вже немає.
	session.lobby.unpublish();
	await session.act('room not closed', async () => {
		await session.net.closeRoom(session.code);
		await session.place.exit();
	});
}

/**
 * Реванш — з тими, хто в кімнаті й на звʼязку ЗАРАЗ, і лише коли їх досить.
 *
 * Доти мінімуму тут не перевіряв ніхто: господар, від якого пішов суперник,
 * перезапускав партію сам із собою — «вигравав» її й отримував бали за
 * перемогу на кожному реванші, бо разовість нагороди тримається на зерні, а
 * зерно в реванша нове (аудит 2026-09-24).
 *
 * Зерно реваншу — з тієї самої дороги, що й зерно нової кімнати: випадковість
 * живе на сторінці, а не в контролері (`quizSeed.test.ts`).
 */
export async function hostRematch<M extends RoomMatch>(session: RoomSession<M>): Promise<void> {
	if (!session.canStart) {
		toast.info('pairs.needPlayers');
		return;
	}
	const match = session.match;
	await session.hostAction((transport) =>
		transport.restart(
			(match && session.game.rematchSeed?.(match)) ?? session.game.newRoom().seed,
			rosterOf(session.presentPlayers),
			session.game.startConfig?.(match?.members ?? [], session.online)
		)
	);
}
