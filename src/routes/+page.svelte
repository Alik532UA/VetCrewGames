<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import { base } from '$app/paths';

	const games = [
		{ key: 'menu.game.mythbusters' as const, href: `${base}/game-mythbusters`, disabled: false },
		{ key: 'menu.game.population' as const, href: `${base}/game-population`, disabled: false },
		{ key: 'menu.game.habitat' as const, href: `${base}/game-habitat`, disabled: true },
		{ key: 'menu.game.family' as const, href: `${base}/game-family`, disabled: true },
		{ key: 'menu.game.feeding' as const, href: `${base}/game-feeding`, disabled: true }
	];

	const links = [
		{
			key: 'menu.link.vetcrew' as const,
			href: 'https://sites.google.com/view/vetcrew'
		},
		{
			key: 'menu.link.order' as const,
			href: 'https://alik532ua.github.io/DigitalWorkshop'
		}
	];
</script>

<div class="menu-page">

	<nav class="menu-grid">
		{#each games as game, i}
			{#if game.disabled}
				<button class="menu-btn menu-btn--game menu-btn--disabled anim-stagger-{i + 1}" disabled>
					{@html formatFont(t(game.key))}
				</button>
			{:else}
				<a href={game.href} class="menu-btn menu-btn--game anim-stagger-{i + 1}">
					{@html formatFont(t(game.key))}
				</a>
			{/if}
		{/each}
	</nav>

	<div class="menu-links">
		{#each links as link}
			<a href={link.href} class="menu-btn menu-btn--link" target="_blank" rel="noopener noreferrer">
				{@html formatFont(t(link.key))}
			</a>
		{/each}
	</div>
</div>

<style>
	.menu-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		padding: var(--space-xl);
		gap: var(--space-2xl);
		width: 100%;
		max-width: 480px;
	}

	.menu-grid {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		width: 100%;
	}

	.menu-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		padding: var(--space-md) var(--space-xl);
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-medium);
		border-radius: var(--radius-md);
		transition:
			transform var(--transition-fast),
			box-shadow var(--transition-normal),
			background-color var(--transition-normal);
		text-align: center;
		text-decoration: none;
		animation: 
			card-enter 400ms ease both,
			blur-in 3s ease 400ms both;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		user-select: none;
	}

	.menu-btn--game {
		background-color: color-mix(in srgb, var(--color-bg-panel), transparent 25%);
		backdrop-filter: var(--blur-glass);
		-webkit-backdrop-filter: var(--blur-glass);
		color: var(--color-text-on-panel);
		box-shadow: var(--shadow-card);
		border: none;
	}

	@media (hover: hover) {
		.menu-btn--game:hover {
			background-color: color-mix(in srgb, var(--color-bg-card-hover), transparent 15%);
			box-shadow: var(--shadow-glow-primary);
			transform: translateY(-2px);
		}
		.menu-btn--link:hover {
			background-color: color-mix(in srgb, var(--color-bg-surface), transparent 20%);
			box-shadow: var(--shadow-glow-primary);
			transform: translateY(-2px);
		}
	}

	.menu-btn--game:active {
		background-color: var(--color-bg-card-hover);
		transform: scale(0.98);
		box-shadow: none;
	}

	.menu-btn--disabled {
		background-color: color-mix(in srgb, var(--color-disabled), transparent 50%);
		backdrop-filter: var(--blur-glass);
		-webkit-backdrop-filter: var(--blur-glass);
		color: var(--color-disabled-text);
		cursor: not-allowed;
		box-shadow: none;
		border: none;
	}

	.menu-btn--disabled:active {
		transform: none;
	}

	.menu-links {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		width: 100%;
	}

	.menu-btn--link {
		background-color: color-mix(in srgb, var(--color-primary), transparent 50%);
		backdrop-filter: var(--blur-glass);
		-webkit-backdrop-filter: var(--blur-glass);
		color: #ffffff;
		border: none;
		box-shadow: none;
	}

	.menu-btn--link:active {
		background-color: color-mix(in srgb, var(--color-bg-surface), transparent 30%);
		transform: scale(0.98);
	}
</style>
