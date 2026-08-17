<script lang="ts">
	import { t, formatFont } from '$lib/i18n';

	/**
	 * Кінець партії: перемога або крах.
	 *
	 * Обидва випадки — один екран із однією кнопкою, і саме тому вони тут разом:
	 * різниця між ними в тексті й у тому, чи є чим хвалитися, а не в розкладці.
	 * Кнопка починає заново САМУ ЦЮ ділянку — решта заповідників стоять
	 * недоторкані.
	 */
	interface Props {
		/** `true` — перемога, `false` — крах. Третього стану екран не має. */
		victory: boolean;
		impact: number;
		day: number;
		onRestart: () => void;
	}

	let { victory, impact, day, onRestart }: Props = $props();
</script>

{#if victory}
	<section class="over" data-testid="reserve-victory-section">
		<p>{@html formatFont(t('reserve.victory'))}</p>
		<p class="over__score">
			{@html formatFont(t('reserve.impact'))}: {impact} · {@html formatFont(t('reserve.day'))}: {day}
		</p>
		<button
			type="button"
			class="btn-primary"
			onclick={onRestart}
			data-testid="reserve-victory-restart-btn">{@html formatFont(t('reserve.newGame'))}</button
		>
	</section>
{:else}
	<section class="over" data-testid="reserve-game-over-section">
		<p>{@html formatFont(t('reserve.gameOver'))}</p>
		<button type="button" class="btn-primary" onclick={onRestart} data-testid="reserve-restart-btn"
			>{@html formatFont(t('reserve.newGame'))}</button
		>
	</section>
{/if}

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
