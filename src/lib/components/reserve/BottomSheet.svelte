<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '$lib/i18n';

	/**
	 * Панель, що висувається знизу поверх карти.
	 *
	 * Не модальне вікно по центру: на телефоні воно перекрило б усе, і звʼязок
	 * «натиснув вольєр на карті → бачу його» загубився б. Знизу карта лишається
	 * видною зверху, і видно, ЩО саме ти щойно вибрав.
	 */
	interface Props {
		title: string;
		onClose: () => void;
		children: Snippet;
	}

	let { title, onClose, children }: Props = $props();
</script>

<!--
	Тло ловить клік повз панель. `aria-hidden`, бо кнопка закриття вже є в
	заголовку: читалці не потрібні два способи зробити одне й те саме.
-->
<div
	class="sheet-backdrop"
	aria-hidden="true"
	onclick={onClose}
	data-testid="reserve-sheet-backdrop"
></div>

<section class="sheet" data-testid="reserve-sheet-panel">
	<header class="sheet__head">
		<h2 class="sheet__title">{title}</h2>
		<button
			type="button"
			class="sheet__close"
			aria-label={t('common.close')}
			onclick={onClose}
			data-testid="reserve-sheet-close-btn">×</button
		>
	</header>

	<div class="sheet__body">
		{@render children()}
	</div>
</section>

<style>
	.sheet-backdrop {
		position: fixed;
		inset: 0;
		z-index: 20;
		background: rgb(0 0 0 / 45%);
	}

	.sheet {
		position: fixed;
		right: 0;
		bottom: 0;
		left: 0;
		z-index: 21;
		display: flex;
		flex-direction: column;
		/*
		 * Не більше 70% висоти: над панеллю має лишатися видно карту, інакше
		 * вона нічим не відрізняється від модального вікна.
		 */
		max-height: 70dvh;
		border-radius: var(--radius-md) var(--radius-md) 0 0;
		background: var(--color-bg-panel);
		box-shadow: 0 -8px 24px rgb(0 0 0 / 35%);
	}

	.sheet__head {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
		justify-content: space-between;
		padding: var(--space-sm) var(--space-md);
		border-bottom: 1px solid var(--color-border);
	}

	.sheet__title {
		margin: 0;
		font-size: var(--font-size-lg);
	}

	.sheet__close {
		min-width: 44px;
		min-height: 44px;
		border-radius: var(--radius-sm);
		color: inherit;
		font-size: var(--font-size-lg);
		cursor: pointer;
	}

	.sheet__body {
		flex: 1;
		padding: var(--space-md);
		overflow-y: auto;
		/* Інерція на iOS: без цього прокрутка всередині панелі відчувається мертвою. */
		-webkit-overflow-scrolling: touch;
	}
</style>
