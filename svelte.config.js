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
				]
			}
		},
		paths: {
			base: process.env.NODE_ENV === 'production' ? '/VetCrewGames' : ''
		}
	}
};

export default config;
