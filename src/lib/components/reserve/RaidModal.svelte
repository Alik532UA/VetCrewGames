<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import { settings } from '$lib/services/settings.svelte';
	import { DRONE_PRICE } from '$lib/reserve/raids';
	import { dragWindow } from './dragWindow.svelte';
	import { speciesById } from '$lib/reserve/species';
	import type { Animal, RaidTactic } from '$lib/reserve/types';

	/**
	 * Наліт браконьєрів: три рішення й жодного способу відкласти.
	 *
	 * Єдине модальне вікно в грі — і саме тому воно тут доречне. Решта панелей
	 * висуваються знизу й нічого не вимагають; тут потрібне рішення, і карта під
	 * ним не потрібна. Кнопки «закрити» немає навмисно: «не відповісти» — це вже
	 * одна з трьох тактик, і вона теж має ціну. Заплющити вікно, не заплатив, було
	 * б четвертою тактикою, дешевшою за всі три.
	 */
	interface Props {
		/** Кого прийшли крати. `null` — тварини вже немає (крайній випадок). */
		target: Animal | null;
		hasRanger: boolean;
		budget: number;
		/** Обрана тактика. Команду складає сторінка — вона ж і покаже наслідок. */
		onTactic: (tactic: RaidTactic) => void;
	}

	let { target, hasRanger, budget, onTactic }: Props = $props();

	const species = $derived(target ? speciesById(target.speciesId) : null);

	/**
	 * Тактика, яку зараз не потягнути, лишається ВИДНОЮ.
	 *
	 * Приховати дрон, коли не вистачає грошей, означало б приховати причину: гравець
	 * не дізнався б, що патруль і три тисячі — це те, чого йому забракло. Тому
	 * кнопка є, вона позначена як недоступна й пояснює себе.
	 */
	const tactics: Array<{
		id: RaidTactic;
		label: 'reserve.raid.drone' | 'reserve.raid.ambush' | 'reserve.raid.ignore';
		hint: 'reserve.raid.droneHint' | 'reserve.raid.ambushHint' | 'reserve.raid.ignoreHint';
		cost: string;
		off: boolean;
	}> = $derived([
		{
			id: 'drone',
			label: 'reserve.raid.drone',
			hint: 'reserve.raid.droneHint',
			cost: `−${DRONE_PRICE.toLocaleString(settings.locale)}`,
			off: budget < DRONE_PRICE
		},
		{
			id: 'ambush',
			label: 'reserve.raid.ambush',
			hint: 'reserve.raid.ambushHint',
			cost: '',
			off: !hasRanger
		},
		{
			id: 'ignore',
			label: 'reserve.raid.ignore',
			hint: 'reserve.raid.ignoreHint',
			cost: '',
			off: false
		}
	]);
</script>

<div class="raid-backdrop" aria-hidden="true"></div>

<!--
	`<div role="alertdialog">`, а не `<section>`: секція — неінтерактивний
	орієнтир, і роль діалогу на ній суперечить сама собі. Заголовок усередині
	лишається `<h2>`, тож структура сторінки не змінюється.
-->
<div
	class="raid"
	role="alertdialog"
	aria-label={t('reserve.raid.title')}
	use:dragWindow={{ id: 'raid', handle: '.raid__title' }}
	data-testid="reserve-raid-modal"
>
	<!--
		Заголовок — ручка. Вікно вимагає рішення, але право подивитися на карту перед
		рішенням у гравця лишається: тактика вибирається за твариною, а не за текстом.
	-->
	<h2 class="raid__title">{@html formatFont(t('reserve.raid.title'))}</h2>

	<p class="raid__text">
		{@html formatFont(t('reserve.raid.text'))}
		{#if species}
			<b data-testid="reserve-raid-target-text">{@html formatFont(t(species.nameKey))}</b>
		{/if}
	</p>

	<ul class="raid__list">
		{#each tactics as tactic (tactic.id)}
			<li>
				<!--
					Недоступність — `aria-disabled`, а не `disabled`: другий ковтає клік, і
					сказати, ЧОМУ не можна, було б нічим. Той самий підхід, що й у персоналі.
				-->
				<button
					type="button"
					class="raid__btn"
					class:raid__btn--off={tactic.off}
					aria-disabled={tactic.off}
					onclick={() => onTactic(tactic.id)}
					data-testid="reserve-raid-{tactic.id}-btn"
				>
					<span class="raid__name">
						{@html formatFont(t(tactic.label))}
						{#if tactic.cost}<span class="raid__cost">{tactic.cost}</span>{/if}
					</span>
					<span class="raid__hint">{@html formatFont(t(tactic.hint))}</span>
				</button>
			</li>
		{/each}
	</ul>
</div>

<style>
	.raid-backdrop {
		position: fixed;
		inset: 0;
		z-index: 40;
		background: rgb(0 0 0 / 60%);
	}

	.raid {
		position: fixed;
		top: 50%;
		left: 50%;
		z-index: 41;
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		width: min(26rem, calc(100% - 2 * var(--space-md)));
		max-height: 80dvh;
		padding: var(--space-md);
		border: 1px solid var(--color-error);
		border-radius: var(--radius-md);
		background: var(--color-bg-panel);
		box-shadow: 0 10px 40px rgb(0 0 0 / 55%);
		transform: translate(-50%, -50%);
		overflow-y: auto;
	}

	.raid__title {
		/* Ручка вікна: жест уздовж неї тягне вікно, а не виділяє текст. */
		cursor: grab;
		touch-action: none;
		margin: 0;
		color: var(--color-error);
		font-size: var(--font-size-lg);
	}

	.raid__text {
		margin: 0;
	}

	.raid__list {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.raid__btn {
		display: flex;
		flex-direction: column;
		gap: 2px;
		width: 100%;
		min-height: 44px;
		padding: var(--space-sm);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.raid__btn--off {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.raid__name {
		display: flex;
		gap: var(--space-sm);
		justify-content: space-between;
		font-weight: var(--font-weight-bold);
	}

	.raid__cost {
		font-variant-numeric: tabular-nums;
	}

	.raid__hint {
		font-size: var(--font-size-sm);
		opacity: 0.75;
	}
</style>
