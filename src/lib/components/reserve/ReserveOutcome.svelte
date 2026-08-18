<script lang="ts">
	import { t, formatFont } from '$lib/i18n';

	/**
	 * Кінець партії — і він тепер один: КРАХ.
	 *
	 * Доти екран мав дві половини, перемогу й поразку. Перемоги як стану більше
	 * немає: заповідник — пісочниця, у якій віхи по степенях десяти
	 * (`milestones.ts`) відзначають зроблене, а не зупиняють час. Стара половина
	 * до того ж була недосяжна — поріг 10 000 при випуску в +50 означав двісті
	 * повернених тварин.
	 *
	 * Підсумок лишається з числами. Партія, що обірвалася, теж має що сказати:
	 * скільки користі й на якій добі — це і є те, з чим гравець порівняє наступну.
	 *
	 * Кнопка починає заново САМУ ЦЮ ділянку — решта заповідників стоять недоторкані.
	 */
	interface Props {
		impact: number;
		day: number;
		onRestart: () => void;
	}

	let { impact, day, onRestart }: Props = $props();
</script>

<section class="over" data-testid="reserve-game-over-section">
	<p>{@html formatFont(t('reserve.gameOver'))}</p>
	<p class="over__score">
		{@html formatFont(t('reserve.impact'))}: {impact} · {@html formatFont(t('reserve.day'))}: {day}
	</p>
	<button type="button" class="btn-primary" onclick={onRestart} data-testid="reserve-restart-btn"
		>{@html formatFont(t('reserve.newGame'))}</button
	>
</section>

<style>
	.over {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		align-items: center;
		padding: var(--space-lg) var(--space-md);
		border-radius: var(--radius-md);
		background: var(--color-bg-panel);
		text-align: center;
	}

	.over p {
		margin: 0;
	}

	.over__score {
		font-variant-numeric: tabular-nums;
		opacity: 0.8;
	}
</style>
