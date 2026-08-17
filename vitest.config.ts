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
		/**
		 * CODE-QUALITY-v8 § 6.2 — поріг покриття критичної логіки.
		 *
		 * Доти цей блок був оголошенням, а не гейтом: `npm test` не передавав
		 * `--coverage`, провайдера в залежностях не було, і поріг не тримав нічого.
		 * Стан був чесно записаний у PROJECT-CONTEXT.md як відхилення — саме тому
		 * його й було видно, і саме тому його закрито.
		 *
		 * `include` розширено з `services/**` до пари «контролери + сервіси», як і
		 * приписує канон. Це не послаблення: контролери — найбільша частина логіки
		 * проєкту, у кожного є тест поруч, і без них середнє рахувалося по семи
		 * файлах замість двадцяти.
		 *
		 * Поріг 70 — число канону, а не виміряне «щоб пройшло». Виміряно на момент
		 * увімкнення (`npx vitest run --coverage`, 2026-08-18): statements 84,62%,
		 * branches 75,77%, functions 87,78%, lines 86,32%. Запас є, і поріг лишається
		 * порогом, а не фотографією поточного стану.
		 */
		coverage: {
			include: ['src/lib/controllers/**', 'src/lib/services/**'],
			thresholds: { statements: 70, branches: 70 }
		}
	}
});
