import { sentrySvelteKit } from '@sentry/sveltekit';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

/**
 * Плагін Sentry вмикається лише разом із DSN.
 *
 * Він робить дві речі, і без DSN жодна з них не має сенсу: вивантажує мапи (для
 * чого потрібен ще й `SENTRY_AUTH_TOKEN`, якого немає) і авто-інструментує
 * функції `load`. Друга річ не безкоштовна — у звіті збірки це
 * `sentry-auto-instrumentation load, 4186 викликів`, — і інструментує вона код
 * під трекер, який нікуди не пише.
 *
 * Умова та сама, що в `src/hooks.client.ts`: увімкнути трекер — це задати одну
 * змінну середовища, і плагін повертається разом із ним.
 */
const sentryEnabled = Boolean(process.env.PUBLIC_SENTRY_DSN);

export default defineConfig({
	plugins: [
		...(sentryEnabled
			? [
					sentrySvelteKit({
						sourceMapsUploadOptions: {
							org: 'vetcrewgames',
							project: 'vetcrewgames'
						}
					})
				]
			: []),
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
