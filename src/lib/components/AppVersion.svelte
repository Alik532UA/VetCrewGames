<script lang="ts">
	import { dev } from '$app/environment';
	import { devPanel } from '$lib/services/devPanel.svelte';

	/**
	 * Номер версії в куті екрана — і вхід до службового меню в dev.
	 *
	 * Версія інжектується Vite на етапі збірки (VERSIONING-v8 § 2, підхід A): нуль
	 * мережевих запитів, синхронний доступ, і номер той самий, що у звіті логів та
	 * в `release` Sentry.
	 *
	 * Живе окремим компонентом, а не рядком у кореневому layout: layout уже стояв
	 * на межі розміру, а це самостійна накладка з власним місцем на екрані — як
	 * `LogCopyButton` поруч.
	 *
	 * Завжди `<button>`, а не `<button>` у dev і `<div>` у продакшні. Дві гілки
	 * означали б два елементи з одним `data-testid` в одному компоненті —
	 * анти-патерн, який ловить інваріант: тест, який шукає за цим id, отримав би
	 * два влучання й вибрав перше навмання. Клікабельність знімається стилем, а
	 * саме перемикання відсіює `devPanel.toggle()`: у продакшні воно нічого не
	 * робить, бо `dev` — константа збірки.
	 */
	const appVersion = __APP_VERSION__;
</script>

<button
	type="button"
	class="app-version text-panel text-panel--tight"
	class:app-version--dev={dev}
	onclick={() => devPanel.toggle()}
	data-testid="app-version-value"
>
	{appVersion}
</button>

<style>
	.app-version {
		position: fixed;
		bottom: 4px;
		right: 8px;
		border: 0;
		color: var(--color-text-muted);
		font: inherit;
		font-size: 10px;
		opacity: 0.5;
		/* Напис не має ловити кліки: під ним живий інтерфейс. */
		pointer-events: none;
		z-index: 1000;
	}

	/* У dev той самий напис стає кнопкою — разом із поверненням подій вказівника. */
	.app-version--dev {
		pointer-events: auto;
		cursor: pointer;
	}
</style>
