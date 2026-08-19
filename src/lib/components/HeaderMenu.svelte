<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Випадний список у шапці: кнопка зі значком і перелік під нею.
	 *
	 * Один компонент на мову й на тему, бо це одна поведінка: відкрити, вибрати,
	 * закрити. Дві копії розійшлися б на першій же правці клавіатури.
	 *
	 * Стан «відкрито» тримає БАТЬКО, а не цей компонент. Так відкриття одного
	 * меню закриває інше — правило, якому нема де жити всередині жодного з них.
	 */
	export interface HeaderMenuItem {
		id: string;
		label: string;
		/**
		 * Наявність робить пункт ПОСИЛАННЯМ. Потрібне мові: вона живе в адресі,
		 * тож у кожної є власний URL, і його має бути видно — щоб відкривалося в
		 * новій вкладці й щоб пошуковик пройшов за `hreflang`.
		 */
		href?: string;
		hreflang?: string;
		active: boolean;
	}

	interface Props {
		/** Назва кнопки для читалок. */
		label: string;
		/**
		 * Клавіша, якою кнопку можна натиснути з клавіатури, — у форматі
		 * `aria-keyshortcuts` (напр. `'T'`).
		 *
		 * Скорочення, про яке ніде не написано, існує лише для автора
		 * (HOTKEYS-v8 § 5). `undefined` — коли скорочення зараз не діє: вимкнене
		 * скорочення, оголошене читалці, гірше за неоголошене.
		 */
		keyshortcuts?: string;
		/** Основа `data-testid`: `header-locale` дає `header-locale-btn`. */
		testId: string;
		items: HeaderMenuItem[];
		open: boolean;
		onToggle: (open: boolean) => void;
		onselect: (id: string) => void;
		trigger: Snippet;
		itemVisual?: Snippet<[HeaderMenuItem]>;
	}

	let { label, keyshortcuts, testId, items, open, onToggle, onselect, trigger, itemVisual }: Props =
		$props();

	/**
	 * Escape закриває й вертає фокус на кнопку, стрілки ходять по списку, Home і
	 * End стрибають на краї. Без цього меню, відкрите з клавіатури, стає
	 * пасткою: вийти з нього нічим (ACCESSIBILITY-v8 § 2).
	 */
	function handleKeydown(event: KeyboardEvent) {
		const menu = event.currentTarget as HTMLElement;
		const entries = [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')];
		const index = entries.indexOf(document.activeElement as HTMLElement);

		switch (event.key) {
			case 'Escape':
				event.stopPropagation();
				onToggle(false);
				menu.closest('.menu')?.querySelector('button')?.focus();
				break;
			case 'ArrowDown':
				event.preventDefault();
				entries[(index + 1) % entries.length]?.focus();
				break;
			case 'ArrowUp':
				event.preventDefault();
				entries[(index - 1 + entries.length) % entries.length]?.focus();
				break;
			case 'Home':
				event.preventDefault();
				entries[0]?.focus();
				break;
			case 'End':
				event.preventDefault();
				entries.at(-1)?.focus();
				break;
		}
	}

	/** Фокус заходить у список, щойно той відкрився: стрілкам треба звідки почати. */
	function focusFirstItem(node: HTMLElement) {
		node.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
	}
</script>

<div class="menu">
	<button
		type="button"
		class="header-btn"
		onclick={(event) => {
			/*
			 * Без цього клік дійде до вікна, де стоїть закривач, — і меню
			 * згорнеться в тому ж такті, у якому розгорнулося.
			 *
			 * Доти цю роль грала підкладка на весь екран, і саме вона й ламала
			 * повторний натиск: підкладка ловила `pointerdown` і закривала меню,
			 * а `click` потім доходив до кнопки, яка відкривала його знову.
			 */
			event.stopPropagation();
			onToggle(!open);
		}}
		aria-haspopup="menu"
		aria-expanded={open}
		aria-label={label}
		aria-keyshortcuts={keyshortcuts}
		data-testid="{testId}-btn"
	>
		{@render trigger()}
	</button>

	{#if open}
		<div
			class="menu__list"
			role="menu"
			tabindex="-1"
			onkeydown={handleKeydown}
			data-testid="{testId}-menu"
			{@attach focusFirstItem}
		>
			{#each items as item (item.id)}
				{#if item.href}
					<a
						class="menu__item"
						class:menu__item--active={item.active}
						href={item.href}
						hreflang={item.hreflang}
						role="menuitem"
						aria-current={item.active ? 'true' : undefined}
						onclick={() => onselect(item.id)}
						data-testid="{testId}-{item.id}-link"
					>
						{@render itemVisual?.(item)}
						<span class="menu__label">{item.label}</span>
					</a>
				{:else}
					<button
						type="button"
						class="menu__item"
						class:menu__item--active={item.active}
						role="menuitem"
						aria-current={item.active ? 'true' : undefined}
						onclick={() => onselect(item.id)}
						data-testid="{testId}-{item.id}-btn"
					>
						{@render itemVisual?.(item)}
						<span class="menu__label">{item.label}</span>
					</button>
				{/if}
			{/each}
		</div>
	{/if}
</div>

<style>
	.menu {
		position: relative;
		display: flex;
	}

	/*
	 * Прив'язка до правого краю кнопки, без вимірювань.
	 *
	 * Обидві кнопки стоять у правій групі шапки, тож ліворуч від них місця
	 * завжди більше за ширину списку: навіть на 320px найлівіша з них має
	 * праворуч край на ~224px, і 180px списку починаються з 44. Міряти нема чого.
	 */
	.menu__list {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		z-index: 9501;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 180px;
		padding: 6px;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		background: var(--color-bg-surface);
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
	}

	.menu__item {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		/* 44px — власний стандарт сенсорної цілі (ACCESSIBILITY-v8 § 8). */
		min-height: 44px;
		padding: 0 var(--space-sm);
		border-radius: var(--radius-sm);
		color: var(--color-text);
		font: inherit;
		font-size: var(--font-size-sm);
		text-align: left;
		white-space: nowrap;
		cursor: pointer;
	}

	.menu__item:hover {
		background: color-mix(in srgb, var(--color-accent), transparent 85%);
	}

	.menu__item--active {
		background: color-mix(in srgb, var(--color-accent), transparent 70%);
		font-weight: var(--font-weight-bold);
	}

	.menu__label {
		min-width: 0;
	}
</style>
