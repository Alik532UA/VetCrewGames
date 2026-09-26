/**
 * МУТАЦІЙНИЙ ПРОГІН ПРАВИЛ: прибрати кожну умову по черзі — гейт мусить почервоніти.
 *
 * Використання (емулятор скрипт піднімає сам, як `check:rules`):
 *
 *   npm run rules:mutants -- --only=info/hostUid   лише правила, чий шлях містить фрагмент
 *   npm run rules:mutants -- --list                лише перелік мутантів, без прогонів
 *   npm run rules:mutants                          усі правила (~10 хв: сотні прогонів гейта)
 *   npm run rules:mutants -- --update              повний прогін і новий перелік відомих вижилих
 *
 * ## Навіщо
 *
 * Гейт (`check-rules.mjs`) доводить, що правила пускають законне й відкидають
 * незаконне. Але чи тримає КОЖНУ умову хоч один випадок поодинці, він сам не
 * перевіряє: умова, яку не тримає жоден випадок, виглядає так само, як потрібна, —
 * і її можна прибрати, не почувши жодного слова. Шостий аудит знайшов три такі
 * руками (T1), а зворотні експерименти до кожної нової умови знаходили ще — щоразу
 * скриптом у чернетці сесії. Тепер це скрипт у репозиторії.
 *
 * ## Як
 *
 * Кожен вираз `.read`/`.write`/`.validate` розбирається на ланцюжки `&&` і `||` на
 * будь-якій глибині дужок. Мутант — ОДИН операнд, замінений нейтральним значенням:
 * у `&&` — `true` (умову прибрано), у `||` — `false` (гілку прибрано), а гілка
 * тернарного `?:` — `true` (умову цієї гілки прибрано). Правила мутанта ставляться в
 * уже запущений емулятор через REST (`/.settings/rules.json`), база стирається, і
 * гейт іде знову (~1,5 с на мутант). Гейт зелений — мутант ВИЖИВ: цю умову не тримає
 * жоден випадок.
 *
 * Не мутуються: `auth != null` (навмисний запас: без входу `auth.uid` однаково не
 * збігся б ні з чим) і РІВНОЗНАЧНІ мутанти — перевірка типу, за якою в тому самому
 * ланцюжку йде операція, що на іншому типі однаково відмовить (`equivalent` нижче).
 *
 * ## Храповик
 *
 * Відомі вижилі лежать у `scripts/rules-mutants.known.json`, і перелік може лише
 * коротшати: новий вижилий червонить прогін (свіжа прогалина — випадок у гейті), і
 * відомий, якого тепер убито, — теж (викреслити з переліку). Перелік — словник «мітка →
 * чому вижив»: з 113 вижилих першого прогону (2026-09-26) 67 були прогалинами й убиті
 * випадками в гейті, а 46 — запаси, які вже тримає інше правило, і кожен із причиною.
 *
 * Не в CI: повний прогін — хвилин десять. Для нової умови — `--only` на її шлях.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { join } from 'node:path';

const RULES = 'database.rules.json';
/** Відомі вижилі мутанти — перелік, що може лише коротшати (див. кінець `main`). */
const KNOWN = 'scripts/rules-mutants.known.json';
const DB_HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? '127.0.0.1:9010';
const PROJECT = process.env.GCLOUD_PROJECT ?? 'demo-vet-crew-games';
const NS = `${PROJECT}-default-rtdb`;
const OWNER = { Authorization: 'Bearer owner' };
/** Операнд, який навмисно не мутується (див. докблок). */
const SKIP = new Set(['auth != null']);

/**
 * РІВНОЗНАЧНИЙ МУТАНТ — перевірка типу, за якою в тому самому ланцюжку `&&` іде
 * операція, що на іншому типі однаково відмовить: `.length`, `.matches(…)` і рівність
 * рядку чи `auth.uid` бувають лише в рядка, порівняння `<`, `>` — лише в числа. Без
 * такої перевірки поведінка та сама, тож вижилий мутант тут — не прогалина, а шум, і
 * створювати його нема чого.
 */
const STRING_OPS =
	/newData\.val\(\)\.(length|matches\(|beginsWith\(|endsWith\(|contains\()|newData\.val\(\) === (auth\.uid|')/;
const NUMBER_OPS = /newData\.val\(\) (<|<=|>|>=) /;

/** @param {string} text @param {readonly string[]} siblings */
export function equivalent(text, siblings) {
	if (text === 'newData.isString()') return siblings.some((other) => STRING_OPS.test(other));
	if (text === 'newData.isNumber()') return siblings.some((other) => NUMBER_OPS.test(other));
	return false;
}

/**
 * Правила файлу з їхніми шляхами: `{ path, start, end }` — межі ВМІСТУ рядка-виразу
 * у файлі (без лапок). Коментарі й рядки пропускаються, ключі складаються в шлях.
 *
 * @param {string} text
 */
export function rulesOf(text) {
	const rules = [];
	const stack = [];
	let key = null;
	let lastString = null;
	let i = 0;
	while (i < text.length) {
		const ch = text[i];
		if (ch === '/' && text[i + 1] === '/') {
			while (i < text.length && text[i] !== '\n') i += 1;
			continue;
		}
		if (ch === '/' && text[i + 1] === '*') {
			const end = text.indexOf('*/', i + 2);
			i = end < 0 ? text.length : end + 2;
			continue;
		}
		if (ch === '"') {
			const start = i + 1;
			i += 1;
			while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
			lastString = { value: text.slice(start, i), start, end: i };
			i += 1;
			if (key !== null && key.startsWith('.') && /^\.(read|write|validate)$/.test(key)) {
				rules.push({ path: [...stack.slice(1), key].join('/'), start, end: i - 1 });
				key = null;
			}
			continue;
		}
		if (ch === ':') {
			key = lastString?.value ?? null;
			lastString = null;
		} else if (ch === '{') {
			stack.push(key ?? '');
			key = null;
		} else if (ch === '}') {
			stack.pop();
			key = null;
		} else if (ch === ',') {
			key = null;
		}
		i += 1;
	}
	return rules.filter((rule) => rule.end > rule.start);
}

/**
 * Межі верхнього рівня виразу: індекси операторів `||`, `&&`, `?`, `:` поза дужками,
 * рядками (`'…'`) і регулярками (`/…/` на початку виразу, після `(` чи `,`).
 *
 * @param {string} expr
 */
function topLevel(expr) {
	const ops = [];
	const groups = [];
	let depth = 0;
	let open = -1;
	let prev = '';
	for (let i = 0; i < expr.length; i += 1) {
		const ch = expr[i];
		if (ch === "'") {
			i += 1;
			while (i < expr.length && expr[i] !== "'") i += expr[i] === '\\' ? 2 : 1;
			prev = "'";
			continue;
		}
		if (ch === '/' && (prev === '' || prev === '(' || prev === ',')) {
			i += 1;
			while (i < expr.length && expr[i] !== '/') i += expr[i] === '\\' ? 2 : 1;
			prev = '/';
			continue;
		}
		if (ch === '(') {
			if (depth === 0) open = i;
			depth += 1;
		} else if (ch === ')') {
			depth -= 1;
			if (depth === 0) groups.push([open + 1, i]);
		} else if (depth === 0) {
			const two = expr.slice(i, i + 2);
			if (two === '&&' || two === '||') {
				ops.push({ at: i, op: two });
				i += 1;
			} else if (ch === '?' || ch === ':') ops.push({ at: i, op: ch });
		}
		if (ch !== ' ') prev = ch;
	}
	return { ops, groups };
}

/**
 * Точки мутації виразу: `{ start, end, op }` — межі операнда (без крайніх пробілів)
 * і оператор ланцюжка, у якому він стоїть.
 *
 * @typedef {{ start: number, end: number, op: string, text: string }} Point
 * @param {string} expr
 * @param {number} base зсув `expr` у зовнішньому рядку
 * @returns {Point[]}
 */
export function mutationPoints(expr, base = 0) {
	const { ops, groups } = topLevel(expr);
	/** @type {Point[]} */
	const points = [];
	/** @param {string} op @returns {Array<[number, number]>} */
	const operands = (op) => {
		const cuts = ops.filter((o) => o.op === op).map((o) => o.at);
		/** @type {Array<[number, number]>} */
		const parts = [];
		let from = 0;
		for (const at of cuts) {
			parts.push([from, at]);
			from = at + 2;
		}
		parts.push([from, expr.length]);
		return parts;
	};
	/** @param {[number, number]} range @returns {[number, number]} */
	const trimmed = ([from, to]) => {
		while (from < to && expr[from] === ' ') from += 1;
		while (to > from && expr[to - 1] === ' ') to -= 1;
		return [from, to];
	};
	/** @param {number} from @param {number} to */
	const deeper = (from, to) => points.push(...mutationPoints(expr.slice(from, to), base + from));

	if (ops.some((o) => o.op === '?')) {
		// Тернарний на верхньому рівні: умова й гілки — окремі вирази.
		const q = /** @type {{ at: number }} */ (ops.find((o) => o.op === '?')).at;
		let nested = 0;
		let colon = -1;
		for (const o of ops) {
			if (o.at <= q) continue;
			if (o.op === '?') nested += 1;
			else if (o.op === ':') {
				if (nested === 0) {
					colon = o.at;
					break;
				}
				nested -= 1;
			}
		}
		if (colon < 0) return points;
		deeper(0, q);
		// Гілка — теж умова: `true` на її місці прибирає саме її.
		for (const branch of [trimmed([q + 1, colon]), trimmed([colon + 1, expr.length])]) {
			const text = expr.slice(branch[0], branch[1]);
			points.push({ start: base + branch[0], end: base + branch[1], op: '?:', text });
			deeper(branch[0], branch[1]);
		}
		return points;
	}
	const op = ops.some((o) => o.op === '||') ? '||' : ops.some((o) => o.op === '&&') ? '&&' : null;
	/** @type {Array<[number, number]>} */
	const parts = op ? operands(op).map(trimmed) : [trimmed([0, expr.length])];
	const texts = parts.map(([from, to]) => expr.slice(from, to));
	for (const [index, [from, to]] of parts.entries()) {
		const text = texts[index];
		const siblings = op === '&&' ? texts.filter((_, other) => other !== index) : [];
		if (op && !SKIP.has(text) && !equivalent(text, siblings)) {
			points.push({ start: base + from, end: base + to, op, text });
		}
		// Усередині операнда — його дужки (групи, аргументи викликів).
		for (const [g0, g1] of groups) if (g0 >= from && g1 <= to) deeper(g0, g1);
	}
	return points;
}

/** @param {string} text */
async function putRules(text) {
	const res = await fetch(`http://${DB_HOST}/.settings/rules.json?ns=${NS}`, {
		method: 'PUT',
		headers: OWNER,
		body: text
	});
	if (!res.ok) throw new Error(`емулятор не прийняв правил: ${res.status} ${await res.text()}`);
}

async function wipe() {
	const res = await fetch(`http://${DB_HOST}/.json?ns=${NS}`, { method: 'DELETE', headers: OWNER });
	if (!res.ok) throw new Error(`емулятор не стер базу: ${res.status}`);
}

function gate() {
	const run = spawnSync(process.execPath, [join('scripts', 'check-rules.mjs')], {
		encoding: 'utf8',
		env: process.env
	});
	return { green: run.status === 0, out: `${run.stdout}${run.stderr}` };
}

/**
 * Поза емулятором — запустити себе ж під `emulators:exec`. Інакше `npm run
 * rules:mutants -- --only=…` віддав би аргумент Firebase CLI, а не скрипту.
 */
/** @param {string[]} args */
function underEmulator(args) {
	const inner = `node scripts/rules-mutants.mjs ${args.join(' ')}`.trim();
	const child = spawn(
		process.execPath,
		[
			join('scripts', 'firebase-cli.mjs'),
			'emulators:exec',
			'--project',
			PROJECT,
			'--only',
			'database,auth',
			inner
		],
		{ stdio: 'inherit' }
	);
	child.on('exit', (code) => process.exit(code ?? 1));
}

async function main() {
	const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice('--only='.length);
	const list = process.argv.includes('--list');
	// Фрагмент шляху йде в командний рядок емулятора — лише безпечні символи.
	if (only !== undefined && !/^[\w$/.-]+$/.test(only)) {
		throw new Error(`--only: лише літери, цифри, $, /, . і - (дано «${only}»)`);
	}
	if (!list && !process.env.FIREBASE_DATABASE_EMULATOR_HOST) {
		underEmulator(process.argv.slice(2));
		return;
	}
	const original = readFileSync(RULES, 'utf8').replace(/\r\n/g, '\n');
	const mutants = [];
	for (const rule of rulesOf(original)) {
		if (only && !rule.path.includes(only)) continue;
		const expr = original.slice(rule.start, rule.end);
		/*
		 * Мітка — шлях, оператор і текст операнда; однаковий текст двічі в одному правилі
		 * (дві межі `<= 14` у налаштуваннях) — з номером, інакше перелік відомих вижилих
		 * не розрізнив би, котрий із двох вижив.
		 */
		const seen = new Map();
		for (const point of mutationPoints(expr)) {
			const base = `${rule.path}  ${point.op}  ${point.text}`;
			const count = (seen.get(base) ?? 0) + 1;
			seen.set(base, count);
			mutants.push({ rule, point, label: count > 1 ? `${base} #${count}` : base });
		}
	}
	console.log(`rules-mutants: ${mutants.length} мутантів${only ? ` у «${only}»` : ''}.`);
	if (list) {
		for (const { label } of mutants) console.log(`  ${label}`);
		return;
	}

	await putRules(original);
	await wipe();
	if (!gate().green) throw new Error('гейт червоний і без мутацій — спершу полагодити його');

	/** @type {string[]} */
	const survived = [];
	for (const [index, { rule, point, label }] of mutants.entries()) {
		const neutral = point.op === '||' ? 'false' : 'true';
		const at = rule.start;
		const mutated = original.slice(0, at + point.start) + neutral + original.slice(at + point.end);
		await putRules(mutated);
		await wipe();
		const { green } = gate();
		console.log(`  ${green ? 'ВИЖИВ ' : 'убитий'}  [${index + 1}/${mutants.length}] ${label}`);
		if (green) survived.push(label);
	}
	await putRules(original);
	await wipe();

	/*
	 * ХРАПОВИК, А НЕ «УСЕ АБО НІЧОГО». Відомі вижилі — у `KNOWN`, і перелік може лише
	 * коротшати: новий вижилий — свіжа прогалина (червоно), а відомий, якого тепер
	 * убито, треба викреслити (теж червоно — інакше він сховав би наступну прогалину на
	 * тому самому місці). Той самий прийом, що в переліку завеликих файлів
	 * (`structure.test.ts`, `OVERSIZED_ALLOWLIST`).
	 */
	/*
	 * Перелік — словник «мітка → чому вижив»: кожен прийнятий запас із причиною, а не
	 * мовчки. `--update` причини зберігає, новим ставить «не розібрано».
	 */
	/** @type {Record<string, string>} */
	const reasons = JSON.parse(readFileSync(KNOWN, 'utf8'));
	const known = new Set(Object.keys(reasons));
	/** @param {string} label */
	const inScope = (label) => !only || label.split('  ')[0].includes(only);
	const all = new Set(mutants.map(({ label }) => label));
	const fresh = survived.filter((label) => !known.has(label));
	const stale = [...known].filter(
		(label) => inScope(label) && (!all.has(label) || !survived.includes(label))
	);
	if (process.argv.includes('--update')) {
		if (only) throw new Error('--update — лише для повного прогону, без --only');
		/** @type {Record<string, string>} */
		const next = {};
		for (const label of [...survived].sort()) next[label] = reasons[label] ?? 'не розібрано';
		writeFileSync(KNOWN, `${JSON.stringify(next, null, '\t')}\n`);
		console.log(`\nrules-mutants: ${KNOWN} — ${survived.length} відомих вижилих.`);
		return;
	}
	const undecided = [...known].filter((label) => reasons[label] === 'не розібрано');
	if (undecided.length > 0) console.warn(`  не розібрано у ${KNOWN}: ${undecided.length}`);
	for (const label of fresh) console.error(`  НОВИЙ вижилий: ${label}`);
	for (const label of stale) console.error(`  убито, викреслити з ${KNOWN}: ${label}`);
	if (fresh.length > 0 || stale.length > 0) {
		console.error(
			`\nrules-mutants: нових вижилих ${fresh.length}, викреслити ${stale.length}` +
				' (новий вижилий — випадок у гейті; викреслити — рядок у переліку).'
		);
		process.exit(1);
	}
	console.log(
		`\nrules-mutants: нових вижилих немає; відомих у цьому прогоні ${survived.length} (${KNOWN}).`
	);
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/rules-mutants.mjs')) {
	main().catch((error) => {
		console.error(`rules-mutants: ${error.message}`);
		process.exit(2);
	});
}
