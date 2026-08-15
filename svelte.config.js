import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

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
				// gtag.js is injected at runtime by the analytics service; without
				// this the browser blocks it and analytics silently never starts.
				'script-src': ['self', 'unsafe-inline', 'https://www.googletagmanager.com'],
				'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
				'font-src': ['self', 'https://fonts.gstatic.com'],
				// ...and without these the beacons themselves are blocked, so the
				// script would load and then fail to report anything.
				'connect-src': [
					'self',
					'https://*.sentry.io',
					'https://www.googletagmanager.com',
					'https://*.google-analytics.com',
					'https://*.analytics.google.com'
				],
				// `data:` — для інлайнових SVG-іконок і піктограм, вбудованих у CSS.
				// Зовнішніх джерел зображень проєкт не має, тож `https:` тут зайвий.
				'img-src': ['self', 'data:'],
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
