// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import config from '../svelte.config.js';

/**
 * PWA: рішення, від яких залежить «оновлюється без перевстановлення».
 *
 * Кожне з них ламається одним рядком і тихо: застосунок далі встановлюється й відкривається,
 * а оновлення знову перестає доходити. Звідси перевірка по джерелах — поведінку тримають
 * `lib/pwa/cache.test.ts`, `lib/pwa/register.test.ts` і e2e `tests/pwa.spec.ts`.
 */

const read = (path: string) => readFileSync(path, 'utf8');

interface Icon {
	src: string;
	sizes: string;
	type: string;
	purpose: string;
}

const manifest = JSON.parse(read('static/manifest.webmanifest')) as Record<string, unknown> & {
	icons: Icon[];
};

/** Розмір і наявність альфи — з заголовка PNG (IHDR), без бібліотек. */
function png(path: string) {
	const bytes = readFileSync(path);
	expect(bytes.subarray(1, 4).toString(), `${path} — не PNG`).toBe('PNG');
	return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), alpha: bytes[25] >= 4 };
}

describe('маніфест', () => {
	/*
	 * ВІДНОСНІ `id`, `start_url` і `scope` — це і є «той самий застосунок після оновлення».
	 * Браузер упізнає встановлений застосунок за `id` (а без нього — за `start_url`), і
	 * адреса з версією чи з `?source=` дала б НОВИЙ застосунок на кожному деплої. `./` від
	 * маніфесту — це `/VetCrewGames/` на Pages і `/` локально, тобто однаково в обох світах.
	 */
	it('ідентичність — стала й відносна: те саме встановлення після кожного деплою', () => {
		expect([manifest.id, manifest.start_url, manifest.scope]).toEqual(['./', './', './']);
		expect(manifest.display).toBe('standalone');
		expect(manifest.name).toBeTruthy();
		expect(manifest.short_name).toBeTruthy();
	});

	it('кожен значок лежить у `static/` і має саме той розмір, що заявлено', () => {
		for (const icon of manifest.icons) {
			const { width, height } = png(join('static', icon.src));
			expect(`${width}x${height}`, icon.src).toBe(icon.sizes);
			expect(icon.type).toBe('image/png');
		}
		const has = (sizes: string, purpose: string) =>
			manifest.icons.some((icon) => icon.sizes === sizes && icon.purpose === purpose);
		expect([has('192x192', 'any'), has('512x512', 'any'), has('512x512', 'maskable')]).toEqual([
			true,
			true,
			true
		]);
	});
});

describe('сторінка', () => {
	const html = read('src/app.html');

	it('посилається на маніфест і значок початкового екрана через `%sveltekit.assets%`', () => {
		expect(html).toContain(
			'<link rel="manifest" href="%sveltekit.assets%/manifest.webmanifest" />'
		);
		expect(html).toContain(
			'<link rel="apple-touch-icon" href="%sveltekit.assets%/icons/apple-touch-icon.png" />'
		);
	});

	/* Прозорість iOS заливає ЧОРНИМ — коричнева мордочка на чорному зникла б. */
	it('значок iPhone — 180×180 і непрозорий', () => {
		expect(png('static/icons/apple-touch-icon.png')).toEqual({
			width: 180,
			height: 180,
			alpha: false
		});
	});
});

describe('воркер і його реєстрація', () => {
	/*
	 * Зворотний експеримент: прибрати `skipWaiting()` — новий воркер чекає, доки закриють усі
	 * вкладки, а застосунок із початкового екрана не закривається ніколи. Рівно той дефект,
	 * через який автор перевстановлював застосунок.
	 */
	it('нова збірка бере керування одразу: `skipWaiting` і `clients.claim`', () => {
		const worker = read('src/service-worker.ts');
		expect(worker).toMatch(/sw\.skipWaiting\(\)/);
		expect(worker).toMatch(/sw\.clients\.claim\(\)/);
	});

	it('реєстрація — вручну, лише в зібраному сайті, файл воркера щоразу з сервера', () => {
		expect(config.kit?.serviceWorker?.register).toBe(false);
		expect(read('src/lib/pwa/register.ts')).toMatch(/updateViaCache: 'none'/);
		expect(read('src/hooks.client.ts')).toMatch(
			/if \(!dev\) \{\s*void import\('\$lib\/pwa\/register'\)/
		);
	});

	/*
	 * `caches.keys()` віддає кеші ВСЬОГО origin, тобто й сусідніх проєктів акаунта. Кожен
	 * виклик мусить фільтрувати за своїм префіксом — і тому місць, де він стоїть, рівно
	 * стільки, скільки перелічено тут. Нове місце — свідомий рядок у цьому переліку.
	 */
	it('`caches.keys()` — лише там, де фільтр за префіксом уже перевірено', () => {
		const walk = (dir: string): string[] =>
			readdirSync(dir).flatMap((name) => {
				const path = join(dir, name).split('\\').join('/');
				if (statSync(path).isDirectory()) return walk(path);
				return /\.(ts|svelte)$/.test(path) && !path.endsWith('.test.ts') ? [path] : [];
			});
		const callers = walk('src').filter((file) => /caches\.keys\(\)/.test(read(file)));
		expect(callers.sort()).toEqual(['src/lib/pwa/cache.ts', 'src/lib/services/resetService.ts']);
	});
});
