<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import { settings } from '$lib/services/settings.svelte';
	import { QUALITIES, type Quality } from '$lib/reserve/constants';
	import { enclosurePrice, repairPrice, upgradePrice } from '$lib/reserve/prices';
	import SizePicker from './SizePicker.svelte';
	import type { Enclosure, ReserveCommand } from '$lib/reserve/types';

	/**
	 * Вольєри: вибрати розмір і якість, потім поставити на карту.
	 *
	 * Розмір вибирає `SizePicker`: лічильник плюс пʼять заготовок за грошима.
	 * Пʼятдесят кнопок не влазять на екран, а повзунок гірший за них обох.
	 *
	 * Сама будівля звідси НЕ ставиться: панель лише готує замовлення, а місце
	 * гравець тицяє на карті. Тому кнопка й називається «оберіть місце».
	 */
	interface Props {
		enclosures: Enclosure[];
		/** `id` вольєрів, у яких хтось живе: їх не можна знести. */
		occupied: Set<number>;
		effectiveQualityOf: (enclosure: Enclosure) => Quality;
		/** Замовлення прийнято — далі гравець вибирає місце на карті. */
		onPlace: (size: number, quality: Quality) => void;
		/**
		 * Розмір, з яким панель ВІДКРИЛАСЯ.
		 *
		 * Приходить, коли сюди привело попередження «немає вільного вольєра»: у
		 * гравця вже є вибраний вид, і рекомендований для нього розмір — саме те, що
		 * він збирався побудувати. Панель створюється заново на кожне відкриття, тож
		 * значення й діє як початкове, а далі його можна змінити кнопками.
		 */
		initialSize?: number;
		/** Гроші фонду: від них залежать заготовки розміру й попередження про ціну. */
		budget: number;
		onCommand: (command: ReserveCommand) => void;
	}

	let { enclosures, occupied, effectiveQualityOf, onPlace, onCommand, initialSize, budget }: Props =
		$props();

	/*
	 * Захоплюється саме ПОЧАТКОВЕ значення — і це не недогляд.
	 *
	 * Панель створюється заново на кожне відкриття, тож «початкове» тут означає
	 * «те, з яким відкрили». Слідкувати за пропсом далі було б гірше: гравець
	 * натиснув «5», а зовнішнє число повернуло б «6» на першому ж перемальовуванні.
	 */
	// svelte-ignore state_referenced_locally
	let size = $state(initialSize ?? 3);
	let quality = $state<Quality>(2);

	const money = (value: number) => value.toLocaleString(settings.locale);
	const percent = (value: number) => `${Math.round(value * 100)}%`;
</script>

<div class="build">
	<h3 class="build__title">{@html formatFont(t('reserve.size'))}</h3>
	<SizePicker {size} {quality} {budget} onSize={(value) => (size = value)} />

	<h3 class="build__title">{@html formatFont(t('reserve.quality'))}</h3>

	<div class="build__row" role="group" aria-label={t('reserve.quality')}>
		{#each QUALITIES as value (value)}
			<button
				type="button"
				class="chip"
				class:chip--on={quality === value}
				aria-pressed={quality === value}
				onclick={() => (quality = value)}
				data-testid="reserve-quality-{value}-btn"
			>
				{@html formatFont(t(`reserve.quality.${value}` as const))}
			</button>
		{/each}
	</div>

	<button
		type="button"
		class="btn-primary build__go"
		onclick={() => onPlace(size, quality)}
		data-testid="reserve-build-btn"
	>
		{@html formatFont(t('reserve.place'))} — {money(enclosurePrice(size, quality))}
	</button>
</div>

<ul class="list">
	{#each enclosures as enclosure (enclosure.id)}
		{@const worn = effectiveQualityOf(enclosure) < enclosure.quality}
		<li class="card" data-testid="reserve-enclosure-{enclosure.id}-item">
			<div class="card__head">
				<b>{@html formatFont(t('reserve.enclosure'))} {enclosure.id}</b>
				<span class="card__meta">
					{@html formatFont(t('reserve.size'))}
					{enclosure.size} · {@html formatFont(
						t(`reserve.quality.${effectiveQualityOf(enclosure)}` as const)
					)}
				</span>
			</div>

			<div class="card__meta" class:card__meta--bad={worn}>
				{@html formatFont(t('reserve.durability'))}: {percent(enclosure.durability)}
			</div>

			<div class="card__actions">
				{#if enclosure.durability < 1}
					<button
						type="button"
						class="chip"
						onclick={() => onCommand({ type: 'repair', enclosureId: enclosure.id })}
						data-testid="reserve-repair-{enclosure.id}-btn"
					>
						{@html formatFont(t('reserve.repair'))} — {money(
							repairPrice(enclosure.size, enclosure.quality, enclosure.durability)
						)}
					</button>
				{/if}

				{#if enclosure.quality < 3}
					{@const next = (enclosure.quality + 1) as Quality}
					<button
						type="button"
						class="chip"
						onclick={() => onCommand({ type: 'upgrade', enclosureId: enclosure.id, quality: next })}
						data-testid="reserve-upgrade-{enclosure.id}-btn"
					>
						{@html formatFont(t('reserve.upgrade'))} — {money(
							upgradePrice(enclosure.size, enclosure.quality, next)
						)}
					</button>
				{/if}

				{#if !occupied.has(enclosure.id)}
					<button
						type="button"
						class="chip"
						onclick={() => onCommand({ type: 'demolish', enclosureId: enclosure.id })}
						data-testid="reserve-demolish-{enclosure.id}-btn"
					>
						{@html formatFont(t('reserve.demolish'))}
					</button>
				{/if}
			</div>
		</li>
	{/each}
</ul>

<style>
	.build {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		margin-bottom: var(--space-md);
	}

	.build__title {
		margin: 0;
		font-size: var(--font-size-sm);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		opacity: 0.7;
	}

	.build__row,
	.card__actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
	}

	.build__go {
		max-width: none;
	}

	.chip {
		min-height: 44px;
		padding: 0 var(--space-md);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.chip--on {
		background: var(--color-accent);
		color: var(--color-text-on-accent);
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: var(--space-sm);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
	}

	.card__head {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
		justify-content: space-between;
	}

	.card__meta {
		font-size: var(--font-size-sm);
		font-variant-numeric: tabular-nums;
		opacity: 0.8;
	}

	/* Впала якість — це подія, а не дрібниця: її видно кольором. */
	.card__meta--bad {
		color: var(--color-error);
		opacity: 1;
	}
</style>
