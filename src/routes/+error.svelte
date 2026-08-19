<script lang="ts">
	import { page } from '$app/state';
	import { t, formatFont } from '$lib/i18n';
	import { Home, RotateCcw } from 'lucide-svelte';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import '$lib/styles/global.css';
</script>

<div class="error-page">
	<div class="error-card">
		<h1 class="error-status">{page.status}</h1>
		<h2 class="error-title">{@html formatFont(t('error.title'))}</h2>
		<!--
			Текст — зі СЛОВНИКА, а не з `page.error.message`, і причин дві.

			Перша — безпека. Це `{@html}`, а `page.error.message` — єдине значення на
			сторінці, яке приходить не зі словника: його складає або фреймворк, або
			виклик `error(status, message)` у `load`. Інваріант у `src/security.test.ts`
			цього не ловив: він дивився лише на те, чи ПОЧИНАЄТЬСЯ вираз із
			форматера словника, а `formatFont(page.error?.message)` саме так і починався.

			Друга — це взагалі не те, що треба показувати. `err.message` у UI
			заборонений прямо (ERROR-HANDLING-v8 § 4.1), і тут це ще й англійське
			«Not Found» посеред української сторінки (§ 4.3). Діагностика від цього
			не губиться: `handleError` у `hooks.client.ts` пише саме `message` у
			`logService`, звідки воно йде в звіт службового табла.

			Номер статусу лишається: це число, і воно говорить більше за текст.
		-->
		<p class="error-message">{@html formatFont(t('error.message'))}</p>

		<div class="error-actions">
			<button class="btn-retry" onclick={() => window.location.reload()}>
				<RotateCcw size={20} />
				{@html formatFont(t('error.retry'))}
			</button>
			<a href={langPath(languageFromParam(page.params.lang))} class="btn-home">
				<Home size={20} />
				{@html formatFont(t('error.goHome'))}
			</a>
		</div>
	</div>
</div>

<style>
	.error-page {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100dvh;
		padding: var(--space-md);
		background-color: var(--color-bg);
	}

	.error-card {
		background: var(--color-bg-surface);
		border-radius: var(--radius-lg);
		padding: var(--space-2xl);
		box-shadow: var(--shadow-card);
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		max-width: 400px;
		width: 100%;
		border: 2px solid var(--color-error);
	}

	.error-status {
		font-size: 5rem;
		font-weight: 900;
		color: var(--color-error);
		margin: 0;
		line-height: 1;
	}

	.error-title {
		font-size: var(--font-size-2xl);
		font-weight: var(--font-weight-bold);
		color: var(--color-text);
		margin: var(--space-md) 0 var(--space-sm);
	}

	.error-message {
		color: var(--color-text-muted);
		font-size: var(--font-size-md);
		margin-bottom: var(--space-xl);
	}

	.error-actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		width: 100%;
	}

	.btn-retry,
	.btn-home {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		padding: var(--space-md);
		border-radius: var(--radius-md);
		font-weight: var(--font-weight-bold);
		text-decoration: none;
		transition: all var(--transition-fast);
		border: none;
		cursor: pointer;
	}

	.btn-retry {
		background: var(--color-accent);
		color: var(--color-text-on-accent);
	}

	.btn-retry:hover {
		transform: translateY(-2px);
		background: var(--color-accent-hover);
	}

	.btn-home {
		background: color-mix(in srgb, var(--color-bg-panel), transparent 90%);
		color: var(--color-text);
		border: 1px solid var(--color-border);
	}

	.btn-home:hover {
		background: color-mix(in srgb, var(--color-bg-panel), transparent 80%);
		transform: translateY(-2px);
	}
</style>
