<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import { WAGES, type StaffRole } from '$lib/reserve/constants';
	import type { ReserveCommand } from '$lib/reserve/types';

	/**
	 * Персонал: ветеринари лікують, доглядачі знімають стрес.
	 *
	 * Платня написана прямо на картці. Найняти легко, а платити доводиться
	 * щодня — і саме це має бути видно ДО кліку, а не в кінці місяця.
	 */
	interface Props {
		staff: Record<StaffRole, number>;
		subsidy: boolean;
		onCommand: (command: ReserveCommand) => void;
	}

	let { staff, subsidy, onCommand }: Props = $props();

	const roles = Object.keys(WAGES) as StaffRole[];
</script>

<ul class="list">
	{#each roles as role (role)}
		<li class="crew" data-testid="reserve-crew-{role}-row">
			<span class="crew__name">{@html formatFont(t(`reserve.staff.${role}` as const))}</span>
			<span class="crew__count" data-testid="reserve-crew-{role}-count">{staff[role]}</span>
			<span class="crew__wage"
				>−{WAGES[role]}/{@html formatFont(t('reserve.day').toLowerCase())}</span
			>

			<div class="crew__buttons">
				<button
					type="button"
					class="chip"
					aria-label={t('reserve.dismiss')}
					onclick={() => onCommand({ type: 'dismiss', role })}
					data-testid="reserve-dismiss-{role}-btn">−</button
				>
				<!--
					Заблоковане — `aria-disabled`, а не `disabled`: другий ковтає клік,
					і сказати, ЧОМУ не можна, було б нічим.
				-->
				<button
					type="button"
					class="chip"
					class:chip--off={subsidy}
					aria-disabled={subsidy}
					aria-label={t('reserve.hire')}
					onclick={() => onCommand({ type: 'hire', role })}
					data-testid="reserve-hire-{role}-btn">+</button
				>
			</div>
		</li>
	{/each}
</ul>

<style>
	.list {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.crew {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
		padding: var(--space-sm);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
	}

	.crew__name {
		flex: 1;
	}

	.crew__count {
		font-weight: var(--font-weight-bold);
		font-variant-numeric: tabular-nums;
	}

	.crew__wage {
		font-size: var(--font-size-sm);
		opacity: 0.7;
	}

	.crew__buttons {
		display: flex;
		gap: 4px;
	}

	.chip {
		min-width: 44px;
		min-height: 44px;
		border-radius: var(--radius-sm);
		background: var(--color-bg-panel);
		color: inherit;
		font: inherit;
		font-size: var(--font-size-lg);
		cursor: pointer;
	}

	.chip--off {
		opacity: 0.5;
	}
</style>
