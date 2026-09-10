// @vitest-environment node
// Перевірка лише читає файли — DOM їй не потрібен.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { HIDDEN_ROUTES, LANGUAGE_ROUTES } from '$lib/i18n/routing';

/**
 * `llms.txt` — те, що моделі читають про цей сайт, і єдиний файл проєкту, чиї
 * ТВЕРДЖЕННЯ не перевіряв ніхто.
 *
 * `scripts/check-geo.mjs` звіряє адреси: кожне посилання існує у `build/`, одна
 * адреса не стоїть під двома назвами, заголовок H1 на місці. Проза при цьому
 * лишалася поза будь-яким гейтом — і саме в ній знайшлися твердження, яких
 * проєкт не виконує. Станом до цієї перевірки у файлі стояло:
 *
 *   «Offline Capability: Playable offline via Progressive Web App (PWA)
 *    caching» — PWA в проєкті немає ЖОДНОЇ: ні `vite-plugin-pwa`, ні
 *    `service-worker.ts`, ні манифеста, ні `<link rel="manifest">`. Це записано
 *    і в `services/resetService.ts` («PWA тут ще немає»), тобто документ
 *    суперечив коду, який сам же й посилався на його відсутність;
 *
 *   «customizable themes, and sound settings» — звуку немає теж, і це записано
 *   в канонічній мапі клавіш (`services/keyboard.ts`: «M — ПРОПУЩЕНО, звуку в
 *   проєкті немає, жодного `<audio>`, жодного сервісу звуку»);
 *
 *   «high score leaderboards, and achievements» — таблиця лідерів є
 *   (`net/leaders.ts`), досягнень немає ніде.
 *
 * Ціна такої помилки вища, ніж у звичайної застарілої прози: `llms.txt` пишеться
 * для машини, яка перекаже його як факт і не піде перевіряти. Той самий клас, що
 * `PIT-DOC-FACTS` (AI-AGENT-PITFALLS-v9 § 5.5.2) і SEO-v9 § 7.1 — де висновок
 * дослівно такий: рядок у `llms.txt` брався з УЯВЛЕННЯ про сайт, а не з того, що
 * в ньому є.
 *
 * Тому перевіряються дві різні речі:
 *
 *   1) слово-обіцянка не стоїть у файлі, поки в коді немає того, що його
 *      виконує (`CLAIMS` нижче);
 *   2) кожен маршрут в індексі описаний, а прихований — ні: інакше нова гра
 *      просто не існує для моделі, а службова сторінка потрапляє в перелік,
 *      якого їй не належить.
 *
 * Джерело маршрутів — `LANGUAGE_ROUTES`, той самий, з якого живуть canonical,
 * hreflang і sitemap. Другого переліку тут навмисно немає: він розійшовся б.
 */

const LLMS = 'static/llms.txt';
const text = readFileSync(LLMS, 'utf8');

const IGNORED_DIRS = new Set(['node_modules', '.svelte-kit', 'build', 'dist', 'coverage']);

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		if (IGNORED_DIRS.has(entry)) continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full, out);
		else out.push(full.replace(/\\/g, '/'));
	}
	return out;
}

/** Джерела застосунку без самих перевірок: обіцянку виконує код, а не тест про неї. */
const sources = walk('src').filter(
	(f) => /\.(ts|svelte)$/.test(f) && !/\.(test|spec)\.ts$/.test(f)
);

/**
 * Коментарі знімаються, і це НЕ «про всяк випадок» — на цьому перевірка вже
 * помилилася.
 *
 * Зворотний експеримент повернув старий `llms.txt` цілком і чекав трьох
 * обіцянок без покриття. Прийшло дві: «звук» пройшов як виконаний. Ознакою
 * звуку слугує `<audio>` у джерелах — і рівно цей рядок стоїть у канонічній
 * мапі клавіш (`services/keyboard.ts`) у реченні, яке каже ПРОТИЛЕЖНЕ: «звуку в
 * проєкті немає — жодного `<audio>`, жодного сервісу звуку». Тобто найточніший
 * опис відсутності функції доводив перевірці її наявність.
 *
 * Знімаються обидва різновиди коментарів TypeScript і HTML-коментарі розмітки:
 * розмітка `.svelte` — теж місце, де про можливість пишуть словами.
 */
const stripComments = (source: string) =>
	source
		.replace(/\/\*[\s\S]*?\*\//g, ' ')
		.replace(/<!--[\s\S]*?-->/g, ' ')
		.replace(/(^|[^:])\/\/.*$/gm, '$1');

const sourceText = sources.map((f) => stripComments(readFileSync(f, 'utf8'))).join('\n');

/**
 * Слово-обіцянка → ознака, що вона виконана.
 *
 * `evidence` повертає `true`, коли річ у проєкті СПРАВДІ є. Ознака шукається в
 * коді або на диску, а не в документації: документ, який підтверджує сам себе,
 * і був початковою помилкою.
 *
 * Перелік короткий свідомо. Це не спроба перевірити кожне слово — це перелік
 * саме тих слів, які в цьому файлі вже стояли неправдою або стоять поруч із
 * такою межею: функція або є в проєкті, або її немає, і третього стану немає.
 */
const CLAIMS: { claim: RegExp; what: string; evidence: () => boolean }[] = [
	{
		claim: /\bPWA\b|progressive web app|service worker|\boffline\b/i,
		what: 'PWA / офлайн',
		evidence: () =>
			existsSync('src/service-worker.ts') ||
			existsSync('src/service-worker.js') ||
			readdirSync('static').some((f) => /\.webmanifest$/.test(f) || /^manifest\./.test(f)) ||
			/rel="manifest"/.test(readFileSync('src/app.html', 'utf8')) ||
			/vite-plugin-pwa/.test(readFileSync('package.json', 'utf8'))
	},
	{
		claim: /\bsound\b|\baudio\b|\bmusic\b/i,
		what: 'звук',
		evidence: () => /<audio\b|new Audio\(|AudioContext/.test(sourceText)
	},
	{
		claim: /\bachievement/i,
		what: 'досягнення',
		evidence: () => /achievement/i.test(sourceText)
	},
	{
		claim: /\bleaderboard|high score/i,
		what: 'таблиця лідерів',
		evidence: () => existsSync('src/lib/net/leaders.ts')
	},
	{
		claim: /json-?ld/i,
		what: 'JSON-LD',
		evidence: () => /application\/ld\+json/.test(sourceText)
	}
];

/** Адреси-посилання у файлі, як їх бачить модель. */
const urls = [...text.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map((m) => m[1]);

describe(`твердження ${LLMS} проти коду (SEO-v9 § 7.1, PIT-DOC-FACTS)`, () => {
	it('перевірка жива: файл, джерела й адреси знайдено', () => {
		expect(text.length, `${LLMS} порожній або не знайдений`).toBeGreaterThan(500);
		expect(sources.length, 'джерел у src/ не знайдено — шукали не там').toBeGreaterThan(100);
		// Саме «хоч одне»: скільки їх має бути, вирішує покриття маршрутів нижче, а
		// канарка відповідає на інше питання — чи розбір узагалі щось бачить.
		expect(urls.length, 'у llms.txt немає жодного посилання').toBeGreaterThan(0);
	});

	it('перевірка жива: серед ознак є і виконані, і невиконані', () => {
		/*
		 * Таблиця з самих лише виконаних обіцянок доводила б рівно нічого: вона
		 * була б зеленою і при зламаному `evidence`. Тут навмисно поруч стоять
		 * PWA і звук (яких немає) із таблицею лідерів і JSON-LD (які є).
		 */
		const met = CLAIMS.filter((c) => c.evidence());
		expect(met.length, 'жодна ознака не виконана — `evidence` шукає не те').toBeGreaterThan(0);
		expect(met.length, 'усі ознаки виконані — межа не перевіряється').toBeLessThan(CLAIMS.length);
	});

	it('жодного слова-обіцянки без того, що його виконує', () => {
		const lying = CLAIMS.filter((c) => c.claim.test(text) && !c.evidence()).map((c) => c.what);
		expect(
			lying,
			`у ${LLMS} обіцяно те, чого в проєкті немає: ${lying.join(', ')}. ` +
				'Модель перекаже це як факт і не піде перевіряти'
		).toEqual([]);
	});

	it('кожен маршрут в індексі описаний у llms.txt', () => {
		const indexed = (Object.keys(LANGUAGE_ROUTES) as (keyof typeof LANGUAGE_ROUTES)[]).filter(
			(rest) => rest !== '' && !HIDDEN_ROUTES.includes(rest)
		);
		/*
		 * Збіг за ХВОСТОМ адреси, а не за мовою: файл англійською, тож у ньому
		 * стоять `/en/…`, а перелік маршрутів мовою не переймається. Кінцевий
		 * слеш обов'язковий (`trailingSlash: 'always'`), і саме він відрізняє
		 * `game-habitat/` від `game-habitat/biomes/`.
		 */
		const missing = indexed.filter((rest) => !urls.some((url) => url.endsWith(`/${rest}/`)));
		expect(missing, `маршрути є на сайті й не описані для моделей: ${missing.join(', ')}`).toEqual(
			[]
		);
	});

	it('прихованого маршруту в llms.txt немає', () => {
		// Службова сторінка має `noindex` і немає в sitemap; перелік для моделей —
		// те саме рішення, а не третій окремий вибір (BETA-CHECKLIST § 4.1).
		const leaked = HIDDEN_ROUTES.filter((rest) => urls.some((url) => url.endsWith(`/${rest}/`)));
		expect(leaked, `прихована сторінка в llms.txt: ${leaked.join(', ')}`).toEqual([]);
	});

	it('усі адреси абсолютні й із кінцевим слешем або файлом', () => {
		const bad = urls.filter((url) => !/^https:\/\//.test(url) || /\/[^/.]+$/.test(url));
		expect(bad, `адреса без схеми або без кінцевого слеша (редирект): ${bad.join(', ')}`).toEqual(
			[]
		);
	});
});
