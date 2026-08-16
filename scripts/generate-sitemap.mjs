/**
 * Генерація `build/sitemap.xml` (SEO-v8 § 5). Запускається ПІСЛЯ `vite build`.
 *
 * Джерело — не перелік маршрутів у коді, а **самі згенеровані сторінки**: у
 * кожної вже є `<link rel="canonical">` і набір `hreflang`, які будує той
 * самий модуль політики адрес. Тобто sitemap за побудовою не може розійтися
 * ні зі сторінками, ні між мовами — а рукописний розходився одразу двічі:
 * знав лише українські адреси й писав їх БЕЗ кінцевого слеша, хоча
 * `trailingSlash: 'always'`, тож кожен рядок був редиректом
 * (SVELTEKIT-DATA-v8 § 2.4).
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BUILD = 'build';

function htmlFiles(dir, out = []) {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) htmlFiles(full, out);
		else if (entry === 'index.html') out.push(full.replace(/\\/g, '/'));
	}
	return out;
}

const pages = [];
for (const file of htmlFiles(BUILD)) {
	const html = readFileSync(file, 'utf8');
	const canonical = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/)?.[1];
	if (!canonical) continue;

	const alternates = [...html.matchAll(/<link[^>]+rel="alternate"[^>]+hreflang="([^"]+)"[^>]+href="([^"]+)"/g)]
		.map((m) => ({ lang: m[1], href: m[2] }))
		// `x-default` дублює типову мову: у sitemap він зайвий, там перелічують
		// самі адреси, а не політику вибору.
		.filter((alt) => alt.lang !== 'x-default');

	/*
	 * Головна визначається за РОЗТАШУВАННЯМ файлу, а не за кількістю сегментів
	 * в адресі: `/VetCrewGames/en/` і `/VetCrewGames/game-population/` мають
	 * рівно по два сегменти, і рахунком їх не розрізнити. Перша спроба саме на
	 * цьому й помилилася — ігрові сторінки отримали пріоритет головної.
	 */
	const dir = file.slice(BUILD.length + 1, -'/index.html'.length);
	const isHome = dir === '' || /^[a-z]{2}$/.test(dir);

	pages.push({ canonical, alternates, isHome });
}

if (pages.length === 0) {
	console.error('generate-sitemap: у build/ немає сторінок із canonical — збірки немає?');
	process.exit(1);
}

pages.sort((a, b) => a.canonical.localeCompare(b.canonical));

const urls = pages
	.map(({ canonical, alternates, isHome }) => {
		const links = alternates
			.map((alt) => `\t\t<xhtml:link rel="alternate" hreflang="${alt.lang}" href="${alt.href}" />`)
			.join('\n');
		// Головна важливіша за ігрові екрани — це єдина градація, яка тут має сенс.
		const priority = isHome ? '1.0' : '0.8';
		return `\t<url>\n\t\t<loc>${canonical}</loc>\n${links}\n\t\t<priority>${priority}</priority>\n\t</url>`;
	})
	.join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;

writeFileSync(join(BUILD, 'sitemap.xml'), xml);
console.log(`generate-sitemap: ${pages.length} адрес`);
