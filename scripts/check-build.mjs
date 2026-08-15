/**
 * Інваріанти ЗІБРАНОГО сайту. Запускати після `npm run build`.
 *
 * Чому окремий крок, а не ще один vitest-файл: усе нижче не існує в джерелах.
 * Дефекти цього класу видно лише у `build/*.html`, і кожен із них у коді
 * виглядає правильним (AI-AGENT-PITFALLS-v8 § 2, CODE-QUALITY-v8 § 7,
 * SEO-v8 § 6.1).
 *
 * Перевірка мертва, якщо їй нема на що дивитися, тому перший блок — canary:
 * без згенерованих сторінок скрипт падає, а не звітує «усе гаразд».
 */
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BUILD = 'build';
const SITE_ORIGIN = 'https://alik532ua.github.io';

/** PERFORMANCE-v8 § 1: бюджет initial JS на маршрут. */
const ENTRY_JS_BUDGET_KB = 150;

/**
 * Домени, які сторінка справді відкриває, і директива, без якої браузер
 * мовчки їх заблокує (SECURITY-v8 § 6.2 і § 14.1). Список звіряється з
 * `app.html` і `analytics.ts`, а не з пам'яті.
 */
const REQUIRED_CSP = [
	['script-src', 'https://www.googletagmanager.com'],
	['connect-src', 'https://*.google-analytics.com'],
	['style-src', 'https://fonts.googleapis.com'],
	['font-src', 'https://fonts.gstatic.com']
];

const problems = [];
const fail = (message) => problems.push(message);

function walk(dir, out = []) {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full, out);
		else out.push(full.replace(/\\/g, '/'));
	}
	return out;
}

const allFiles = walk(BUILD);
const htmlFiles = allFiles.filter((f) => f.endsWith('.html'));

// --- canary -----------------------------------------------------------------
if (htmlFiles.length < 3) {
	console.error(
		`check-build: знайдено ${htmlFiles.length} HTML-файлів у ${BUILD}/. ` +
			'Перевіряти нема чого — збірки немає або шлях змінився.'
	);
	process.exit(1);
}

/** Хеш так, як його рахує браузер: парсер HTML нормалізує переводи рядків. */
const cspHash = (source) =>
	`sha256-${createHash('sha256').update(source.replace(/\r\n/g, '\n')).digest('base64')}`;

for (const file of htmlFiles) {
	const html = readFileSync(file, 'utf8');
	const where = file.replace(`${BUILD}/`, '');
	// 404.html — SPA-фолбек: у ньому за побудовою немає ні вмісту, ні canonical.
	const isFallback = where === '404.html';

	// SEO-v8 § 1.1 — сторінка в індексі з порожнім тілом.
	if (!isFallback) {
		const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1] ?? '';
		const text = body.replace(/<[^>]+>/g, '').trim();
		if (text.length < 200) fail(`${where}: тіло майже порожнє (${text.length} символів тексту)`);
	}

	// SEO-v8 § 1.2 — плейсхолдер prerender замість справжнього домену.
	if (html.includes('sveltekit-prerender')) fail(`${where}: у HTML лишився sveltekit-prerender`);

	// SEO-v8 § 1.3 — відносний `base`, склеєний в абсолютну адресу.
	if (/https?:\/\/[^"']*\.\//.test(html)) fail(`${where}: абсолютний URL із "./" усередині`);

	if (!isFallback) {
		const canonicals = html.match(/<link[^>]+rel="canonical"[^>]*>/g) ?? [];
		if (canonicals.length !== 1) fail(`${where}: canonical знайдено ${canonicals.length} разів`);
		else if (!canonicals[0].includes(`href="${SITE_ORIGIN}`))
			fail(`${where}: canonical не абсолютна або веде на чужий origin — ${canonicals[0]}`);

		if (!/<title>[^<]{5,}<\/title>/.test(html)) fail(`${where}: title відсутній або надто короткий`);
	}

	// --- CSP (SECURITY-v8 § 6) ------------------------------------------------
	const cspMeta = html.match(/<meta http-equiv="content-security-policy" content="([^"]*)"/i);
	if (!cspMeta) {
		fail(`${where}: у зібраному HTML немає мета-політики CSP`);
		continue;
	}
	const csp = cspMeta[1];
	const scriptSrc = csp.match(/script-src ([^;]*)/)?.[1] ?? '';

	if (scriptSrc.includes("'unsafe-inline'"))
		fail(`${where}: script-src містить 'unsafe-inline' — політика не покриває жодного скрипта`);

	for (const [directive, origin] of REQUIRED_CSP) {
		if (!new RegExp(`${directive} [^;]*${origin.replace(/[.*]/g, '\\$&')}`).test(csp))
			fail(`${where}: у ${directive} немає ${origin} — ресурс буде заблоковано мовчки`);
	}

	// Кожен інлайн-скрипт мусить бути покритий хешем. Це ловить і розбіжність
	// CRLF/LF, через яку хеш «як є» не збігається з тим, що рахує браузер.
	for (const [, body] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
		const hash = cspHash(body);
		if (!scriptSrc.includes(hash))
			fail(`${where}: інлайн-скрипт не покритий політикою — бракує '${hash}'`);
	}

	// SECURITY-v8 § 6.3: мета-політика діє лише на те, що йде ПІСЛЯ неї.
	const metaAt = html.indexOf(cspMeta[0]);
	const firstInlineAt = html.indexOf('<script>');
	if (firstInlineAt !== -1 && firstInlineAt < metaAt)
		fail(`${where}: інлайн-скрипт стоїть ВИЩЕ мета-політики — вона його не покриває`);
}

// --- Source maps не публікуються (OBSERVABILITY-v8 § 1.2) --------------------
const maps = allFiles.filter((f) => f.endsWith('.map'));
if (maps.length)
	fail(
		`у ${BUILD}/ лежить ${maps.length} .map — вихідний код поїде на GitHub Pages ` +
			`(перший: ${maps[0]})`
	);

// --- Бюджет initial JS (PERFORMANCE-v8 § 10.1) ------------------------------
const entryDir = `${BUILD}/_app/immutable/entry`;
const entryFiles = allFiles.filter((f) => f.startsWith(`${entryDir}/`) && f.endsWith('.js'));
if (!entryFiles.length) {
	fail(`${entryDir}: жодного .js — шлях змінився, і бюджет більше не перевіряється`);
} else {
	const kb = Math.round(
		entryFiles.reduce((sum, f) => sum + gzipSync(readFileSync(f)).length, 0) / 1024
	);
	console.log(`check-build: entry JS ${kb} КБ gzip (бюджет ${ENTRY_JS_BUDGET_KB})`);
	if (kb > ENTRY_JS_BUDGET_KB) fail(`бюджет initial JS перевищено: ${kb} КБ > ${ENTRY_JS_BUDGET_KB}`);
}

// --- Секретів у бандлі немає (SECURITY-v8 § 16) -----------------------------
const SECRET_NAMES = /API_SECRET|PRIVATE_KEY|SERVICE_ACCOUNT|SENTRY_AUTH_TOKEN/;
const leaked = allFiles
	.filter((f) => /\.(js|html|json|css)$/.test(f))
	.filter((f) => SECRET_NAMES.test(readFileSync(f, 'utf8')));
if (leaked.length) fail(`схоже на секрет у бандлі: ${leaked.join(', ')}`);

// ----------------------------------------------------------------------------
if (problems.length) {
	console.error(`check-build: перевірка не пройдена (${problems.length}):`);
	for (const problem of problems) console.error(`  - ${problem}`);
	process.exit(1);
}
console.log(`check-build: ${htmlFiles.length} сторінок, усе гаразд`);
