<script lang="ts">
	import { Check, Copy, QrCode } from 'lucide-svelte';
	import { t, formatFont } from '$lib/i18n';
	import { logService } from '$lib/services/logService.svelte';
	import RoomQr from './RoomQr.svelte';

	interface Props {
		code: string;
		joinUrl: string;
	}

	let { code, joinUrl }: Props = $props();

	let showMobileQr = $state(false);
	let linkCopied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	async function copyRoomLink() {
		try {
			await navigator.clipboard.writeText(joinUrl);
			linkCopied = true;
			clearTimeout(copyTimer);
			copyTimer = setTimeout(() => {
				linkCopied = false;
			}, 2500);
		} catch (error) {
			logService.warn('ui', 'clipboard copy denied', { reason: String(error) });
		}
	}
</script>

<section class="invite-panel">
	<div class="invite-panel__header">
		<p class="invite-panel__code">
			{@html formatFont(t('pairs.roomCode'))}:
			<b class="invite-panel__value" data-testid="pairs-room-code-value">{code}</b>
		</p>
		<div class="invite-panel__actions">
			<button
				type="button"
				class="btn-secondary invite-panel__btn"
				onclick={copyRoomLink}
				data-testid="pairs-copy-link-btn"
			>
				{#if linkCopied}
					<Check size={18} aria-hidden="true" />
					<span>{@html formatFont(t('pairs.linkCopied'))}</span>
				{:else}
					<Copy size={18} aria-hidden="true" />
					<span>{@html formatFont(t('pairs.copyLink'))}</span>
				{/if}
			</button>

			<button
				type="button"
				class="btn-secondary invite-panel__btn invite-panel__qr-toggle"
				onclick={() => (showMobileQr = !showMobileQr)}
				aria-expanded={showMobileQr}
				data-testid="pairs-toggle-qr-btn"
			>
				<QrCode size={18} aria-hidden="true" />
				<span>{@html formatFont(t(showMobileQr ? 'pairs.hideQr' : 'pairs.showQr'))}</span>
			</button>
		</div>
	</div>

	<div class="invite-panel__qr-wrap" class:invite-panel__qr-wrap--open={showMobileQr}>
		<RoomQr url={joinUrl} />
	</div>
</section>

<style>
	.invite-panel {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: var(--space-md);
		border-radius: var(--radius-md);
		background: var(--color-bg-panel);
		color: var(--color-text-on-panel);
		box-shadow: var(--shadow-card);
		box-sizing: border-box;
	}

	.invite-panel__header {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		width: 100%;
	}

	.invite-panel__code {
		margin: 0;
		text-align: center;
		color: var(--color-text-on-panel);
	}

	.invite-panel__value {
		font-size: var(--font-size-xl);
		letter-spacing: 0.25em;
		font-variant-numeric: tabular-nums;
	}

	.invite-panel__actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		width: 100%;
	}

	.invite-panel__btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-xs);
		min-height: 44px;
		width: 100%;
		padding: 0 var(--space-md);
		border-radius: var(--radius-sm);
		font: inherit;
		font-weight: var(--font-weight-bold);
		cursor: pointer;
	}

	.invite-panel__btn :global(svg) {
		flex-shrink: 0;
	}

	.invite-panel__qr-wrap {
		display: none;
		width: 100%;
	}

	.invite-panel__qr-wrap--open {
		display: block;
		margin-top: var(--space-xs);
	}

	@container (min-width: 44rem) {
		.invite-panel__qr-toggle {
			display: none;
		}

		.invite-panel__qr-wrap {
			display: block;
		}
	}
</style>
