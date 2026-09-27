<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t, formatFont } from '$lib/i18n';

	/**
	 * ВІКНО ХАБУ «ГРАТИ ОНЛАЙН» — одна рамка на всі дороги в кімнату (рішення автора
	 * 2026-09-27, 6-A і 7-A): автоматичний пошук, створення кімнати й підключення за кодом,
	 * а ще «хто зможе зайти» на сторінках ігор (`CreateWindow`). Доти рамки не було, і
	 * панель, заголовок і «Назад» жили копією в кожному вікні.
	 *
	 * Вікно стоїть НА МІСЦІ хабу, а не поверх нього: вибір тут і є весь екран, а накладка
	 * вимагала б власних `Escape`, пастки фокуса й кліку по тлу, і перелік саморобних
	 * накладок лише коротшає (`src/overlays.test.ts`).
	 *
	 * ФОКУС ПЕРЕЇЖДЖАЄ НА ЗАГОЛОВОК, щойно вікно відкрила людина (`focusTitle`): кнопка, на
	 * якій стояв фокус, зникла разом із хабом, і без переїзду він падав би на `body` —
	 * читалка не сказала б нічого, а наступний Tab почався б із шапки. На першому показі
	 * сторінки (вікно «хто зможе зайти» за `?from`) фокус не забирається: людина могла вже
	 * почати натискати.
	 */
	interface Props {
		/** Основа локаторів: `{scope}-panel`, `{scope}-back-btn`. */
		scope: string;
		title: Snippet;
		children: Snippet;
		/** Перевести фокус на заголовок, щойно вікно зʼявилося. Лише коли його відкрила людина. */
		focusTitle?: boolean;
		/** «Назад»; без нього кнопки немає (пошук, що йде, закриває лише «Скасувати»). */
		onBack?: () => void;
		/**
		 * Ширший стовпець — для плиток вибору (`CreateWindow`): дві плитки меню «Грати» поруч
		 * у 26em стискалися так, що назва гри ламалася на два рядки.
		 */
		wide?: boolean;
	}

	let { scope, title, children, focusTitle = false, onBack, wide = false }: Props = $props();

	const focus = (node: HTMLElement) => {
		if (focusTitle) node.focus();
	};
</script>

<section class="window fill fill-window" data-testid="{scope}-panel">
	<div class="window__column" class:window__column--wide={wide}>
		<h2 class="window__title" tabindex="-1" {@attach focus}>{@render title()}</h2>
		{@render children()}
		{#if onBack}
			<button
				type="button"
				class="window__back btn-secondary"
				onclick={onBack}
				data-testid="{scope}-back-btn"
			>
				{@html formatFont(t('online.back'))}
			</button>
		{/if}
	</div>
</section>

<style>
	/*
	 * Та сама панель, що вікно «вас запросили» (`InviteWindow`). Розмір — `.fill-window`
	 * (global.css): доти тут стояло `min(26rem, 100%)`, і на ноутбуці вікно займало 13%
	 * екрана, а все довкола було порожнім (прохання автора 2026-09-27).
	 */
	.window {
		display: flex;
		flex-direction: column;
		padding: var(--space-md);
		border-radius: var(--radius-md);
		background: var(--color-bg-panel);
		box-shadow: var(--shadow-card);
		box-sizing: border-box;
	}

	/*
	 * ВМІСТ — СТОВПЦЕМ ПОСЕРЕДИНІ ПАНЕЛІ, а не на всю її ширину. Панель широка навмисно
	 * (`.fill-window`: понад 30% екрана), але кнопка на 60% екрана з одним словом — це
	 * рівно те «кнопки великі, в яких текст займає всього 10%», на яке автор уже скаржився
	 * (2026-09-27). 26em — рядок пояснення на два рядки, не довше.
	 */
	.window__column {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		width: min(100%, 26em);
		margin-inline: auto;
	}

	/* Плитки вибору — по 17 одиниць поруч, як у меню «Грати» (`.menu-tile`: основа 15, стеля 22). */
	.window__column--wide {
		width: min(100%, 36em);
	}

	/* Значок і назва — одним рядком; довга назва переноситься під значок, а не за край. */
	.window__title {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-sm);
		margin: 0;
		font-size: var(--font-size-lg);
		color: var(--color-text-on-panel);
	}

	/* «Назад» — кнопкою (`.btn-secondary`), а не голим текстом; 44px — сенсорна ціль. */
	.window__back {
		align-self: center;
		min-height: 44px;
		padding: 0 var(--space-md);
		border-radius: var(--radius-sm);
		font: inherit;
	}
</style>
