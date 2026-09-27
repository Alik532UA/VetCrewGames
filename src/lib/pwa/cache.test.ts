// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PREFIX } from '$lib/services/storage';
import { CACHE_PREFIX, cacheName, createWorker, type Release, type WorkerRequest } from './cache';

/**
 * Логіка service worker без браузера: `caches` і `fetch` — підставні, у памʼяті.
 *
 * Перевіряються саме ті рішення, від яких залежить «оновлюється без перевстановлення» і
 * «спільний origin цілий»: сторінка мережею спершу, файли версії повз кеш, чужі кеші
 * недоторкані, встановлення або ціле, або ніяке.
 */

const ORIGIN = 'https://alik532ua.github.io';
const BASE = '/VetCrewGames';

const release: Release = {
	base: BASE,
	version: '2',
	build: [`${BASE}/_app/immutable/entry/start.A.js`, `${BASE}/_app/immutable/assets/0.B.css`],
	files: [
		`${BASE}/favicon.svg`,
		`${BASE}/fonts/inglobal.woff2`,
		`${BASE}/images/animals/cat.webp`,
		`${BASE}/app-version.json`,
		// У справжньому переліку статики його немає (він із `_app/`, а не зі `static/`), і
		// саме тому він тут: якби SvelteKit колись його туди поклав, воркер однаково не кешує.
		`${BASE}/_app/version.json`,
		`${BASE}/manifest.webmanifest`
	],
	prerendered: [`${BASE}/`, `${BASE}/en/`, `${BASE}/game-family/`, `${BASE}/en/game-family/`]
};

/**
 * Голова стартової сторінки, як її пише пререндер: шляхи ВІДНОСНІ до самої сторінки —
 * `./` у корені й `../` на `/en/` (звірено з `build/en/index.html`).
 */
const homeHtml = (up: string) =>
	[
		`<link href="${up}_app/immutable/entry/start.A.js" rel="modulepreload">`,
		`<link href="${up}_app/immutable/assets/0.B.css" rel="stylesheet">`,
		'<link rel="alternate" hreflang="en" href="https://alik532ua.github.io/VetCrewGames/en/">',
		`<link rel="icon" href="${up}favicon.svg"/>`,
		`<img src="${up}images/animals/cat.webp" alt="">`,
		`<script>import("${up}_app/env.js")</script>`,
		`<a href="${up}game-family/">гра</a>`
	].join('\n');

class MemoryCache {
	readonly entries = new Map<string, Response>();
	static key(input: RequestInfo | URL, ignoreSearch = false) {
		const url = new URL(input instanceof Request ? input.url : String(input), ORIGIN);
		if (ignoreSearch) url.search = '';
		return url.href;
	}
	async match(input: RequestInfo | URL, options?: CacheQueryOptions) {
		const wanted = MemoryCache.key(input, options?.ignoreSearch);
		for (const [key, response] of this.entries) {
			if (MemoryCache.key(key, options?.ignoreSearch) === wanted) return response.clone();
		}
		return undefined;
	}
	async put(input: RequestInfo | URL, response: Response) {
		this.entries.set(MemoryCache.key(input), response);
	}
	async keys() {
		return [...this.entries.keys()].map((url) => new Request(url));
	}
}

class MemoryCaches {
	readonly stores = new Map<string, MemoryCache>();
	async open(name: string) {
		if (!this.stores.has(name)) this.stores.set(name, new MemoryCache());
		return this.stores.get(name)!;
	}
	async keys() {
		return [...this.stores.keys()];
	}
	async delete(name: string) {
		return this.stores.delete(name);
	}
	async has(name: string) {
		return this.stores.has(name);
	}
	async match() {
		return undefined;
	}
}

type Route = () => Response | Promise<Response>;

/** Підставна мережа: `routes` за шляхом; без маршруту — 404; `offline` — обрив. */
function setup(routes: Record<string, Route> = {}) {
	const caches = new MemoryCaches();
	const calls: { url: string; init?: RequestInit }[] = [];
	const net = { offline: false };
	const fetch = async (input: string, init?: RequestInit) => {
		calls.push({ url: input, init });
		if (net.offline) throw new TypeError('Failed to fetch');
		const path = new URL(input, ORIGIN).pathname;
		return routes[path]?.() ?? new Response('нема', { status: 404 });
	};
	const later: Promise<unknown>[] = [];
	const worker = createWorker(release, {
		caches: caches as unknown as CacheStorage,
		fetch,
		timeoutMs: 20
	});
	const respond = (kind: Parameters<typeof worker.respond>[0], request: WorkerRequest) =>
		worker.respond(kind, request, (work) => later.push(work));
	return { caches, calls, net, worker, respond, later };
}

const html = (body: string) => () =>
	new Response(body, { headers: { 'content-type': 'text/html' } });

function request(path: string, init: Partial<WorkerRequest> = {}): WorkerRequest {
	return {
		url: path.startsWith('http') ? path : `${ORIGIN}${path}`,
		method: 'GET',
		mode: 'cors',
		cache: 'default',
		headers: new Headers(),
		...init
	};
}

const current = (caches: MemoryCaches) => caches.stores.get(cacheName(release.version))!;

describe('що воркер бере на себе', () => {
	const { worker } = setup();
	const kind = (path: string, init?: Partial<WorkerRequest>) =>
		worker.kindOf(request(path, init), ORIGIN);

	it('сторінки й `_app/env.js` — мережею спершу', () => {
		expect(kind(`${BASE}/`)).toBe('fresh');
		expect(kind(`${BASE}/en/game-family/`)).toBe('fresh');
		expect(kind(`${BASE}/game-family`, { mode: 'navigate' })).toBe('fresh');
		expect(kind(`${BASE}/_app/env.js`)).toBe('fresh');
	});

	it('файли збірки — незмінні, статика — своя, решта не чіпається', () => {
		expect(kind(`${BASE}/_app/immutable/entry/start.A.js`)).toBe('immutable');
		expect(kind(`${BASE}/images/animals/cat.webp`)).toBe('static');
		expect(kind(`${BASE}/images/animals/nobody.webp`)).toBe('pass');
	});

	it('файли версії — ПОВЗ кеш: за ними видно нову збірку', () => {
		expect(kind(`${BASE}/_app/version.json`)).toBe('pass');
		expect(kind(`${BASE}/app-version.json`)).toBe('pass');
	});

	it('чуже, не-GET, `Range` і поза `base` — не чіпається', () => {
		expect(kind('https://api.country.is/')).toBe('pass');
		expect(kind('https://x.firebasedatabase.app/.lp?id=1')).toBe('pass');
		expect(kind(`${BASE}/`, { method: 'POST' })).toBe('pass');
		expect(
			kind(`${BASE}/fonts/inglobal.woff2`, { headers: new Headers({ range: 'bytes=0-1' }) })
		).toBe('pass');
		expect(kind('/Slovko/')).toBe('pass');
	});
});

describe('сторінка — мережею спершу', () => {
	it('з мережі, свіжою (`no-cache`), і кладеться в кеш', async () => {
		const { respond, calls, caches } = setup({ [`${BASE}/`]: html('нова') });
		const response = await respond('fresh', request(`${BASE}/`));
		expect(await response.text()).toBe('нова');
		expect(calls[0].init?.cache).toBe('no-cache');
		expect(await (await current(caches).match(`${BASE}/`))?.text()).toBe('нова');
	});

	it('«Оновити» лишає свій `reload`, навігація — переадресацію вручну', async () => {
		const { respond, calls } = setup({ [`${BASE}/`]: html('x') });
		await respond('fresh', request(`${BASE}/`, { cache: 'reload' }));
		await respond('fresh', request(`${BASE}/`, { mode: 'navigate' }));
		expect(calls.map((call) => [call.init?.cache, call.init?.redirect])).toEqual([
			['reload', 'follow'],
			['no-cache', 'manual']
		]);
	});

	it('стара копія в кеші НЕ перемагає мережу', async () => {
		const setupResult = setup({ [`${BASE}/`]: html('нова') });
		await (await setupResult.caches.open(cacheName('2'))).put(`${BASE}/`, new Response('стара'));
		const response = await setupResult.respond('fresh', request(`${BASE}/`));
		expect(await response.text()).toBe('нова');
	});

	it('без мережі — з кешу, і `?lang=` у адресі не заважає', async () => {
		const { respond, caches, net } = setup();
		await (await caches.open(cacheName('2'))).put(`${BASE}/game-family/`, new Response('гра'));
		net.offline = true;
		const response = await respond('fresh', request(`${BASE}/game-family/?lang=en`));
		expect(await response.text()).toBe('гра');
	});

	it('без мережі й без копії — на домівку своєї мови, а якщо й її нема — помилка', async () => {
		const { respond, caches, net } = setup();
		net.offline = true;
		await (await caches.open(cacheName('2'))).put(`${BASE}/en/`, new Response('home'));
		const moved = await respond('fresh', request(`${BASE}/en/game-family/`, { mode: 'navigate' }));
		expect([moved.status, moved.headers.get('location')]).toEqual([302, `${ORIGIN}${BASE}/en/`]);
		const lost = await respond('fresh', request(`${BASE}/game-family/`, { mode: 'navigate' }));
		expect(lost.type).toBe('error');
	});

	it('404 з сервера — як є і не в кеш', async () => {
		const { respond, caches } = setup();
		const response = await respond('fresh', request(`${BASE}/missing/`));
		expect(response.status).toBe(404);
		expect(await current(caches).match(`${BASE}/missing/`)).toBeUndefined();
	});

	it('мережа мовчить — копія з кешу, а свіжа все одно доїде в кеш', async () => {
		const { respond, caches, later } = setup({
			[`${BASE}/`]: () =>
				new Promise((resolve) => setTimeout(() => resolve(new Response('пізня')), 60))
		});
		await (await caches.open(cacheName('2'))).put(`${BASE}/`, new Response('копія'));
		const response = await respond('fresh', request(`${BASE}/`));
		expect(await response.text()).toBe('копія');
		await Promise.all(later);
		expect(await (await current(caches).match(`${BASE}/`))?.text()).toBe('пізня');
	});
});

describe('файли збірки й статика', () => {
	it('незмінний файл із кешу — без мережі взагалі', async () => {
		const { respond, caches, calls } = setup();
		const path = `${BASE}/_app/immutable/entry/start.A.js`;
		await (await caches.open(cacheName('2'))).put(path, new Response('код'));
		expect(await (await respond('immutable', request(path))).text()).toBe('код');
		expect(calls).toEqual([]);
	});

	it('статика з кешу одразу, а позаду оновлюється', async () => {
		const path = `${BASE}/images/animals/cat.webp`;
		const { respond, caches, later } = setup({ [path]: () => new Response('нова') });
		await (await caches.open(cacheName('2'))).put(path, new Response('стара'));
		expect(await (await respond('static', request(path))).text()).toBe('стара');
		await Promise.all(later);
		expect(await (await current(caches).match(path))?.text()).toBe('нова');
	});
});

describe('встановлення', () => {
	const routes = {
		[`${BASE}/`]: html(homeHtml('./')),
		[`${BASE}/en/`]: html(homeHtml('../')),
		[`${BASE}/_app/immutable/entry/start.A.js`]: () => new Response('js'),
		[`${BASE}/_app/immutable/assets/0.B.css`]: () => new Response('css'),
		[`${BASE}/_app/env.js`]: () => new Response('env'),
		[`${BASE}/favicon.svg`]: () => new Response('svg'),
		[`${BASE}/fonts/inglobal.woff2`]: () => new Response('font'),
		[`${BASE}/manifest.webmanifest`]: () => new Response('{}'),
		[`${BASE}/images/animals/cat.webp`]: () => new Response('img')
	};

	it('кладе стартові сторінки всіх мов і все, що потрібне їм офлайн', async () => {
		const { worker, caches } = setup(routes);
		await worker.install();
		const paths = [...current(caches).entries.keys()].map((url) => new URL(url).pathname).sort();
		expect(paths).toEqual(
			[
				`${BASE}/`,
				`${BASE}/_app/env.js`,
				`${BASE}/_app/immutable/assets/0.B.css`,
				`${BASE}/_app/immutable/entry/start.A.js`,
				`${BASE}/en/`,
				`${BASE}/favicon.svg`,
				`${BASE}/fonts/inglobal.woff2`,
				`${BASE}/images/animals/cat.webp`,
				`${BASE}/manifest.webmanifest`
			].sort()
		);
	});

	it('стартові сторінки питає в сервера, а не в HTTP-кешу', async () => {
		const { worker, calls } = setup(routes);
		await worker.install();
		const starts = calls.filter((call) => call.url.endsWith('/'));
		expect(starts.map((call) => call.init?.cache)).toEqual(['no-cache', 'no-cache']);
	});

	it('незмінене з попередньої збірки переносить без мережі', async () => {
		const { worker, caches, calls } = setup(routes);
		const old = await caches.open(cacheName('1'));
		await old.put(`${BASE}/_app/immutable/entry/start.A.js`, new Response('старий-той-самий'));
		await old.put(`${BASE}/_app/immutable/entry/start.OLD.js`, new Response('зниклий'));
		await worker.install();
		expect(calls.some((call) => call.url.endsWith('start.A.js'))).toBe(false);
		const kept = await current(caches).match(`${BASE}/_app/immutable/entry/start.A.js`);
		expect(await kept?.text()).toBe('старий-той-самий');
		expect(
			await current(caches).match(`${BASE}/_app/immutable/entry/start.OLD.js`)
		).toBeUndefined();
	});

	it('без стартової сторінки чи файлу — падає цілком, а не кладе половину', async () => {
		const noPage = setup({ ...routes, [`${BASE}/en/`]: () => new Response('', { status: 503 }) });
		await expect(noPage.worker.install()).rejects.toThrow('/en/');
		const noAsset = setup({
			...routes,
			[`${BASE}/_app/env.js`]: () => new Response('', { status: 404 })
		});
		await expect(noAsset.worker.install()).rejects.toThrow('env.js');
		const offline = setup(routes);
		offline.net.offline = true;
		await expect(offline.worker.install()).rejects.toThrow();
	});
});

describe('активація й спільний origin', () => {
	it('стирає лише СВОЇ старі кеші; сусідів і поточний не чіпає', async () => {
		const { worker, caches } = setup();
		for (const name of [
			cacheName('1'),
			cacheName('2'),
			'slovko-cache-7',
			'mindstep-v3',
			'workbox-precache'
		]) {
			await caches.open(name);
		}
		await worker.activate();
		expect((await caches.keys()).sort()).toEqual(
			[cacheName('2'), 'mindstep-v3', 'slovko-cache-7', 'workbox-precache'].sort()
		);
	});

	it('префікс кешів — у межах префікса сховища: аварійне скидання стирає й їх', () => {
		expect(CACHE_PREFIX.startsWith(PREFIX)).toBe(true);
	});
});
