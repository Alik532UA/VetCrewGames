/**
 * ШТАМП КОДУ ПЕРЕПРОГОНУ: версія правил гри піднімається разом із кодом, який
 * з журналу рахує партію.
 *
 * Використання:
 *   node scripts/replay-stamp.mjs                 поставити штампи (відмовить, якщо
 *                                                 код змінився, а версія та сама)
 *   node scripts/replay-stamp.mjs --same=quiz     перештампувати ту саму версію:
 *                                                 зміна перепрогону не міняє
 *   node scripts/replay-stamp.mjs --check         лише звірити (для тесту й CI)
 *
 * ## Задача
 *
 * Стан спільної партії — чиста функція від журналу, і рахує її КОЖЕН клієнт сам.
 * Дві збірки в одній кімнаті, що рахують по-різному, показують різні табло й
 * різні нагороди — тому кімната й несе `rulesVersion`, а різні версії в неї не
 * пускають (`utils/roomEntry.ts`). Але версію піднімає людина руками, і три зміни
 * перепрогону вікторини вийшли під тією самою четвіркою: хто рахується гравцем,
 * ходи до `createdAt`, чекання, що належить раунду (аудит 2026-09-26). Жоден гейт
 * цього не бачив — перевірялася лише нижня межа версії.
 *
 * ## Як
 *
 * Для кожної гри — хеш СЕМАНТИКИ модулів, з яких рахується партія (без коментарів
 * і зайвих пробілів, тобто правка докблока штампа не міняє), і поруч — версія, під
 * якою цей хеш поставлено (`src/lib/config/replay-stamps.json`). `--check` червоніє,
 * коли код змінився або версія розійшлася зі штампом. Поставити новий штамп тієї
 * самої версії можна лише з `--same=<гра>`: це рішення «перепрогін той самий», і
 * воно видне в диффі, а не робиться мовчки.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const STAMPS = 'src/lib/config/replay-stamps.json';
const VERSIONS = 'src/lib/config/roomRules.ts';

/** Скільки шістнадцяткових знаків штампа. */
const STAMP_LENGTH = 12;

/**
 * З ЧОГО РАХУЄТЬСЯ ПАРТІЯ — модулі, які з того самого журналу мусять дати той
 * самий стан на кожному клієнті, і рішення, які пишуть у журнал.
 */
export const GAMES = {
	quiz: {
		constant: 'QUIZ_RULES_VERSION',
		files: [
			'src/lib/utils/quizReplay.ts',
			'src/lib/utils/quizClock.ts',
			'src/lib/utils/quizScore.ts',
			'src/lib/utils/quizHold.ts',
			'src/lib/utils/awayWait.ts',
			'src/lib/utils/roster.ts',
			'src/lib/config/quizOnline.ts'
		]
	},
	pairs: {
		constant: 'PAIRS_RULES_VERSION',
		files: [
			'src/lib/controllers/pairsMatch.svelte.ts',
			'src/lib/controllers/turnLimit.ts',
			'src/lib/controllers/memoryGame.svelte.ts',
			'src/lib/utils/roster.ts'
		]
	}
};

/**
 * Прибрати коментарі, не зачепивши рядків у лапках (усіх трьох видів).
 *
 * @param {string} text
 */
export function stripComments(text) {
	let out = '';
	/** @type {string | null} */
	let quote = null;
	for (let i = 0; i < text.length; i += 1) {
		const ch = text[i];
		const next = text[i + 1];
		if (quote !== null) {
			out += ch;
			if (ch === '\\') {
				out += next ?? '';
				i += 1;
			} else if (ch === quote) quote = null;
			continue;
		}
		if (ch === '/' && next === '/') {
			while (i < text.length && text[i] !== '\n') i += 1;
			out += '\n';
			continue;
		}
		if (ch === '/' && next === '*') {
			const end = text.indexOf('*/', i + 2);
			i = end === -1 ? text.length : end + 1;
			continue;
		}
		if (ch === '"' || ch === "'" || ch === '`') quote = ch;
		out += ch;
	}
	return out;
}

/**
 * Штамп гри = хеш семантики її модулів, разом з їхніми шляхами.
 *
 * @param {readonly string[]} files
 */
export function stampOf(files) {
	const hash = createHash('sha256');
	for (const file of files) {
		const semantic = stripComments(readFileSync(file, 'utf8').replace(/\r\n/g, '\n'))
			.replace(/\s+/g, ' ')
			.trim();
		hash.update(`${file}\n${semantic}\n`);
	}
	return hash.digest('hex').slice(0, STAMP_LENGTH);
}

/** Поточна версія правил гри — з `roomRules.ts`. @param {string} constant */
function versionOf(constant) {
	const found = new RegExp(`${constant} = (\\d+)`).exec(readFileSync(VERSIONS, 'utf8'));
	if (!found) throw new Error(`у ${VERSIONS} немає ${constant}`);
	return Number(found[1]);
}

function main() {
	/** @type {Record<string, { version: number; stamp: string }>} */
	const recorded = JSON.parse(readFileSync(STAMPS, 'utf8'));
	const check = process.argv.includes('--check');
	const same = process.argv
		.filter((arg) => arg.startsWith('--same='))
		.map((arg) => arg.slice('--same='.length));

	const problems = [];
	/** @type {Record<string, { version: number; stamp: string }>} */
	const next = {};
	for (const [game, { constant, files }] of Object.entries(GAMES)) {
		const version = versionOf(constant);
		const stamp = stampOf(files);
		const was = recorded[game];
		next[game] = { version, stamp };
		if (was?.stamp === stamp && was.version === version) continue;
		if (check) {
			problems.push(
				was?.stamp !== stamp
					? `${game}: код перепрогону змінився (штамп ${was?.stamp ?? '—'} → ${stamp})`
					: `${game}: ${constant} = ${version}, а штамп поставлено під ${was?.version}`
			);
		} else if (was?.version === version && was.stamp !== stamp && !same.includes(game)) {
			problems.push(
				`${game}: код перепрогону змінився, а ${constant} той самий (${version}). Підніміть ` +
					`версію в ${VERSIONS} — або, якщо перепрогін справді той самий, --same=${game}`
			);
		}
	}

	if (problems.length > 0) {
		console.error('\nШТАМП ПЕРЕПРОГОНУ РОЗІЙШОВСЯ З КОДОМ:');
		for (const problem of problems) console.error(`  • ${problem}`);
		if (check) console.error('\nВиконати: npm run replay:stamp (і, якщо треба, підняти версію).\n');
		process.exit(1);
	}
	if (check) {
		console.log('replay-stamp: штампи збігаються з кодом перепрогону й версіями правил.');
		return;
	}
	writeFileSync(STAMPS, `${JSON.stringify(next, null, '\t')}\n`);
	console.log(`replay-stamp: ${STAMPS} — ${JSON.stringify(next)}`);
}

// Запуск як скрипта, а не імпорт.
if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/replay-stamp.mjs')) main();
