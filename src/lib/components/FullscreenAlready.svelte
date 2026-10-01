<script lang="ts">
	import { formatFont } from '$lib/i18n';
	import type { Share } from 'lucide-svelte';
	import DynamicIcon from './ui/DynamicIcon.svelte';

	interface Props {
		label: (key: string) => string;
		fullscreenIcon: typeof Share;
		onfullscreen: () => void;
		onclose: () => void;
	}

	let { label, fullscreenIcon, onfullscreen, onclose }: Props = $props();
</script>

<p class="offer__lead" data-testid="fullscreen-offer-already-lead-text">
	{@html formatFont(label('install.alreadyInstalled.lead'))}
</p>
<p class="offer__note" data-testid="fullscreen-offer-already-hint-text">
	{@html formatFont(label('install.alreadyInstalled.hint'))}
</p>
<div class="offer__already-actions">
	<button
		type="button"
		class="offer__browser-btn btn-primary"
		onclick={onfullscreen}
		data-testid="fullscreen-offer-already-browser-btn"
	>
		<span class="offer__icon" aria-hidden="true"><DynamicIcon icon={fullscreenIcon} /></span>
		<span class="offer__label">{@html formatFont(label('install.browser'))}</span>
	</button>
	<button
		type="button"
		class="offer__done btn-secondary"
		onclick={onclose}
		data-testid="fullscreen-offer-already-done-btn"
	>
		{@html formatFont(label('install.done'))}
	</button>
</div>

<style>
	.offer__lead,
	.offer__note {
		margin: 0;
		color: var(--color-text-on-panel);
	}

	.offer__lead {
		font-weight: var(--font-weight-bold);
	}

	.offer__already-actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		margin-top: auto;
	}

	.offer__browser-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		min-height: 44px;
		padding: 0 var(--space-md);
		border-radius: var(--radius-sm);
		font: inherit;
		font-weight: var(--font-weight-bold);
		cursor: pointer;
	}

	.offer__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-accent);
	}

	.offer__icon :global(svg) {
		flex-shrink: 0;
		width: calc(var(--fill-u) * 1.5);
		height: calc(var(--fill-u) * 1.5);
	}

	.offer__label {
		font-weight: var(--font-weight-bold);
	}

	.offer__done {
		min-height: 44px;
		border-radius: var(--radius-sm);
		font: inherit;
		font-weight: var(--font-weight-bold);
	}
</style>
