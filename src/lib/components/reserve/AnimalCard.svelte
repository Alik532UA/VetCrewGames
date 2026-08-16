<script lang="ts">
	import { t } from '$lib/i18n';
	import { STRESS_BLOCKS_RELEASE } from '$lib/reserve/constants';
	import type { Animal, ReserveCommand } from '$lib/reserve/types';

	/**
	 * Картка мешканця: звідки він, як одужує, чи можна випустити.
	 *
	 * Кнопка випуску не ховається, коли випустити не можна. Заборона — це і є
	 * урок гри: народжену в неволі не повернути, і людина має ПОБАЧИТИ, що така
	 * тварина лишиться назавжди, а не просто не знайти кнопки.
	 */
	interface Props {
		animal: Animal;
		onCommand: (command: ReserveCommand) => void;
		onClose: () => void;
	}

	let { animal, onCommand, onClose }: Props = $props();

	const percent = (value: number) => `${Math.round(value * 100)}%`;
	const blocked = $derived(
		animal.stage !== 'healthy' || !animal.releasable || animal.stress > STRESS_BLOCKS_RELEASE
	);
</script>

<aside class="card" data-testid="reserve-animal-card">
	<div class="card__head">
		<h2 class="card__title">{t(`reserve.origin.${animal.origin}` as const)}</h2>
		<button
			type="button"
			class="card__close"
			aria-label={t('common.close')}
			onclick={onClose}
			data-testid="reserve-card-close-btn">×</button
		>
	</div>

	<p class="card__stage" data-testid="reserve-card-stage">
		{t(`reserve.stage.${animal.stage}` as const)}
	</p>

	<dl class="card__bars">
		<dt>{t('reserve.recovery')}</dt>
		<dd>
			<progress value={animal.recovery} max="1" data-testid="reserve-card-recovery"></progress>
			<span>{percent(animal.recovery)}</span>
		</dd>
		<dt>{t('reserve.stress')}</dt>
		<dd>
			<progress value={animal.stress} max="1" data-testid="reserve-card-stress"></progress>
			<span>{percent(animal.stress)}</span>
		</dd>
	</dl>

	{#if !animal.releasable}
		<p class="card__note" data-testid="reserve-card-captive">{t('reserve.captiveBorn')}</p>
	{/if}

	{#if animal.stage !== 'released'}
		<button
			type="button"
			class="btn-primary card__release"
			class:card__release--off={blocked}
			aria-disabled={blocked}
			onclick={() => onCommand({ type: 'release', animalId: animal.id })}
			data-testid="reserve-release-btn"
		>
			{t('reserve.release')}
		</button>
	{/if}
</aside>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		width: 100%;
		padding: var(--space-md);
		border-radius: var(--radius-md);
		background: var(--color-bg-panel);
	}

	.card__head {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
		justify-content: space-between;
	}

	.card__title {
		margin: 0;
		font-size: var(--font-size-lg);
	}

	.card__close {
		min-width: 44px;
		min-height: 44px;
		border-radius: var(--radius-sm);
		color: inherit;
		font-size: var(--font-size-lg);
		cursor: pointer;
	}

	.card__stage {
		margin: 0;
		opacity: 0.8;
	}

	.card__bars {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 4px var(--space-sm);
		align-items: center;
		margin: 0;
	}

	.card__bars dt {
		font-size: var(--font-size-sm);
		opacity: 0.75;
	}

	.card__bars dd {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
		margin: 0;
	}

	.card__bars progress {
		flex: 1;
		min-width: 0;
	}

	.card__note {
		margin: 0;
		color: var(--color-error);
		font-size: var(--font-size-sm);
	}

	.card__release {
		max-width: none;
	}

	/* Кнопка лишається клікабельною: відмова пояснює причину тостом. */
	.card__release--off {
		background: var(--color-disabled);
		color: var(--color-disabled-text);
		box-shadow: none;
	}
</style>
