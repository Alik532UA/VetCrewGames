/**
 * ЩО ЗНОСИТЬ ПРИБИРАЛЬНИК — чиста функція від знімків гілок бази.
 *
 * Окремо від `sweep-rooms.mjs`, бо там — лише введення й виведення (`firebase`
 * CLI проти живого проєкту), а рішення «що саме зносити» перевіряється без бази
 * й без ключів (`src/sweep-plan.test.ts`). Доти рішення жило всередині скрипта,
 * який можна запустити тільки проти продакшну, — тобто не перевірялося ніяк.
 *
 * ## Не лише кімнати (аудит 2026-09-24)
 *
 * Доти зносився тільки `rooms/{code}`, а поруч лишалося назавжди: запис у
 * переліку (`lobby/{гра}/{code}`) — привид у списку й у «швидкій грі»;
 * присутність (`presence/{code}`); індекс своїх кімнат (`myRooms/{uid}/{code}`),
 * що кликав у кімнату, якої немає. Тепер усе, що вказує на кімнату, якої вже
 * немає, іде разом із нею.
 *
 * І ПРИВИДИ присутності в живих кімнатах: вузол, що лишився без `onDisconnect`
 * (обрив посеред запису в старій збірці), тримав «господаря на звʼязку» назавжди.
 * Вузол, старший за тишу, зноситься; справжня вкладка поставить свій знову сама
 * (`keepNode` у `net/presence.ts` стежить за своїм вузлом).
 */

/** Скільки тиші означає «сюди більше ніхто не вернеться». */
export const SWEEP_SILENCE_MS = 6 * 60 * 60 * 1000;

/**
 * Стеля знесених КІМНАТ за прогін.
 *
 * Не заради квоти — у Realtime Database операції не тарифікуються поштучно, — а
 * заради очевидності: прогін, який зніс тисячу кімнат, мусить бути помітним
 * рішенням людини, а не тихим наслідком одного зіпсованого поля. Решта піде
 * наступної доби.
 */
export const SWEEP_LIMIT = 200;

/**
 * Найпізніша серверна позначка кімнати. `null` — датувати нічим.
 *
 * Порядок не важливий: беремо максимум, бо будь-яка з них означає «тут щось
 * відбувалося», а найпізніша й є остання ознака життя.
 *
 * @param {unknown} info
 * @returns {number | null}
 */
export function lastSeenOf(info) {
	const record = /** @type {Record<string, unknown> | null} */ (
		typeof info === 'object' && info !== null ? info : null
	);
	const stamps = [record?.aliveAt, record?.startedAt, record?.createdAt].filter(
		(value) => typeof value === 'number' && Number.isFinite(value)
	);
	return stamps.length > 0 ? Math.max(.../** @type {number[]} */ (stamps)) : null;
}

/**
 * @typedef {Record<string, unknown> | null | undefined} Branch
 * @typedef {{ code: string, silence: number }} DeadRoom
 * @typedef {{
 *   rooms: Branch,
 *   lobby: Branch,
 *   presence: Branch,
 *   myRooms: Branch,
 *   now: number
 * }} SweepInput
 * @typedef {{
 *   doomed: DeadRoom[],
 *   left: number,
 *   undatable: number,
 *   total: number,
 *   paths: string[]
 * }} SweepPlan
 */

/** @param {unknown} value @returns {Record<string, unknown>} */
const branch = (value) =>
	/** @type {Record<string, unknown>} */ (typeof value === 'object' && value !== null ? value : {});

/**
 * Що знести цим прогоном: кімнати з тишею понад `SWEEP_SILENCE_MS` (не більше
 * `SWEEP_LIMIT`, найтихіші першими) і все, що вказує на кімнату, якої після
 * прогону не буде. Кімната без жодної позначки часу НЕ чіпається: датувати її
 * нічим, а видаляти те, чого не можеш датувати, — це вгадування.
 *
 * Мертва кімната поза межею прогону лишається «живою» й для решти гілок: її
 * запис переліку й присутність підуть разом із нею наступної доби.
 *
 * @param {SweepInput} input
 * @returns {SweepPlan}
 */
export function planSweep({ rooms, lobby, presence, myRooms, now }) {
	const all = branch(rooms);
	/** @type {DeadRoom[]} */
	const dead = [];
	let undatable = 0;

	for (const [code, room] of Object.entries(all)) {
		const lastSeen = lastSeenOf(branch(room).info);
		if (lastSeen === null) {
			undatable += 1;
			continue;
		}
		if (now - lastSeen > SWEEP_SILENCE_MS) dead.push({ code, silence: now - lastSeen });
	}

	dead.sort((a, b) => b.silence - a.silence);
	const doomed = dead.slice(0, SWEEP_LIMIT);
	const gone = new Set(doomed.map((room) => room.code));
	/** @param {string} code */
	const alive = (code) => code in all && !gone.has(code);

	const paths = doomed.map(({ code }) => `rooms/${code}`);

	for (const [game, entries] of Object.entries(branch(lobby))) {
		for (const code of Object.keys(branch(entries))) {
			if (!alive(code)) paths.push(`lobby/${game}/${code}`);
		}
	}

	for (const [code, nodes] of Object.entries(branch(presence))) {
		if (!alive(code)) {
			paths.push(`presence/${code}`);
			continue;
		}
		for (const [uid, node] of Object.entries(branch(nodes))) {
			const at = branch(node).at;
			if (typeof at === 'number' && now - at > SWEEP_SILENCE_MS) {
				paths.push(`presence/${code}/${uid}`);
			}
		}
	}

	for (const [uid, codes] of Object.entries(branch(myRooms))) {
		for (const code of Object.keys(branch(codes))) {
			if (!alive(code)) paths.push(`myRooms/${uid}/${code}`);
		}
	}

	return {
		doomed,
		left: dead.length - doomed.length,
		undatable,
		total: Object.keys(all).length,
		paths
	};
}
