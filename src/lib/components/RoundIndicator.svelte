<script lang="ts">
	// Тип переїхав у `$lib/types/game`: контролери мусили імпортувати його
	// звідси, тобто з компонента, і залежність текла в зворотний бік
	// (SVELTE-CORE-v8 § 3.5).
	import type { RoundStatus } from '$lib/types/game';

	let {
		current,
		total,
		results = []
	}: {
		current: number;
		total: number;
		results?: RoundStatus[];
	} = $props();

	const rounds = $derived(Array.from({ length: total }, (_, i) => i + 1));
</script>

<div class="round-indicator-container">
	<!--
		Кількість колонок приходить із пропа, а не зашита числом: доти в CSS
		стояло `repeat(10, 1fr)`, і компонент мовчки ламався б на будь-якому
		`total`, крім десяти — обидві гри зараз мають рівно десять раундів, тож
		помітити це було б нічим.
	-->
	<div class="segments-wrapper" style:--rounds={total}>
		{#each rounds as r (r)}
			{@const result = results[r - 1]}
			{@const status = result ? result : r === current ? 'current' : 'future'}
			<div
				class="segment"
				class:status-current={status === 'current'}
				class:status-correct={status === 'correct'}
				class:status-incorrect={status === 'incorrect'}
				class:status-partial={status === 'partial'}
				class:status-future={status === 'future'}
			>
				{#if status === 'current'}
					<div class="segment-glow"></div>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.round-indicator-container {
		display: flex;
		justify-content: center;
		align-items: center;
		width: 100%;
		user-select: none;
		margin-bottom: var(--space-xs);
	}

	.segments-wrapper {
		display: grid;
		/*
		 * `minmax(0, 1fr)`, а не `1fr`: `1fr` — це `minmax(auto, 1fr)`, тобто
		 * колонка не стає вужчою за min-content вмісту. З десятьма сегментами й
		 * проміжками це дає підлогу ширини, за якою смужка розпирає сторінку на
		 * вузькому екрані (FLUID-SIZING-v8 § 1).
		 */
		grid-template-columns: repeat(var(--rounds, 10), minmax(0, 1fr));
		width: 100%;
		max-width: 300px;
		gap: 4px;
	}

	.segment {
		height: 6px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 3px;
		position: relative;
		overflow: hidden;
		transition: all 0.4s ease;
	}

	.status-current {
		background: #ffffff;
		box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
	}
	.status-correct {
		background: var(--color-success);
	}
	.status-incorrect {
		background: var(--color-error);
	}
	.status-partial {
		background: var(--color-warning);
	}
	.status-future {
		background: rgba(255, 255, 255, 0.1);
	}

	.segment-glow {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent);
		animation: scan 2s infinite;
	}

	@keyframes scan {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(100%);
		}
	}
</style>
