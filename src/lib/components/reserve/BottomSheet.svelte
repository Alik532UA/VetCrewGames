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
		/*
		 * НАД смугою кнопок, а не під нею.
		 *
		 * Доти панель стояла в `bottom: 0` і накривала ту саму смугу, з якої її
		 * відкрили: гравець тиснув «Вольєри» й переставав бачити, що натиснув.
		 * Відступ у 4rem — висота смуги плюс проміжок.
		 */
		bottom: 4.5rem;
		/*
		 * Не на всю ширину: панель зі списком у три слова, розтягнута на 1900px,
		 * читається як помилка розкладки. Ліворуч лишається видною карта.
		 */
		left: 50%;
		width: min(34rem, calc(100% - 2 * var(--space-sm)));
		transform: translateX(-50%);
		border-radius: var(--radius-md);
		z-index: 21;
		display: flex;
		flex-direction: column;
		/*
		 * Стеля — усе вільне місце, а не частка екрана.
		 *
		 * Було 62% висоти, і на високому вікні панель штучно стискалася: половина
		 * екрана порожня, а список усередині прокручується. Тепер межа рахується від
		 * того, що справді зайнято: смуга кнопок унизу (`bottom`), шапка з
		 * показниками зверху й проміжок. Карту над панеллю все одно видно — саме
		 * стільки, скільки лишила шапка.
		 */
		max-height: calc(100dvh - 4.5rem - 7rem);
		background: var(--color-bg-panel);
		box-shadow: 0 8px 32px rgb(0 0 0 / 45%);
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
