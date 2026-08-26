<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import { settings } from '$lib/services/settings.svelte';
	import { shownProgress } from '$lib/reserve/contracts';
	import type { ReserveCommand, ReserveState } from '$lib/reserve/types';

	/**
	 * Контракти зі спонсорами: обіцянка з дедлайном.
	 *
	 * Це те, що перетворює «набирати користь» на планування — спонсор платить не
	 * за старання, а за результат до конкретного дня. Тому на картці стоять
	 * ОБИДВА числа: нагорода й штраф. Показати лише нагороду означало б умовляти
	 * брати все підряд, а брати все підряд тут невигідно.
	 */
	interface Props {
		state: ReserveState;
		day: number;
		onCommand: (command: ReserveCommand) => void;
	}

	let { state, day, onCommand }: Props = $props();

	const money = (value: number) => value.toLocaleString(settings.locale);
</script>

{#if state.offered}
	{@const offer = state.offered}
	<article class="card card--offer" data-testid="reserve-offer-card">
		<h4 class="card__title">{@html formatFont(t('reserve.offer'))}</h4>
		<p class="card__what">{@html formatFont(t(offer.titleKey))}</p>
		<p class="card__terms">
			{@html formatFont(t('reserve.dueDay'))}
			{offer.dueDay} · {@html formatFont(t('reserve.reward'))}
			{money(offer.reward)} · {@html formatFont(t('reserve.penalty'))} −{offer.penalty}
		</p>
		<button
			type="button"
			class="btn-primary card__go"
			onclick={() => onCommand({ type: 'accept', contractId: offer.id })}
			data-testid="reserve-accept-btn"
		>
			{@html formatFont(t('reserve.accept'))}
		</button>
	</article>
{/if}

{#if state.contracts.length === 0 && !state.offered}
	<p class="empty" data-testid="reserve-no-contracts-text">
		{@html formatFont(t('reserve.noContracts'))}
	</p>
{/if}

{#each state.contracts as contract (contract.id)}
	{@const late = day > contract.dueDay}
	<!--
		КНОПКИ «ОТРИМАТИ НАГОРОДУ» ТУТ БІЛЬШЕ НЕМА.

		Виконане зараховується саме — у мить ходу, який довершив умову, і на межі
		доби (`reserve/contractMoves.ts`, `claimDone`). Кнопка питала про те, на що
		є одна відповідь, і водночас була єдиним способом дізнатися, що контракт
		закрито; тепер про це каже сповіщення.

		Через це виконаний контракт у цьому переліку майже не буває видним: він
		зникає тим самим кроком, що й нараховує гроші.
	-->
	<article class="card" data-testid="reserve-contract-{contract.id}-card">
		<p class="card__what">{@html formatFont(t(contract.titleKey))}</p>
		<p class="card__terms" class:card__terms--late={late}>
			<!--
				ЧИСЛА ДЛЯ РЕПУТАЦІЇ — АБСОЛЮТНІ, а не приріст.

				Автор прочитав «0 / 15» як «дійти до 15» і мав рацію, що це не вʼяжеться
				з 88 у шапці: шкала репутації абсолютна, тож приріст на ній читається як
				чуже число. Для лічильників («випустити двох») приріст лишається
				правильним — там «двоє» справді означає двоє НОВИХ. Розбір — у
				`contracts.shownProgress`.
			-->
			{shownProgress(state, contract).now} / {shownProgress(state, contract).need} ·
			{@html formatFont(t('reserve.dueDay'))}
			{contract.dueDay} · {@html formatFont(t('reserve.reward'))}
			{money(contract.reward)}
		</p>
	</article>
{/each}

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-bottom: var(--space-sm);
		padding: var(--space-sm);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
	}

	/* Пропозиція виділена: у неї є строк, і вона зникне сама. */
	.card--offer {
		outline: 2px solid var(--color-accent);
	}

	.card__title {
		margin: 0;
		font-size: var(--font-size-sm);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		opacity: 0.7;
	}

	.card__what {
		margin: 0;
		font-weight: var(--font-weight-bold);
	}

	.card__terms {
		margin: 0;
		font-size: var(--font-size-sm);
		font-variant-numeric: tabular-nums;
		opacity: 0.8;
	}

	/* Строк вийшов — це подія, а не дрібниця. */
	.card__terms--late {
		color: var(--color-error);
		opacity: 1;
	}

	.card__go {
		max-width: none;
		margin-top: 4px;
	}

	.empty {
		margin: 0 0 var(--space-md);
		opacity: 0.75;
	}
</style>
