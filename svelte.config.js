import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/**
 * Хеш анти-FOUC скрипта з `src/app.html`, обчислений із самого файлу під час
 * збірки (SECURITY-v8 § 6.3 і § 16).
 *
 * Рядком у конфігу він розійшовся б зі скриптом при першій же правці — і
 * зламав би сайт лише в режимі, де політика справді діє, тобто у збірці, а не
 * в dev. Тут розійтися нема з чим: джерело одне.
 *
 * Скрипт у `app.html` мусить лишатися ПІСЛЯ `%sveltekit.head%`: мета-політика
 * не поширюється на те, що стоїть вище за неї, і хеш для такого скрипта нічого
 * не захищає. Перевірка — `scripts/check-build.mjs`.
 *
 * `\r\n` → `\n` — не косметика, а умова того, що хеш узагалі збігається.
 * Парсер HTML нормалізує переводи рядків ще до того, як віддає тіло скрипта, і
 * CSP хешує вже нормалізований текст. На Windows-чекауті (`core.autocrlf`)
 * файл лежить із CRLF, тож хеш «як є» не збігається НІКОЛИ — браузер відхиляє
 * скрипт, тема на першому кадрі не застосовується, і жодна перевірка по
 * джерелах цього не бачить. Знайдено тут-таки: спершу цей рядок був без
 * `replace`, і Chrome попросив рівно той хеш, який дає нормалізований текст.
 */
const inlineScripts = [
	...readFileSync('src/app.html', 'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)
];
if (inlineScripts.length !== 1) {
	throw new Error(
		`app.html: очікувався рівно один інлайн-скрипт, знайдено ${inlineScripts.length}. ` +
			'Кожен потребує власного хеша в script-src (SECURITY-v8 § 6.3).'
	);
}
const inlineScriptHash = `sha256-${createHash('sha256')
	.update(inlineScripts[0][1].replace(/\r\n/g, '\n'))
	.digest('base64')}`;

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: '404.html',
			precompress: false,
			strict: true
		}),
		csp: {
			directives: {
				// Без `default-src` політика обмежує РІВНО перелічені типи ресурсів,
				// а решта лишається без обмежень узагалі — тобто `object-src`,
				// `base-uri` й `form-action` нижче доти не діяли ніяк. Це не той
				// самий стан, що «заборонено»: це відсутність правила
				// (SECURITY-v8 § 6.2).
				'default-src': ['self'],
				// `unsafe-inline` тут заборонений (SECURITY-v8 § 6.1), і його
				// відсутність робить більше, ніж видно з рядка: доки він стояв,
				// SvelteKit НЕ додавав хешів для власного bootstrap-скрипта — він
				// бачив, що інлайн і так дозволений. Тобто політика не покривала
				// жодного скрипта на сторінці.
				//
				// Далі — рівно два інлайн-скрипти, і кожен покритий:
				//   * анти-FOUC у app.html — хешем, обчисленим із файлу вище;
				//   * bootstrap SvelteKit — хешем, який додає сам SvelteKit.
				// gtag.js вантажиться з googletagmanager вже як зовнішній файл, і
				// без цього домену браузер його блокує, а аналітика мовчки не
				// стартує.
				'script-src': ['self', inlineScriptHash, 'https://www.googletagmanager.com'],
				// А тут `unsafe-inline` лишається свідомо: інлайнові `style="…"`
				// пише і Svelte (переходи fly/fade/slide), і `formatFont()` для
				// літер, яких немає в основному шрифті. Атрибути стилю хешами не
				// покриваються в принципі — для них існує лише `unsafe-hashes`,
				// який послабив би політику сильніше за сам `unsafe-inline`.
				'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
				'font-src': ['self', 'https://fonts.gstatic.com'],
				// ...and without these the beacons themselves are blocked, so the
				// script would load and then fail to report anything.
				'connect-src': [
					'self',
					'https://*.sentry.io',
					'https://www.googletagmanager.com',
					'https://*.google-analytics.com',
					'https://*.analytics.google.com',
					/*
					 * Спільна гра. Три записи, і кожен потрібен окремо:
					 *
					 *  * `wss://*.firebasedatabase.app` — Realtime Database тримає ПОСТІЙНЕ
					 *    зʼєднання вебсокетом, а не окремі запити. Без цього кімната
					 *    просто не відкривається, і в консолі стоїть відмова CSP;
					 *  * `https://*.firebasedatabase.app` — той самий шлях довгим
					 *    опитуванням: SDK сам падає на нього там, де вебсокет не пройшов
					 *    (корпоративні мережі, старі проксі);
					 *  * `https://*.googleapis.com` — анонімний вхід. Він іде звичайним
					 *    запитом до `identitytoolkit`, і без цього рядка кімната
					 *    відмовляла б у правах, хоч сама база була б доступна.
					 */
					'wss://*.firebasedatabase.app',
					'https://*.firebasedatabase.app',
					'https://*.googleapis.com'
				],
				// `data:` — для інлайнових SVG-іконок і піктограм, вбудованих у CSS.
				// Власних зовнішніх джерел зображень проєкт не має.
				//
				// googletagmanager — не картинка сторінки, а транспорт gtag.js: він
				// шле частину вимірювань запитом за зображенням `/td?id=…`. Без
				// цього рядка браузер пише `Refused to load the image…`, і видно це
				// ЛИШЕ в консолі зібраного сайту: розкладка ціла, збірка зелена,
				// тестам нема на що впасти (SECURITY-v8 § 6.2). Знайдено саме так —
				// відкриттям `npm run preview` і читанням консолі.
				'img-src': ['self', 'data:', 'https://www.googletagmanager.com'],
				// Три директиви, які без `default-src` вище не діяли зовсім:
				// заборона плагінів, заборона переписати базову адресу сторінки
				// (інакше відносні посилання можна відвести на чужий домен) і
				// заборона відправляти форми назовні.
				'object-src': ['none'],
				'base-uri': ['self'],
				'form-action': ['self']
			}
		},
		paths: {
			base: process.env.NODE_ENV === 'production' ? '/VetCrewGames' : ''
		}
	}
};

export default config;
