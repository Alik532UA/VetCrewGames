<script lang="ts">
	import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-svelte';
	import { fly, fade } from 'svelte/transition';
	import { MediaQuery } from 'svelte/reactivity';
	import { toast } from '$lib/controllers/toast.svelte';
	import { t, formatFont, formatPlain } from '$lib/i18n';

	/**
	 * Показ тостів. Один екземпляр на весь сайт, у кореневому layout.
	 *
	 * Компонент нічого не вирішує — стан, таймери й пауза живуть у контролері
	 * (NOTIFICATIONS-v8 § 2). Тут лишається саме показ і чотири події, якими
	 * пауза вмикається: миша й фокус, кожна на вхід і на вихід.
	 */
	const reduceMotion = new MediaQuery('(prefers-reduced-motion: reduce)');
</script>

<div class="toasts" data-testid="toast-notifications-container">
	{#each toast.messages as message (message.id)}
		<div
			class="toast toast--{message.type}"
			in:fly={{ y: reduceMotion.current ? 0 : 16, duration: reduceMotion.current ? 0 : 250 }}
			out:fade={{ duration: reduceMotion.current ? 0 : 180 }}
			role={message.type === 'error' ? 'alert' : 'status'}
			data-testid="toast-message-{message.type}"
			onmouseenter={() => toast.pause(message.id)}
			onmouseleave={() => toast.resume(message.id)}
			onfocusin={() => toast.pause(message.id)}
			onfocusout={() => toast.resume(message.id)}
		>
			<span class="toast__icon" data-testid="toast-icon-{message.type}">
				{#if message.type === 'success'}
					<CheckCircle2 size={20} aria-hidden="true" />
				{:else if message.type === 'error'}
					<AlertCircle size={20} aria-hidden="true" />
				{:else if message.type === 'warn'}
					<AlertTriangle size={20} aria-hidden="true" />
				{:else}
					<Info size={20} aria-hidden="true" />
				{/if}
			</span>

			<div class="toast__content">
				<!--
					`toast-body-text`, а не `toast-text-label` із NOTIFICATIONS-v8 § 6:
					власний канон імен забороняє тип `-label` поза `<label>`, і саме
					він тут виконується перевіркою. Розбіжність свідома.
				-->
				<p class="toast__text" data-testid="toast-body-text">
					{@html formatFont(t(message.messageKey))}
				</p>
				{#if message.action}
					<button
						type="button"
						class="toast__action"
						onclick={() => {
							message.action?.onAction();
							toast.remove(message.id);
						}}
						data-testid="toast-action-btn"
					>
						{@html formatFont(t(message.action.labelKey))}
					</button>
				{/if}
			</div>

			<button
				type="button"
				class="toast__close"
				aria-label={formatPlain(t('common.close'))}
				onclick={() => toast.remove(message.id)}
				data-testid="toast-close-btn"
			>
				<X size={16} aria-hidden="true" />
			</button>

			<!--
				Смужка бере тривалість із того самого числа, що й таймер: два
				джерела розходяться, і візуально тост «доживає» не тоді, коли
				зникає насправді.
			-->
			<div
				class="toast__progress"
				style="animation-duration: {message.duration}ms"
				data-testid="toast-progress-bar"
				aria-hidden="true"
			></div>
		</div>
	{/each}
</div>

<style>
	.toasts {
		position: fixed;
		bottom: var(--space-md);
		left: var(--space-md);
		right: var(--space-md);
		z-index: 10000;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-sm);
		/* Контейнер кліки не ловить — ловлять самі тости. */
		pointer-events: none;
	}

	.toast {
		pointer-events: auto;
		position: relative;
		overflow: hidden;
		display: flex;
		align-items: flex-start;
		gap: var(--space-sm);
		width: 100%;
		max-width: 420px;
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		/*
		 * Тло — те саме, що й у решти поверхонь. Тонувати його за типом не можна:
		 * зеленувата чи червонувата підкладка в темній темі завалює контраст
		 * тексту (NOTIFICATIONS-v8 § 6). Тип несуть значок, рамка й смужка.
		 */
		background: var(--color-bg-surface);
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
	}

	.toast--success {
		border-color: var(--color-success);
	}
	.toast--warn {
		border-color: var(--color-warning);
	}
	.toast--error {
		border-color: var(--color-error);
	}
	.toast--info {
		border-color: var(--color-accent);
	}

	.toast--success .toast__icon {
		color: var(--color-success);
	}
	.toast--warn .toast__icon {
		color: var(--color-warning);
	}
	.toast--error .toast__icon {
		color: var(--color-error);
	}
	.toast--info .toast__icon {
		color: var(--color-accent);
	}

	.toast__icon {
		display: flex;
		flex-shrink: 0;
		padding-top: 2px;
	}

	.toast__content {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		flex: 1;
		min-width: 0;
	}

	.toast__text {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-text);
	}

	.toast__action {
		align-self: flex-start;
		/* 44px — власний стандарт сенсорної цілі (ACCESSIBILITY-v8 § 8). */
		min-height: 44px;
		padding: 0 var(--space-md);
		border-radius: var(--radius-sm);
		background: var(--color-accent);
		color: var(--color-text-on-accent);
		font: inherit;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-bold);
		cursor: pointer;
	}

	.toast__close {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 44px;
		height: 44px;
		margin: -10px -10px 0 0;
		border-radius: var(--radius-sm);
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.toast__close:hover {
		color: var(--color-text);
	}

	.toast__progress {
		position: absolute;
		bottom: 0;
		left: 0;
		width: 100%;
		height: 3px;
		transform-origin: left center;
		animation: toast-shrink linear forwards;
	}

	.toast--success .toast__progress {
		background: var(--color-success);
	}
	.toast--warn .toast__progress {
		background: var(--color-warning);
	}
	.toast--error .toast__progress {
		background: var(--color-error);
	}
	.toast--info .toast__progress {
		background: var(--color-accent);
	}

	/*
	 * Пауза має два незалежні механізми, і обидва обов'язкові: тут стає смужка,
	 * у контролері — сам таймер. Один без одного дає або тост, що зникає з
	 * повною смужкою, або смужку, що добігла до нуля на живому тості.
	 */
	.toast:hover .toast__progress,
	.toast:focus-within .toast__progress {
		animation-play-state: paused;
	}

	@keyframes toast-shrink {
		from {
			transform: scaleX(1);
		}
		to {
			transform: scaleX(0);
		}
	}
</style>
