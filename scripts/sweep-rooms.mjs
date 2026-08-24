import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * ПРИБИРАЛЬНИК ПОКИНУТИХ КІМНАТ — раз на добу, у GitHub Actions.
 *
 * ## Навіщо він узагалі
 *
 * Кімната, яку покинули після початку партії, не зникає сама: `onDisconnect`
 * скасовується на старті (обрив звʼязку посеред гри не має нищити партію), а
 * зачистка чужого з клієнта неможлива — щоб прибирати чуже, потрібне право
 * видаляти чуже, тобто готовий примітив «видалити всі кімнати». Тому лишалося
 * рівно те, що покинув господар, який більше ніколи не створить кімнати; це
 * записано боргом у `PROJECT-CONTEXT.md`.
 *
 * ## Чому GitHub Actions, а не Cloud Functions
 *
 * Борг називав розвʼязком «заплановане завдання на боці провайдера» й додавав:
 * вимагає тарифу Blaze. Але провайдером РОЗКЛАДУ не мусить бути Google.
 * Репозиторій публічний, тобто хвилини Actions безлімітні, а сервісний акаунт для
 * викладання правил у секретах уже є — нового не додається нічого.
 *
 * ## Чому не TTL
 *
 * У Realtime Database його немає. Він є у Firestore (у сусідньому `MindStep` саме
 * так і треба), але переїзд бази заради кнопки, яка все одно видаляє «протягом
 * доби», коштував би переписування транспорту, правил і гейтів.
 *
 * ## Що саме вважається покинутим
 *
 * Тиша понад `SWEEP_SILENCE_MS` за СЕРВЕРНОЮ позначкою: `info.aliveAt` (її
 * оновлює кожен, хто тримає кімнату відкритою), а для кімнат зі старіших збірок —
 * `startedAt`/`createdAt`. Кімната, у якої немає жодної позначки часу, НЕ
 * чіпається: датувати її нічим, а видаляти те, чого не можеш датувати, — це
 * вгадування.
 *
 * Поріг навмисно грубий: на екрані кімната зникає вже після п'яти хвилин тиші
 * (`config/roomLife.ts`), тож тут ідеться не про те, що бачить людина, а про те,
 * що лежить у базі.
 */

const PROJECT = 'vet-crew-games';

/** Скільки тиші означає «сюди більше ніхто не вернеться». */
const SWEEP_SILENCE_MS = 6 * 60 * 60 * 1000;

/**
 * Стеля видалень за прогін.
 *
 * Не заради квоти — у Realtime Database операції не тарифікуються поштучно, — а
 * заради очевидності: прогін, який зніс тисячу кімнат, мусить бути помітним
 * рішенням людини, а не тихим наслідком одного зіпсованого поля. Решта піде
 * наступної доби.
 */
const SWEEP_LIMIT = 200;

/** Виклик `firebase-tools` тією самою обгорткою, що й решта скриптів. */
function firebase(args) {
	const result = spawnSync(
		process.execPath,
		[join('scripts', 'firebase-cli.mjs'), ...args, '--project', PROJECT],
		{ encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }
	);
	if (result.status !== 0) {
		throw new Error(`firebase ${args[0]} завершився з кодом ${result.status}`);
	}
	return result.stdout;
}

/**
 * Найпізніша серверна позначка кімнати. `null` — датувати нічим.
 *
 * Порядок не важливий: беремо максимум, бо будь-яка з них означає «тут щось
 * відбувалося», а найпізніша й є остання ознака життя.
 */
function lastSeenOf(info) {
	const stamps = [info?.aliveAt, info?.startedAt, info?.createdAt].filter(
		(value) => typeof value === 'number' && Number.isFinite(value)
	);
	return stamps.length > 0 ? Math.max(...stamps) : null;
}

const temp = mkdtempSync(join(tmpdir(), 'vcg-sweep-'));
try {
	const dump = join(temp, 'rooms.json');
	firebase(['database:get', '/rooms', '--output', dump]);

	const raw = readFileSync(dump, 'utf8').trim();
	const rooms = raw === '' || raw === 'null' ? {} : JSON.parse(raw);
	const codes = Object.keys(rooms ?? {});
	const now = Date.now();

	const dead = [];
	let undatable = 0;

	for (const code of codes) {
		const lastSeen = lastSeenOf(rooms[code]?.info);
		if (lastSeen === null) {
			undatable += 1;
			continue;
		}
		if (now - lastSeen > SWEEP_SILENCE_MS) dead.push({ code, silence: now - lastSeen });
	}

	dead.sort((a, b) => b.silence - a.silence);
	const doomed = dead.slice(0, SWEEP_LIMIT);

	console.log(
		`sweep-rooms: кімнат ${codes.length}, покинутих ${dead.length}, ` +
			`без позначки часу ${undatable}, зносимо ${doomed.length}`
	);

	for (const { code, silence } of doomed) {
		firebase(['database:remove', `/rooms/${code}`, '--force']);
		console.log(`  знесено ${code} — тиша ${Math.round(silence / 3600000)} год`);
	}

	// Обрізка НАЗИВАЄТЬСЯ ВГОЛОС: мовчазна межа читалася б як «прибрано все».
	if (dead.length > doomed.length) {
		console.log(`sweep-rooms: за межею прогону лишилося ${dead.length - doomed.length}`);
	}
} finally {
	rmSync(temp, { recursive: true, force: true });
}
