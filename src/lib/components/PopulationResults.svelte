<script lang="ts">
	import { td, formatFont, formatPopulation } from '$lib/i18n/index';
	import type { Animal } from '$lib/config/population-game';

	/**
	 * Розбір «Кого більше?»: тварини ПРАВИЛЬНИМ порядком, із чисельністю й фактом.
	 *
	 * Винесено з `PopulationBoard`, коли той самий розбір знадобився на таблі між раундами
	 * спільної вікторини (прохання автора 2026-09-28): дошка стоїть в `OVERSIZED_ALLOWLIST`, де
	 * борг може лише спадати (`src/structure.test.ts`), і новий режим у ній без цього виносу
	 * його збільшував.
	 */
	interface Props {
		/** Від найменшої чисельності до найбільшої — так, як їх треба було розкласти. */
		order: readonly Animal[];
	}

	let { order }: Props = $props();
</script>

<div class="results-zone">
	{#each order as animal, i (animal.id)}
		<div class="result-card anim-stagger-{i + 1}">
			<div class="result-card__left">
				<img
					src={animal.image}
					alt={td(animal.nameKey)}
					class="result-card__img-small"
					loading="lazy"
					width="70"
					height="93"
				/>
			</div>
			<div class="result-card__right">
				<div class="result-card__top">
					<span class="result-card__name-bold">{@html formatFont(td(animal.nameKey))}</span><span
						class="result-card__stat">{@html formatPopulation(animal.population)}</span
					>
				</div>
				<div class="result-card__divider"></div>
				<p class="result-card__fact-simple">{@html formatFont(td(animal.factKey))}</p>
			</div>
		</div>
	{/each}
</div>

<style>
	.results-zone {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		width: 100%;
	}
	.result-card {
		background-color: color-mix(in srgb, var(--color-bg-surface), transparent 25%);
		backdrop-filter: var(--blur-glass);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-card);
		overflow: hidden;
		animation:
			slide-up 400ms ease both,
			blur-in 3s ease 400ms both;
		display: flex;
		padding: 0;
	}
	.result-card__left {
		width: 70px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.result-card__img-small {
		width: 100%;
		aspect-ratio: 3 / 4;
		border-radius: 6px;
		object-fit: cover;
	}
	.result-card__right {
		flex: 1;
		padding: 12px 16px;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}
	.result-card__top {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.result-card__name-bold {
		font-size: 18px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 1px;
	}
	.result-card__stat {
		font-size: 12px;
		font-weight: 700;
		color: var(--color-stat);
	}
	.result-card__divider {
		height: 2px;
		width: 30px;
		background: var(--color-accent);
		margin: 2px 0;
		border-radius: 2px;
	}
	.result-card__fact-simple {
		font-size: 12px;
		margin: 0;
		color: var(--color-text-muted);
		font-style: italic;
	}
</style>
