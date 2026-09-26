import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	SWEEP_LIMIT,
	SWEEP_MAX_AGE_MS,
	SWEEP_SILENCE_MS,
	confirmedPaths,
	planSweep
} from './sweep-plan.mjs';

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
 * `startedAt`/`createdAt`. Кімната без жодної позначки часу зноситься першою
 * (з 2026-09-26): жива такою не буває, а доти такі кімнати тримали коди
 * зайнятими назавжди — подробиці в `sweep-plan.mjs`.
 *
 * Поріг навмисно грубий: на екрані кімната зникає вже після п'яти хвилин тиші
 * (`config/roomLife.ts`), тож тут ідеться не про те, що бачить людина, а про те,
 * що лежить у базі.
 *
 * ## Що саме зноситься — у `sweep-plan.mjs`
 *
 * Разом із кімнатою — перелік, присутність і індекс своїх кімнат, що на неї
 * вказують, і привиди присутності в живих кімнатах. Рішення — чиста функція, і
 * перевіряється вона без бази (`src/sweep-plan.test.ts`); тут лише читання,
 * один запис і звіт.
 *
 * `SWEEP_PROJECT` — лише для перевірки над емулятором (`emulators:exec` ставить
 * адресу бази сам); у розкладі змінної немає, і прибирається живий проєкт.
 */

const PROJECT = process.env.SWEEP_PROJECT || 'vet-crew-games';

/*
 * Біля емулятора CLI не може спитати Google про проєкт (`demo-…` там немає — «Failed
 * to get details for project»), тож екземпляр бази називаємо самі. Проти живого
 * проєкту — ні: база там не в США, і її адресу CLI бере з опису проєкту.
 */
const INSTANCE = process.env.FIREBASE_DATABASE_EMULATOR_HOST
	? ['--instance', `${PROJECT}-default-rtdb`]
	: [];

/** Виклик `firebase-tools` тією самою обгорткою, що й решта скриптів. */
function firebase(args) {
	const result = spawnSync(
		process.execPath,
		[join('scripts', 'firebase-cli.mjs'), ...args, '--project', PROJECT, ...INSTANCE],
		{ encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }
	);
	if (result.status !== 0) {
		throw new Error(`firebase ${args[0]} завершився з кодом ${result.status}`);
	}
	return result.stdout;
}

/** Скільки шляхів в одному записі: без межі тисяча привидів стала б одним важким запитом. */
const PATCH_PATHS = 500;

const temp = mkdtempSync(join(tmpdir(), 'vcg-sweep-'));
try {
	/** Гілка бази цілком; `null` — її немає. */
	const read = (path) => {
		const dump = join(temp, `${path.replace(/\W/g, '_')}.json`);
		firebase(['database:get', path, '--output', dump]);
		const raw = readFileSync(dump, 'utf8').trim();
		return raw === '' || raw === 'null' ? null : JSON.parse(raw);
	};

	const rooms = read('/rooms');
	const pointers = {
		lobby: read('/lobby'),
		presence: read('/presence'),
		myRooms: read('/myRooms')
	};
	const now = Date.now();
	const plan = planSweep({ rooms, ...pointers, now });
	// Друге читання кімнат — ПІСЛЯ решти гілок і перед самим записом (`confirmedPaths`).
	const paths = confirmedPaths(plan, planSweep({ rooms: read('/rooms'), ...pointers, now }));

	const report = [
		`кімнат ${plan.total}, покинутих ${plan.doomed.length + plan.left} ` +
			`(тиша понад ${SWEEP_SILENCE_MS / 3600000} год або вік понад ${SWEEP_MAX_AGE_MS / 3600000} год), ` +
			`з них без позначки часу ${plan.undatable}, за віком ${plan.overAge}, порожніх ${plan.empty}`,
		`зносимо: кімнат ${plan.doomed.length} (порожні — усі, решта — з межі ${SWEEP_LIMIT}), ` +
			`разом із переліком, присутністю й індексами — ${plan.paths.length} шляхів`
	];
	// Обрізка НАЗИВАЄТЬСЯ ВГОЛОС: мовчазна межа читалася б як «прибрано все».
	if (plan.left > 0) report.push(`за межею прогону лишилося кімнат: ${plan.left}`);
	if (paths.length < plan.paths.length) {
		report.push(
			`відкладено шляхів: ${plan.paths.length - paths.length} — кімнату тим часом створили знову`
		);
	}
	for (const line of report) console.log(`sweep-rooms: ${line}`);

	if (paths.length > 0) {
		/*
		 * ПАЧКАМИ ЗАПИСІВ, а не `database:remove` на кожен шлях: разом із переліком і
		 * присутністю шляхів сотні, а кожен виклик — окремий процес CLI. `null` за
		 * ключем-шляхом — це видалення, і кожну пачку база застосовує всю або жодної.
		 * Шляхи плану не перекриваються (`sweep-plan.mjs`), інакше запис відхилили б.
		 * Перевірено над емулятором тим самим запитом `PATCH /`, що робить CLI.
		 */
		for (let from = 0; from < paths.length; from += PATCH_PATHS) {
			const chunk = paths.slice(from, from + PATCH_PATHS);
			const patch = join(temp, `sweep-${from}.json`);
			writeFileSync(patch, JSON.stringify(Object.fromEntries(chunk.map((path) => [path, null]))));
			firebase(['database:update', '/', patch, '--force']);
		}
		for (const { code, silence } of plan.doomed.filter(({ code }) =>
			paths.includes(`rooms/${code}`)
		)) {
			const age = Number.isFinite(silence)
				? `тиша ${Math.round(silence / 3600000)} год`
				: 'без позначки часу';
			console.log(`  знесено ${code} — ${age}`);
		}
	}

	// Підсумок — і на сторінку прогону: інакше його видно лише в журналі кроку.
	if (process.env.GITHUB_STEP_SUMMARY) {
		const summary = report.map((line) => `- ${line}\n`).join('');
		writeFileSync(process.env.GITHUB_STEP_SUMMARY, summary, { flag: 'a' });
	}
} finally {
	rmSync(temp, { recursive: true, force: true });
}
