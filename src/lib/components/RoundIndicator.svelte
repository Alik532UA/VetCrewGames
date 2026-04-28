<script lang="ts">
	export type RoundStatus = 'pending' | 'correct' | 'incorrect' | 'partial';

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
	<div class="segments-wrapper">
		{#each rounds as r}
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
		grid-template-columns: repeat(10, 1fr);
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
		background: var(--color-warning, #facc15);
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
