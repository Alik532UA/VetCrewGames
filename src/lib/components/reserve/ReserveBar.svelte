<script lang="ts">
	import { t, formatFont } from '$lib/i18n';

	/**
	 * Смуга кнопок унизу карти й підказка режиму розміщення.
	 *
	 * Кампанія стоїть тут окремою кнопкою, а не в панелі, бо це ХІД, а не список:
	 * ховати щоденну дію за два кліки означало б робити її незручною рівно
	 * настількою, щоб про неї забували.
	 *
	 * Підказка «натисніть на карту» лежить над смугою й тримає скасування поруч
	 * із собою. Режим, з якого не видно виходу, читається як зависання.
	 */
	export type Panel = 'animals' | 'enclosures' | 'staff' | 'tasks';

	interface Props {
		panel: Panel | null;
		placing: boolean;
		onPanel: (id: Panel) => void;
		onCampaign: () => void;
		onCancel: () => void;
		onRestart: () => void;
	}

	let { panel, placing, onPanel, onCampaign, onCancel, onRestart }: Props = $props();

	const BUTTONS: Array<{
		id: Panel;
		key: 'reserve.animals' | 'reserve.enclosures' | 'reserve.staff' | 'reserve.tasks';
	}> = [
		{ id: 'animals', key: 'reserve.animals' },
		{ id: 'enclosures', key: 'reserve.enclosures' },
		{ id: 'staff', key: 'reserve.staff' },
		{ id: 'tasks', key: 'reserve.tasks' }
	];
</script>

{#if placing}
	<p class="hint" role="status" data-testid="reserve-placing-status">
		{@html formatFont(t('reserve.placing'))}
		<button type="button" class="hint__cancel" onclick={onCancel}>
			{@html formatFont(t('reserve.cancel'))}
		</button>
	</p>
{/if}

<nav class="bar" aria-label={t('reserve.title')}>
	{#each BUTTONS as item (item.id)}
		<button
			type="button"
			class="bar__btn"
			class:bar__btn--on={panel === item.id}
			aria-pressed={panel === item.id}
			onclick={() => onPanel(item.id)}
			data-testid="reserve-panel-{item.id}-btn"
		>
			{@html formatFont(t(item.key))}
		</button>
	{/each}

	<button
		type="button"
		class="bar__btn"
		title={t('reserve.campaignHint')}
		onclick={onCampaign}
		data-testid="reserve-campaign-btn"
	>
		{@html formatFont(t('reserve.campaign'))}
	</button>

	<button type="button" class="bar__btn" onclick={onRestart} data-testid="reserve-startover-btn">
		{@html formatFont(t('reserve.restart'))}
	</button>
</nav>

<style>
	.bar {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
	}

	.bar__btn {
		flex: 1 1 6rem;
		min-height: 44px;
		padding: 0 var(--space-sm);
		border-radius: var(--radius-sm);
		background: var(--color-bg-panel);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.bar__btn--on {
		background: var(--color-accent);
		color: var(--color-text-on-accent);
	}

	.hint {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
		align-items: center;
		margin: 0;
		padding: var(--space-sm);
		border-radius: var(--radius-sm);
		background: var(--color-accent);
		color: var(--color-text-on-accent);
	}

	.hint__cancel {
		min-height: 44px;
		padding: 0 var(--space-md);
		border-radius: var(--radius-sm);
		background: var(--color-bg-panel);
		color: var(--color-text);
		font: inherit;
		cursor: pointer;
	}
</style>
