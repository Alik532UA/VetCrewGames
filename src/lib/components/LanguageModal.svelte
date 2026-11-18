<script lang="ts">
	import { fly } from 'svelte/transition';
	import { t, formatFont } from '$lib/i18n';
	import {
		LANGUAGE_META,
		LANGUAGE_GROUP_ORDER,
		LANGUAGE_GROUP_LABELS,
		flagSrc
	} from '$lib/i18n/languages';
	import { langPath, type Language, type RouteRest } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';

	interface Props {
		current: Language;
		rest?: RouteRest | '';
		onclose: () => void;
	}

	let { current, rest, onclose }: Props = $props();

	let langQuery = $state('');
	let panelEl: HTMLDivElement | undefined = $state();

	const filteredLanguages = $derived(
		LANGUAGE_META.filter((l) => {
			const q = langQuery.trim().toLowerCase();
			if (!q) return true;
			return l.label.toLowerCase().includes(q) || l.code.toLowerCase().includes(q);
		})
	);

	const visibleGroups = $derived(
		LANGUAGE_GROUP_ORDER.map((group) => ({
			group,
			items: filteredLanguages.filter((l) => l.group === group)
		})).filter((g) => g.items.length > 0)
	);

	const COLUMN_TOLERANCE = 24;

	function columnEdges(options: HTMLElement[]): number[] {
		const edges: number[] = [];
		for (const option of options) {
			const { left } = option.getBoundingClientRect();
			if (!edges.some((edge) => Math.abs(edge - left) < COLUMN_TOLERANCE)) edges.push(left);
		}
		return edges.sort((a, b) => a - b);
	}

	function columnNeighbour(
		options: HTMLElement[],
		cur: HTMLElement,
		direction: 1 | -1
	): HTMLElement | null {
		const edges = columnEdges(options);
		const columnOf = (el: HTMLElement) =>
			edges.findIndex(
				(edge) => Math.abs(edge - el.getBoundingClientRect().left) < COLUMN_TOLERANCE
			);

		const wanted = columnOf(cur) + direction;
		if (wanted < 0 || wanted >= edges.length) return null;

		const rect = cur.getBoundingClientRect();
		const middle = rect.top + rect.height / 2;

		let best: HTMLElement | null = null;
		let bestGap = Infinity;
		for (const option of options) {
			if (columnOf(option) !== wanted) continue;
			const r = option.getBoundingClientRect();
			const gap = Math.abs(r.top + r.height / 2 - middle);
			if (gap < bestGap) {
				bestGap = gap;
				best = option;
			}
		}
		return best;
	}

	function handleKeydown(event: KeyboardEvent) {
		const vertical = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
		const sideways = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
		const jump = event.key === 'Home' ? 'first' : event.key === 'End' ? 'last' : null;

		if (!vertical && !sideways && !jump) return;
		if (!panelEl) return;

		const focused = document.activeElement as HTMLElement | null;
		if (sideways && focused?.classList.contains('lang-search')) return;

		const options = [...panelEl.querySelectorAll<HTMLAnchorElement>('a.lang-item')];
		if (!options.length) return;

		const from = options.indexOf(focused as HTMLAnchorElement);
		let target: HTMLElement | null;

		if (jump) {
			target = jump === 'first' ? options[0] : options[options.length - 1];
		} else if (vertical) {
			target =
				from === -1
					? vertical === 1
						? options[0]
						: options[options.length - 1]
					: options[(from + vertical + options.length) % options.length];
		} else {
			target =
				from === -1 ? options[0] : columnNeighbour(options, options[from], sideways as 1 | -1);
		}

		event.preventDefault();
		event.stopPropagation();
		if (target) target.focus();
	}
</script>

<!--
	Панель вибору мови з пошуком і групами за взірцем CV / DigitalWorkshop.
	`stopPropagation` запобігає закриттю при кліку по полю пошуку чи тлу панелі.
-->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="lang-dropdown"
	role="region"
	aria-label={t('header.toggleLocale')}
	data-testid="header-locale-menu"
	id="header-locale-menu"
	bind:this={panelEl}
	onkeydown={handleKeydown}
	onclick={(e) => e.stopPropagation()}
	transition:fly={{ y: -8, duration: 180 }}
>
	<div class="lang-search-wrapper">
		<!--
			Поле швидкого пошуку мови отримує фокус автоматично при відкритті для негайного введення з клавіатури.
		-->
		<!-- svelte-ignore a11y_autofocus -->
		<input
			type="text"
			class="lang-search"
			placeholder={t('header.searchLocale')}
			aria-label={t('header.searchLocale')}
			data-testid="lang-search-input"
			bind:value={langQuery}
			autofocus
		/>
	</div>

	<div class="lang-groups" tabindex="-1">
		<div class="lang-columns">
			{#each visibleGroups as { group, items } (group)}
				<div class="lang-group">
					<span class="lang-group-label">{LANGUAGE_GROUP_LABELS[group]}</span>
					{#each items as meta (meta.code)}
						<a
							href={langPath(meta.code, rest)}
							class="lang-item"
							class:active={meta.code === current}
							hreflang={meta.code}
							data-testid="lang-{meta.code}-btn"
							onclick={() => {
								settings.rememberLocale(meta.code);
								onclose();
							}}
						>
							<img
								src={flagSrc(meta.code)}
								alt=""
								class="flag"
								width="20"
								height="14"
								loading="lazy"
							/>
							<span class="lang-label">{meta.label}</span>
						</a>
					{/each}
				</div>
			{:else}
				<p class="lang-empty">{@html formatFont(t('header.emptyLanguages'))}</p>
			{/each}
		</div>
	</div>
</div>

<style>
	/*
	 * Позиціювання відносно в'юпорта (як у CV і DigitalWorkshop).
	 * Кнопка вибору мови стоїть не на самому краї шапки, тому абсолютне прив'язування
	 * до кнопки виштовхувало панель за екран на вузьких екранах, а в RTL (іврит) — за лівий край вікна.
	 */
	.lang-dropdown {
		position: fixed;
		top: calc(var(--fill-u) * 3.5);
		right: max(
			calc(var(--fill-u) * 0.75),
			calc((100vw - var(--fill-u) * 75) / 2 + var(--fill-u) * 1)
		);
		left: auto;
		z-index: 9501;
		container-type: inline-size;
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: min(calc(100vw - var(--fill-u) * 1.5), 880px);
		max-height: min(85dvh, calc(100dvh - var(--fill-u) * 5));
		padding: 10px 12px;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		background: color-mix(in srgb, var(--color-bg-surface) 92%, transparent);
		backdrop-filter: var(--blur-glass, blur(16px));
		-webkit-backdrop-filter: var(--blur-glass, blur(16px));
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
		box-sizing: border-box;
	}

	/* В RTL панель акуратно вирівнюється за лівим краєм кнопок шапки */
	:global([dir='rtl']) .lang-dropdown {
		right: auto;
		left: max(
			calc(var(--fill-u) * 0.75),
			calc((100vw - var(--fill-u) * 75) / 2 + var(--fill-u) * 1)
		);
	}

	.lang-search-wrapper {
		flex-shrink: 0;
		padding-bottom: 2px;
	}

	.lang-search {
		width: 100%;
		box-sizing: border-box;
		padding: 8px 12px;
		font: inherit;
		font-size: 0.85rem;
		color: var(--color-text);
		background: color-mix(in srgb, var(--color-text), transparent 93%);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		outline: none;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	.lang-search::placeholder {
		color: var(--color-text-muted);
	}

	.lang-search:focus {
		border-color: var(--color-accent);
		box-shadow: 0 0 0 1px var(--color-accent);
	}

	.lang-groups {
		overflow-y: auto;
		flex: 1;
		min-height: 0;
		padding-inline-end: 2px;
	}

	.lang-columns {
		columns: 180px;
		column-gap: 16px;
	}

	/* На вузьких контейнерах (наприклад, телефон) одна колонка зі зручним скролом */
	@container (max-width: 400px) {
		.lang-columns {
			columns: 1;
		}
	}

	.lang-group {
		break-inside: avoid;
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding-bottom: 8px;
	}

	.lang-group-label {
		padding: 3px 8px 2px;
		font-size: 0.68rem;
		font-weight: var(--font-weight-bold, 700);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-muted);
	}

	.lang-item {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 28px;
		padding: 4px 8px;
		border-radius: var(--radius-sm);
		color: var(--color-text);
		text-decoration: none;
		font-size: 0.85rem;
		white-space: nowrap;
		transition:
			background 0.15s ease,
			color 0.15s ease;
		cursor: pointer;
	}

	.lang-item:hover,
	.lang-item:focus-visible {
		background: color-mix(in srgb, var(--color-text), transparent 90%);
		outline: none;
	}

	.lang-item.active {
		background: color-mix(in srgb, var(--color-accent) 22%, transparent);
		color: var(--color-text);
		font-weight: var(--font-weight-bold, 700);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 45%, transparent);
	}

	.lang-item.active:hover {
		background: color-mix(in srgb, var(--color-accent) 32%, transparent);
	}

	.flag {
		width: 20px;
		height: 14px;
		object-fit: cover;
		border-radius: 2px;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25);
		flex-shrink: 0;
	}

	.lang-label {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.lang-empty {
		padding: 16px;
		text-align: center;
		font-size: 0.85rem;
		color: var(--color-text-muted);
	}
</style>
