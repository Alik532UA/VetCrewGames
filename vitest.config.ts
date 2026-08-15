import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

export default defineConfig({
	// Без `hot`: опції з такою назвою в плагіні більше немає, і кожен прогін
	// тестів починався з рядка `invalid plugin options "hot" in inline config`.
	// Попередження, яке бачать сто разів на день, навчає не читати вивід —
	// а саме у виводі й лежить те, заради чого тести запускають.
	plugins: [svelte()],
	resolve: {
		conditions: ['browser'],
		alias: {
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
			'$app/paths': fileURLToPath(new URL('./src/lib/mocks/app-paths.ts', import.meta.url)),
			'$app/environment': fileURLToPath(
				new URL('./src/lib/mocks/app-environment.ts', import.meta.url)
			)
		}
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'jsdom',
		globals: true,
		coverage: {
			include: ['src/lib/services/**'],
			thresholds: { statements: 70, branches: 70 }
		}
	}
});
