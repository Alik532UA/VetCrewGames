import type { Member } from '$lib/net/roomTypes';

/**
 * МІСЦЕ — ЗА РАХУНКОМ, А НЕ ЗА НОМЕРОМ РЯДКА (прохання автора 2026-09-26).
 *
 * Доти місцем був номер рядка: двоє з 277 очками стояли першим і другим, і
 * другий «програвав» не очками, а тим, що зайшов у кімнату пізніше. Тепер рівні
 * бали ділять одне місце, а наступний іде через них — як у спорті: 1, 1, 3.
 * Автор вибрав це з двох варіантів; щільну нумерацію («1, 1, 2») відкинуто.
 *
 * Порядок РЯДКІВ серед рівних лишається стабільним — за входом (`order`): `sort`
 * не обіцяє стабільності, і рядки з однаковим рахунком інакше мінялися б місцями
 * від перемалювання до перемалювання. Номер місця від цього порядку не залежить.
 */

/** Склад за рахунком: більший вище, рівних розводить порядок входу. */
export function rankedBy(players: readonly Member[], score: (uid: string) => number): Member[] {
	return [...players].sort((a, b) => score(b.uid) - score(a.uid) || a.order - b.order);
}

/** Місце кожного: один плюс скільки гравців має СТРОГО більше. */
export function placesOf(
	players: readonly Member[],
	score: (uid: string) => number
): Record<string, number> {
	const points = players.map((player) => score(player.uid));
	return Object.fromEntries(
		players.map((player, index) => [
			player.uid,
			1 + points.filter((other) => other > points[index]).length
		])
	);
}
