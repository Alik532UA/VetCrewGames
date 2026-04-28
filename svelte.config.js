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
				'script-src': ['self', 'unsafe-inline', 'https://plausible.io'],
				'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
				'font-src': ['self', 'https://fonts.gstatic.com'],
				'connect-src': ['self', 'https://*.sentry.io', 'https://plausible.io']
			}
		},
		paths: {
			base: process.env.NODE_ENV === 'production' ? '/VetCrewGames' : ''
		}
	}
};

export default config;
