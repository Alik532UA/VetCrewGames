<script lang="ts">
	import { LoaderCircle } from 'lucide-svelte';
	import { t, formatFont } from '$lib/i18n';

	/**
	 * «ВІДКРИВАЄМО КІМНАТУ…» — двері сторінки гри, поки вона вирішує, куди йти: створити ту
	 * кімнату, яку попросили, чи повернутися на хаб (`roomPolicies`).
	 *
	 * Вікном на пів екрана, а не рядком (прохання автора 2026-09-27: «чому у нас 95%
	 * порожнє, а ми мілким елементом пишемо інформацію?»). Доти тут був один рядок на
	 * власній підкладці посеред порожньої сторінки — однаково на обох сторінках спільних
	 * ігор, двома копіями розмітки й стилю. Тепер — один компонент: `.fill .fill-window`
	 * і значок, що крутиться, щоб вікно читалося як «зачекайте», а не як «застигло».
	 */
</script>

<div class="door text-panel fill fill-window" role="status" data-testid="online-door-panel">
	<LoaderCircle class="door__spin" aria-hidden="true" />
	<p class="door__text">{@html formatFont(t('online.opening'))}</p>
</div>

<style>
	.door {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-lg);
		padding: var(--space-lg);
		text-align: center;
	}

	.door__text {
		margin: 0;
		font-size: var(--font-size-2xl);
		font-weight: var(--font-weight-bold);
	}

	/* `lucide` малює розмір атрибутами — CSS їх перебиває, тож значок росте з кеглем. */
	.door :global(.door__spin) {
		width: calc(var(--fill-u) * 4);
		height: calc(var(--fill-u) * 4);
		color: var(--color-accent);
		animation: door-spin 1.2s linear infinite;
	}

	@keyframes door-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.door :global(.door__spin) {
			animation: none;
		}
	}
</style>
