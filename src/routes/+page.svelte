<script lang="ts">
	import { t } from '$lib/i18n';
	import GameHeader from '$lib/components/GameHeader.svelte';
	import { base } from '$app/paths';

	const games = [
		{ key: 'menu.game.feeding' as const, href: `${base}/game-feeding`, disabled: true },
		{ key: 'menu.game.population' as const, href: `${base}/game-population`, disabled: false },
		{ key: 'menu.game.habitat' as const, href: `${base}/game-habitat`, disabled: true },
		{ key: 'menu.game.mythbusters' as const, href: `${base}/game-mythbusters`, disabled: true },
		{ key: 'menu.game.family' as const, href: `${base}/game-family`, disabled: true }
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

<GameHeader titleKey="app.title" showBack={false} />

<div class="menu-page">

	<nav class="menu-grid">
		{#each games as game, i}
			{#if game.disabled}
				<button class="menu-btn menu-btn--game menu-btn--disabled anim-stagger-{i + 1}" disabled>
					{t(game.key)}
				</button>
			{:else}
				<a href={game.href} class="menu-btn menu-btn--game anim-stagger-{i + 1}">
					{t(game.key)}
				</a>
			{/if}
		{/each}
	</nav>

	<div class="menu-links">
		{#each links as link}
			<a href={link.href} class="menu-btn menu-btn--link" target="_blank" rel="noopener noreferrer">
				{t(link.key)}
			</a>
		{/each}
	</div>
</div>

<style>
	.menu-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		min-height: calc(100dvh - 80px);
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
		padding: var(--space-lg) var(--space-xl);
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-medium);
		border-radius: var(--radius-md);
		transition:
			transform var(--transition-fast),
			box-shadow var(--transition-normal),
			background-color var(--transition-normal);
		text-align: center;
		text-decoration: none;
		animation: card-enter 400ms ease both;
	}

	.menu-btn--game {
		background-color: var(--color-bg-panel);
		color: var(--color-text-on-panel);
		box-shadow: var(--shadow-card);
	}

	.menu-btn--game:hover {
		background-color: var(--color-bg-card-hover);
		box-shadow: var(--shadow-glow-primary);
		transform: translateY(-2px);
	}

	.menu-btn--game:active {
		animation: pop 200ms ease;
	}

	.menu-btn--disabled {
		background-color: var(--color-disabled);
		color: var(--color-disabled-text);
		cursor: not-allowed;
		box-shadow: none;
	}

	.menu-btn--disabled:hover {
		background-color: var(--color-disabled);
		box-shadow: none;
		transform: none;
	}

	.menu-links {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		width: 100%;
	}

	.menu-btn--link {
		background-color: transparent;
		color: var(--color-primary);
		border: 1px solid var(--color-border);
		box-shadow: none;
	}

	.menu-btn--link:hover {
		background-color: var(--color-bg-surface);
		box-shadow: var(--shadow-glow-primary);
		transform: translateY(-2px);
	}
</style>
