<script lang="ts">
	import { t } from '$lib/i18n';
	import { settings } from '$lib/services/settings.svelte';
	import { ORIGINS, WAGES, type AnimalOrigin, type StaffRole } from '$lib/reserve/constants';
	import type { ReserveCommand } from '$lib/reserve/types';

	/**
	 * Три канали надходження й персонал.
	 *
	 * Ціна й плата «Користю планеті» написані ПРЯМО на кнопці. У цьому вся гра:
	 * чорний ринок дешевший грошима і дорожчий усім іншим, і побачити це треба
	 * ДО кліку, а не в списку наслідків після нього.
	 */
	interface Props {
		staff: Record<StaffRole, number>;
		/** Партія в антикризовому режимі: розширення заблоковане. */
		subsidy: boolean;
		onCommand: (command: ReserveCommand) => void;
	}

	let { staff, subsidy, onCommand }: Props = $props();

	const origins = Object.entries(ORIGINS) as Array<[AnimalOrigin, (typeof ORIGINS)[AnimalOrigin]]>;
	const roles = Object.keys(WAGES) as StaffRole[];

	const signed = (value: number) => (value > 0 ? `+${value}` : String(value));
</script>

<section class="actions" data-testid="reserve-actions-section">
	<h2 class="actions__title">{t('reserve.acquire')}</h2>
	<div class="actions__row">
		{#each origins as [origin, terms] (origin)}
			<button
				type="button"
				class="action"
				class:action--off={subsidy}
				aria-disabled={subsidy}
				title={t(`reserve.origin.${origin}.hint` as const)}
				onclick={() => onCommand({ type: 'acquire', origin })}
				data-testid="reserve-acquire-{origin}-btn"
			>
				<span class="action__name">{t(`reserve.origin.${origin}` as const)}</span>
				<span class="action__price">
					−{(terms.price + terms.logistics).toLocaleString(settings.locale)}
					<span class:action__impact--bad={terms.impact < 0}>{signed(terms.impact)}</span>
				</span>
			</button>
		{/each}
	</div>

	<h2 class="actions__title">{t('reserve.staff')}</h2>
	<div class="actions__row">
		{#each roles as role (role)}
			<div class="crew" data-testid="reserve-crew-{role}-row">
				<span class="crew__name">{t(`reserve.staff.${role}` as const)}</span>
				<span class="crew__count" data-testid="reserve-crew-{role}-count">{staff[role]}</span>
				<span class="crew__wage">−{WAGES[role]}/{t('reserve.day').toLowerCase()}</span>
				<div class="crew__buttons">
					<button
						type="button"
						class="action action--small"
						aria-label={t('reserve.dismiss')}
						onclick={() => onCommand({ type: 'dismiss', role })}
						data-testid="reserve-dismiss-{role}-btn">−</button
					>
					<button
						type="button"
						class="action action--small"
						class:action--off={subsidy}
						aria-disabled={subsidy}
						aria-label={t('reserve.hire')}
						onclick={() => onCommand({ type: 'hire', role })}
						data-testid="reserve-hire-{role}-btn">+</button
					>
				</div>
			</div>
		{/each}
	</div>
</section>

<style>
	/*
	 * Фон у самої секції, а не лише в кнопок: підписи «Прийняти тварину» й
	 * «Персонал» інакше лежали б просто на тлі сторінки, а воно тут — картинка.
	 */
	.actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		width: 100%;
		padding: var(--space-md);
		border-radius: var(--radius-md);
		background: var(--color-bg-panel);
	}

	.actions__title {
		margin: 0;
		font-size: var(--font-size-sm);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		opacity: 0.7;
	}

	.actions__row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
	}

	.action {
		display: flex;
		flex: 1 1 8rem;
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

	/*
	 * Заблоковане — `aria-disabled`, а не `disabled`: другий ковтає клік, і
	 * пояснення, ЧОМУ не можна, показати нічим. А пояснення тут і є гра.
	 */
	.action--off {
		opacity: 0.5;
	}

	.action--small {
		flex: 0 0 44px;
		min-width: 44px;
		align-items: center;
		justify-content: center;
		font-size: var(--font-size-lg);
	}

	.action__name {
		font-weight: var(--font-weight-bold);
	}

	.action__price {
		font-size: var(--font-size-sm);
		font-variant-numeric: tabular-nums;
		opacity: 0.8;
	}

	.action__impact--bad {
		color: var(--color-error);
	}

	.crew {
		display: flex;
		flex: 1 1 10rem;
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
</style>
