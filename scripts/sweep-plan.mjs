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
 * СКІЛЬКИ ЖИВЕ КІМНАТА, ХАЙ ЩО (аудит 2026-09-26). Від `createdAt`, а не від тиші.
 *
 * Позначку життя (`aliveAt`) пише будь-який учасник, тож кімнату, яку тримає
 * скрипт, тиша не зносила б ніколи: коди вичерпні (публічних — одинадцять тисяч),
 * і купа «живих» порожніх кімнат забирала б їх назавжди. Дві доби — більше, ніж
 * триває будь-яка партія з друзями; реванш у тій самій кімнаті `createdAt` не
 * міняє, тож і група, що грає щодня за тим самим посиланням, через дві доби
 * створює нову кімнату. Ціна названа.
 */
export const SWEEP_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Стеля знесених КІМНАТ за прогін — КІМНАТ, У ЯКИХ ХТОСЬ Є (склад чи присутність).
 *
 * Не заради квоти — у Realtime Database операції не тарифікуються поштучно, — а
 * заради очевидності: прогін, який зніс тисячу кімнат, мусить бути помітним
 * рішенням людини, а не тихим наслідком одного зіпсованого поля. Решта піде
 * наступної доби.
 *
 * ПОРОЖНІ МЕРТВІ КІМНАТИ ЙДУТЬ УСІ (аудит 2026-09-26): у кімнаті без складу й
 * без присутності немає кого зачепити навіть зіпсованим полем, а стеля тримала б
 * засмічені коди зайнятими тижнями — по двісті на добу.
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
 *   overAge: number,
 *   empty: number,
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
 * прогону не буде.
 *
 * КІМНАТА БЕЗ ЖОДНОЇ ПОЗНАЧКИ ЧАСУ ЗНОСИТЬСЯ ПЕРШОЮ (аудит 2026-09-25). Доти
 * вона не чіпалася («видаляти те, чого не можеш датувати, — вгадування»), і саме
 * це робило коди вичерпними: `info` без `createdAt` або склад і журнал без `info`
 * тримали код зайнятим назавжди. Вгадування тут немає: жива кімната недатованою
 * не буває — створення кладе `createdAt` (і правило бази тепер цього вимагає), а
 * відкрита кімната щохвилини оновлює `aliveAt`.
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
	/** @type {DeadRoom[]} */
	const empty = [];
	let undatable = 0;
	let overAge = 0;
	const here = branch(presence);

	for (const [code, room] of Object.entries(all)) {
		const info = branch(branch(room).info);
		const lastSeen = lastSeenOf(info);
		const created = info.createdAt;
		const old = typeof created === 'number' && now - created > SWEEP_MAX_AGE_MS;
		/** @type {number | null} */
		let silence = null;
		if (lastSeen === null) {
			undatable += 1;
			silence = Number.POSITIVE_INFINITY;
		} else if (now - lastSeen > SWEEP_SILENCE_MS) silence = now - lastSeen;
		else if (old) {
			overAge += 1;
			silence = now - lastSeen;
		}
		if (silence === null) continue;
		const inhabited =
			Object.keys(branch(branch(room).members)).length > 0 ||
			Object.keys(branch(here[code])).length > 0;
		(inhabited ? dead : empty).push({ code, silence });
	}

	dead.sort((a, b) => b.silence - a.silence);
	// Порожні — усі, а стеля — лише тим, у яких хтось є (`SWEEP_LIMIT`).
	const doomed = [...empty, ...dead.slice(0, SWEEP_LIMIT)];
	const gone = new Set(doomed.map((room) => room.code));
	/** @param {string} code */
	const alive = (code) => code in all && !gone.has(code);

	const paths = doomed.map(({ code }) => `rooms/${code}`);

	/*
	 * ВКАЗІВНИК, ЖИВИЙ ЗА ВЛАСНИМ ГОДИННИКОМ, — НЕ ПРИВИД (аудит 2026-09-25).
	 * Гілки читаються одна за одною: кімната, створена після читання `rooms`, у
	 * знімку відсутня, а її свіжий запис переліку чи індексу вже є — і план зносив
	 * його як сироту. Публічні коди тут двоцифрові, тож повторюються часто. Свіжий
	 * запис лишається до наступного прогону: якщо він справді сирота, піде тоді.
	 */
	/** @param {unknown} node */
	const fresh = (node) => {
		const at = branch(node).at;
		return typeof at === 'number' && now - at <= SWEEP_SILENCE_MS;
	};

	for (const [game, entries] of Object.entries(branch(lobby))) {
		for (const [code, entry] of Object.entries(branch(entries))) {
			if (!alive(code) && !fresh(entry)) paths.push(`lobby/${game}/${code}`);
		}
	}

	for (const [code, nodes] of Object.entries(branch(presence))) {
		if (!alive(code)) {
			if (!Object.values(branch(nodes)).some(fresh)) paths.push(`presence/${code}`);
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
		for (const [code, entry] of Object.entries(branch(codes))) {
			if (!alive(code) && !fresh(entry)) paths.push(`myRooms/${uid}/${code}`);
		}
	}

	return {
		doomed,
		left: dead.length - Math.min(dead.length, SWEEP_LIMIT),
		undatable,
		overAge,
		empty: empty.length,
		total: Object.keys(all).length,
		paths
	};
}

/**
 * ШЛЯХИ, НА ЯКИХ ЗІЙШЛИСЯ ДВА ПЛАНИ — з двома читаннями `rooms`, до й після решти
 * гілок (аудит 2026-09-25).
 *
 * Прибиральник читає, планує й одним записом зносить. Кімнату, створену під тим
 * самим кодом між читанням і записом, запис знищив би разом із її переліком і
 * індексом — а публічні коди двоцифрові. Друге читання `rooms` перед записом
 * лишає вікно в секунду, а не на весь прогін: зноситься лише те, що мертве в
 * обох знімках.
 *
 * @param {SweepPlan} first
 * @param {SweepPlan} second
 * @returns {string[]}
 */
export function confirmedPaths(first, second) {
	const again = new Set(second.paths);
	return first.paths.filter((path) => again.has(path));
}
