/**
 * Генератор картки для соцмереж: `static/images/og-cover.png`, 1200×630.
 *
 * ЧОМУ ЦЕЙ СКРИПТ ІСНУЄ. У `og:image` стояв `images/VetCrewGames_logo_v1.png` —
 * 200×200, 3,2 КБ. SEO-v9 § 4.2 вимагає ≥ 1200×630, і причина не косметична:
 * сторінка оголошує `twitter:card = summary_large_image`, а велика картка має
 * власну нижню межу розміру. Зображення 200×200 у неї не проходить — картка
 * тихо вироджується у варіант без картинки. Побачити це можна лише в чужому
 * месенджері, тобто ніколи не побачити самому.
 *
 * ЧОМУ ГЕНЕРАТОР, А НЕ ГОТОВИЙ ФАЙЛ. Джерело логотипа — вектор
 * (`static/svg/VetCrewGames_logo_v1.svg`, 908 байтів геометрії), і він
 * масштабується без утрат. Тримати поруч ще один растр, домальований руками,
 * означало б два джерела правди про те, як виглядає логотип.
 *
 * ЧОМУ НЕ ЧАСТИНА `npm run build`. Результат КОМІТИТЬСЯ, а не збирається щоразу:
 * інакше `og:image` залежав би від наявності браузера Playwright на раннері, а
 * крок «Build does not modify tracked files» у CI червонів би від нового PNG.
 * Скрипт кличуть руками, коли змінюється логотип або підпис:
 *
 *     node scripts/make-og-image.mjs
 *
 * Розмір під гейтом: `check-build.mjs` читає IHDR готового PNG у `build/` і
 * валить збірку, якщо він менший за 1200×630. Тобто число живе в перевірці, а
 * не в цьому коментарі (`PIT-NUMBER-UNDER-GATE`).
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const WIDTH = 1200;
const HEIGHT = 630;
const OUT = 'static/images/og-cover.png';
const LOGO = 'static/svg/VetCrewGames_logo_v1.svg';

/*
 * Кольори взяті з ТЕМНОЇ теми (`styles/themes/dark.css`), а не підібрані:
 * картку бачать поза сайтом, і вона мусить виглядати як сайт. `--color-bg-panel-dark`
 * = #132510, `--color-bg-panel` = #2a3d1d. Світлий підпис — #f2f5ec, тобто
 * світлий бік `--color-bg`.
 *
 * Контраст #f2f5ec на #132510 — 14,6:1, тобто з великим запасом над AA. Тут це
 * не формальність: перегляд картки часто йде в мініатюрі, де підпис ужимається
 * до двох десятків пікселів висоти.
 */
const logo = readFileSync(LOGO, 'utf8').replace(/width="\d+"\s+height="\d+"/, '');

const html = `<!doctype html>
<meta charset="utf-8" />
<style>
	*, *::before, *::after { box-sizing: border-box; }
	html, body { margin: 0; padding: 0; }
	body {
		width: ${WIDTH}px;
		height: ${HEIGHT}px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 56px;
		background: radial-gradient(circle at 30% 20%, #2a3d1d 0%, #132510 70%);
		font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
		color: #f2f5ec;
		overflow: hidden;
	}
	.logo { width: 300px; height: 300px; flex: none; }
	.logo svg { width: 100%; height: 100%; display: block; }
	.text { max-width: 620px; }
	h1 { margin: 0 0 18px; font-size: 82px; line-height: 1.02; letter-spacing: -0.02em; }
	p { margin: 0; font-size: 34px; line-height: 1.28; color: #cfe0b4; }
</style>
<div class="logo">${logo}</div>
<div class="text">
	<h1>Vet Crew Games</h1>
	<p>Освітні ігри про тварин: харчування, чисельність, поширені міфи</p>
</div>`;

const browser = await chromium.launch();
try {
	const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
	await page.setContent(html, { waitUntil: 'load' });
	const png = await page.screenshot({ type: 'png' });
	writeFileSync(OUT, png);

	// Розмір читається з готового файлу, а не з констант вище: перевіряється те,
	// що записано на диск, а не те, що просили записати.
	const bytes = readFileSync(OUT);
	const w = bytes.readUInt32BE(16);
	const h = bytes.readUInt32BE(20);
	console.log(`make-og-image: ${OUT} — ${w}×${h}, ${(bytes.length / 1024).toFixed(1)} КБ`);
	if (w < 1200 || h < 630) {
		console.error(`make-og-image: ${w}×${h} менше за 1200×630 — велика картка це відкине`);
		process.exit(1);
	}
} finally {
	await browser.close();
}
