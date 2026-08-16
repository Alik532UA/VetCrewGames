<script lang="ts">
	import { t } from '$lib/i18n';
	import type { Animal } from '$lib/reserve/types';

	/**
	 * Список мешканців — і другий шлях до картки.
	 *
	 * Сцена показує тих самих тварин фігурами, і клікнути можна там. Але список
	 * лишається: клавіатурою по тривимірній сцені не походиш, а на маленькому
	 * екрані влучити пальцем у фігуру важче, ніж у рядок.
	 */
	interface Props {
		animals: Animal[];
		selectedId: number | null;
		onSelect: (id: number) => void;
	}

	let { animals, selectedId, onSelect }: Props = $props();
</script>

<section class="residents" data-testid="reserve-animal-list">
	<h2 class="residents__title">{t('reserve.animals')}</h2>

	{#if animals.length === 0}
		<p class="residents__empty" data-testid="reserve-empty-text">{t('reserve.empty')}</p>
	{:else}
		<ul class="residents__items">
			{#each animals as animal (animal.id)}
				<li>
					<button
						type="button"
						class="resident"
						class:resident--on={animal.id === selectedId}
						aria-pressed={animal.id === selectedId}
						onclick={() => onSelect(animal.id)}
						data-testid="reserve-animal-{animal.id}-btn"
					>
						<span class="resident__origin">{t(`reserve.origin.${animal.origin}` as const)}</span>
						<span class="resident__stage">{t(`reserve.stage.${animal.stage}` as const)}</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	/* Фон у секції, бо заголовок і «поки що порожньо» — теж текст. */
	.residents {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		width: 100%;
		padding: var(--space-md);
		border-radius: var(--radius-md);
		background: var(--color-bg-panel);
	}

	.residents__title {
		margin: 0;
		font-size: var(--font-size-sm);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		opacity: 0.7;
	}

	.residents__empty {
		margin: 0;
		opacity: 0.7;
	}

	.residents__items {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.resident {
		display: flex;
		flex-direction: column;
		gap: 2px;
		align-items: flex-start;
		min-height: 44px;
		padding: var(--space-sm);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.resident--on {
		outline: 2px solid var(--color-accent);
	}

	.resident__origin {
		font-weight: var(--font-weight-bold);
	}

	.resident__stage {
		font-size: var(--font-size-sm);
		opacity: 0.75;
	}
</style>
