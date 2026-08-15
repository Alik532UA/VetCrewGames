import { sentrySvelteKit } from '@sentry/sveltekit';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
	plugins: [
		sentrySvelteKit({
			sourceMapsUploadOptions: {
				org: 'vetcrewgames',
				project: 'vetcrewgames'
			}
		}),
		sveltekit()
	],
	build: {
		/**
		 * Sentry-плагін вмикає `sourcemap: 'hidden'` за замовчуванням і збирався
		 * видалити мапи ПІСЛЯ вивантаження. Вивантаження не відбувається:
		 * `SENTRY_AUTH_TOKEN` немає ні локально, ні в workflow — плагін на кожній
		 * збірці про це попереджає. Отже, крок видалення не виконувався теж, і
		 * `build/` їхав на GitHub Pages разом із повними мапами: увесь вихідний
		 * код застосунку, доступний за прямим посиланням (OBSERVABILITY-v8 § 1.2:
		 * мапи вивантажуються в Sentry, а не публікуються).
		 *
		 * Явний `false` плагін поважає. Коли з'явиться токен — сюди повертається
		 * `'hidden'`, і мапи знову видалятимуться після вивантаження.
		 */
		sourcemap: false
	},
	define: {
		__APP_VERSION__: JSON.stringify(`v${pkg.version}`)
	}
});
