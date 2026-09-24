import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

/**
 * КОНТРАКТ ТРАНСПОРТУ — над емулятором, окремим прогоном.
 *
 * Уся спільна партія перевіряється на `LocalRoom`, кімнаті в памʼяті, і доти
 * ніщо не доводило, що вона поводиться як справжній `rtdbRoom` зі справжніми
 * правилами бази. А розходились вони вже тричі (реванш без `startedAt`, відлік,
 * що не гас, пропущене членство) — і щоразу тести на підставці були зеленими на
 * поведінці, якої в продакшні немає.
 *
 * Тут ті самі сценарії йдуть по ОБОХ реалізаціях, і відповідь мусить збігтися.
 * Запускає це `npm run check:rules` у тому самому запуску емулятора, що й
 * перевірку правил: другий старт емулятора в одному джобі — це порт 9010, який
 * лишається зайнятим (AGENTS.md, «Команди перевірки»).
 *
 * Звичайний `npm test` цих файлів не бере (`exclude` у `vitest.config.ts`): без
 * емулятора їм нікуди йти, а мережа там заблокована взагалі.
 */
export default defineConfig({
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
		include: ['src/**/*.emulator.test.ts'],
		environment: 'jsdom',
		globals: true,
		// Мережа — лише до емулятора на цій машині (`src/emulator-only.setup.ts`).
		setupFiles: ['src/emulator-only.setup.ts'],
		// Справжня база: підписка й відповідь правила — це мережа, а не мікрозадачі.
		testTimeout: 30_000,
		// Один файл, один емулятор: паралельні воркери лише ділили б ті самі порти.
		fileParallelism: false
	}
});
