/**
 * ОФЛАЙН І ОНОВЛЕННЯ — логіка service worker, винесена з `src/service-worker.ts`, щоб її
 * перевіряв тест без браузера: `caches`, `fetch` і фонова робота приходять параметром.
 *
 * ## Головне правило: кеш — прискорення, а не джерело правди
 *
 * Сторінки — МЕРЕЖЕЮ спершу, і з `no-cache`: сервер питається щоразу, а 304 коштує лише
 * заголовки. Тому нова версія приходить першим же завантаженням. Саме тут PWA зазвичай і
 * «оновлюються лише після перевстановлення»: воркер віддає стару оболонку зі свого кешу,
 * доки живе хоч одна вкладка, а застосунок із початкового екрана живе завжди. Кеш сторінки
 * читається лише тоді, коли мережі немає (або вона мовчить довше за `timeoutMs`).
 *
 * Незмінні файли збірки (`_app/immutable/…`, імʼя — хеш вмісту) — з кешу спершу: такий
 * файл не старіє за визначенням. Статика (`static/`: картинки, прапори, шрифти) — з кешу
 * одразу й оновлюється позаду: імʼя в неї стале, а вміст — ні.
 *
 * Не чіпається зовсім: чужі адреси (Firebase, аналітика, прапор за IP), не-GET, запити з
 * `Range` і файли версії — за ними SvelteKit і службове табло дізнаються про нову збірку,
 * і кешована відповідь казала б «нової немає» (`NEVER_CACHED`).
 *
 * ## Спільний origin
 *
 * `alik532ua.github.io` ділять кілька проєктів, і `caches.keys()` віддає кеші ВСІХ. Тут
 * видаляються лише імена з `CACHE_PREFIX` — він починається з `PREFIX` сховища, тож
 * аварійне скидання (`services/resetService.ts`) стирає й їх. Сусід, що зітре наш кеш,
 * забере лише офлайн: мережею все працює й без нього.
 */

/** Префікс кешів воркера — у межах `PREFIX` сховища (`vetcrewgames_`), звіряє тест. */
export const CACHE_PREFIX = 'vetcrewgames_sw_';

export const cacheName = (version: string) => `${CACHE_PREFIX}${version}`;

/** Файли, про які треба питати сервер щоразу: за ними видно нову збірку. */
const NEVER_CACHED = [
	'/_app/version.json',
	'/app-version.json',
	'/robots.txt',
	'/llms.txt',
	'/sitemap.xml'
];

/** Статика, що потрібна вже першому кадру офлайн, — кладеться під час встановлення. */
const SHELL_FILE = /^\/(fonts\/|icons\/|favicon\.svg$|manifest\.webmanifest$)/;

/** Що з `<head>` стартової сторінки потрібно, щоб вона піднялася без мережі. */
const ASSET_REL = /\brel="(?:modulepreload|stylesheet|preload|icon|apple-touch-icon|manifest)"/;

/** Збірка, яку обслуговує воркер (`$service-worker`). Шляхи — вже з `base`. */
export interface Release {
	base: string;
	version: string;
	build: readonly string[];
	files: readonly string[];
	prerendered: readonly string[];
}

export interface WorkerEnv {
	caches: CacheStorage;
	fetch: (input: string, init?: RequestInit) => Promise<Response>;
	/** Скільки чекати мережу, коли є що віддати з кешу. */
	timeoutMs?: number;
}

/** Запит, яким його бачить воркер: достатньо полів, щоб тест обійшовся без `navigate`. */
export type WorkerRequest = Pick<Request, 'url' | 'method' | 'mode' | 'cache'> & {
	headers: Pick<Headers, 'has'>;
};

export type Kind = 'fresh' | 'immutable' | 'static' | 'pass';

/** Робота, що доживає після відповіді (`event.waitUntil` САМЕ ЦЬОГО запиту). */
export type Later = (work: Promise<unknown>) => void;

export function createWorker(release: Release, env: WorkerEnv) {
	/*
	 * `root` — абсолютний шлях збірки з `$service-worker` (його рахують від `location` воркера),
	 * а не `base` з `$app/paths`, який під час prerender відносний і який стереже гейт
	 * `structure.test.ts` («шлях не склеюється з `base`»). Воркер не пререндериться ніколи.
	 */
	const root = release.base;
	const name = cacheName(release.version);
	const build = new Set(release.build);
	const files = new Set(release.files);
	/** Стартові сторінки: корінь і домівка кожної мови (`/en/`, `/de/`…). */
	const starts = [
		`${root}/`,
		...release.prerendered.filter((path) => new RegExp(`^${root}/[a-z]{2}/$`).test(path))
	];

	function kindOf(request: WorkerRequest, origin: string): Kind {
		if (request.method !== 'GET' || request.headers.has('range')) return 'pass';
		const url = new URL(request.url);
		if (url.origin !== origin || !url.pathname.startsWith(`${root}/`)) return 'pass';
		const path = url.pathname.slice(root.length);
		if (NEVER_CACHED.includes(path)) return 'pass';
		if (path.startsWith('/_app/immutable/')) return 'immutable';
		if (request.mode === 'navigate' || path.endsWith('/') || path === '/_app/env.js') {
			return 'fresh';
		}
		return files.has(url.pathname) ? 'static' : 'pass';
	}

	/**
	 * У кеш — лише цілий 200-й. Переадресований НЕ кладеться: віддати його потім навігації
	 * браузер відмовиться («redirected response … redirect mode is not follow») — тобто
	 * офлайн така сторінка не відкрилась би взагалі. Непрозорі відповіді мають статус 0 і
	 * відсіюються тим самим `ok`.
	 */
	async function store(cache: Cache, url: string, response: Response): Promise<Response> {
		if (response.ok && !response.redirected) await cache.put(url, response.clone());
		return response;
	}

	/** Домівка тієї мови, якою відкрито сторінку: сюди веде офлайн без кешованої сторінки. */
	const homeFor = (path: string) =>
		starts.filter((start) => path.startsWith(start)).sort((a, b) => b.length - a.length)[0];

	async function offline(request: WorkerRequest, cache: Cache): Promise<Response> {
		const url = new URL(request.url);
		const home = homeFor(url.pathname);
		if (request.mode === 'navigate' && home && home !== url.pathname && (await cache.match(home))) {
			return Response.redirect(new URL(home, url).href, 302);
		}
		return Response.error();
	}

	async function fresh(cache: Cache, request: WorkerRequest, later: Later): Promise<Response> {
		const mode =
			request.cache === 'reload' || request.cache === 'no-store' ? request.cache : 'no-cache';
		const network = env
			.fetch(request.url, {
				cache: mode,
				credentials: 'same-origin',
				redirect: request.mode === 'navigate' ? 'manual' : 'follow'
			})
			.then((response) => store(cache, request.url, response));
		const cached = await cache.match(request.url, { ignoreSearch: true });
		if (!cached) return network.catch(() => offline(request, cache));
		const settled = network.catch(() => cached);
		later(settled);
		const timeout = new Promise<Response>((resolve) =>
			setTimeout(() => resolve(cached), env.timeoutMs ?? 5_000)
		);
		return Promise.race([settled, timeout]);
	}

	async function respond(
		kind: Exclude<Kind, 'pass'>,
		request: WorkerRequest,
		later: Later
	): Promise<Response> {
		const cache = await env.caches.open(name);
		if (kind === 'fresh') return fresh(cache, request, later);
		const cached = await cache.match(request.url);
		const network = () => env.fetch(request.url).then((r) => store(cache, request.url, r));
		if (!cached) return network();
		if (kind === 'static') later(network().catch(() => undefined));
		return cached;
	}

	/** Файли, на які показує `<head>` стартової сторінки: скрипти, стилі, значки. */
	function linkedAssets(html: string, page: string): string[] {
		const found: string[] = [];
		for (const [tag] of html.matchAll(/<link\b[^>]*>|<img\b[^>]*>/g)) {
			if (tag.startsWith('<link') && !ASSET_REL.test(tag)) continue;
			const ref = tag.match(/\b(?:href|src)="([^"]+)"/)?.[1];
			if (ref) found.push(ref);
		}
		for (const [, ref] of html.matchAll(/\bimport\("([^"]+)"\)/g)) found.push(ref);
		return found
			.map((ref) => new URL(ref, new URL(page, 'https://origin.invalid')))
			.filter(
				(url) => url.origin === 'https://origin.invalid' && url.pathname.startsWith(`${root}/`)
			)
			.map((url) => url.pathname);
	}

	/** Незмінені файли — з кешів попередніх збірок: імʼя-хеш те саме, отже й вміст. */
	async function carryOver(cache: Cache): Promise<void> {
		for (const key of await env.caches.keys()) {
			if (!key.startsWith(CACHE_PREFIX) || key === name) continue;
			const old = await env.caches.open(key);
			for (const request of await old.keys()) {
				const path = new URL(request.url).pathname;
				if (!build.has(path) && !files.has(path)) continue;
				const response = await old.match(request);
				if (response) await cache.put(request.url, response);
			}
		}
	}

	/**
	 * Встановлення: стартові сторінки й усе, що їм потрібно, щоб піднятися офлайн.
	 *
	 * Або ціле, або ніяк: якщо щось не завантажилось, встановлення падає, і браузер повторює
	 * його пізніше, а тим часом працює попередній воркер — мережею він віддає ту саму нову
	 * версію. Половинчастий кеш дав би сторінку, що офлайн падає на першому ж скрипті.
	 */
	async function install(): Promise<void> {
		const cache = await env.caches.open(name);
		await carryOver(cache);
		const shell = new Set([...files].filter((path) => SHELL_FILE.test(path.slice(root.length))));
		shell.add(`${root}/_app/env.js`);
		for (const start of starts) {
			const response = await env.fetch(start, { cache: 'no-cache', credentials: 'same-origin' });
			if (!response.ok) throw new Error(`стартова сторінка ${start}: ${response.status}`);
			for (const path of linkedAssets(await response.clone().text(), start)) shell.add(path);
			await cache.put(start, response);
		}
		const missing: string[] = [];
		for (const path of shell) if (!(await cache.match(path))) missing.push(path);
		const loaded = await Promise.all(
			missing.map(async (path) => {
				const response = await env.fetch(path, { credentials: 'same-origin' });
				if (!response.ok) throw new Error(`${path}: ${response.status}`);
				return [path, response] as const;
			})
		);
		for (const [path, response] of loaded) await cache.put(path, response);
	}

	/** Активація: кеші попередніх збірок — ЛИШЕ свої, за префіксом. */
	async function activate(): Promise<void> {
		for (const key of await env.caches.keys()) {
			if (key.startsWith(CACHE_PREFIX) && key !== name) await env.caches.delete(key);
		}
	}

	return { kindOf, respond, install, activate, linkedAssets };
}
