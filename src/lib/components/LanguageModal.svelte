<script lang="ts">
	import { t } from '$lib/i18n';
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
			edges.findIndex((edge) => Math.abs(edge - el.getBoundingClientRect().left) < COLUMN_TOLERANCE);

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
			target = from === -1 ? options[0] : columnNeighbour(options, options[from], sideways as 1 | -1);
		}

		event.preventDefault();
		event.stopPropagation();
		if (target) target.focus();
	}
</script>

<!--
	Панель вибору мови з пошуком і групами.
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
>
	<div class="lang-search-wrapper">
		<!--
			Поле швидкого пошуку мови отримує фокус автоматично при відкритті для негайного введення з клавіатури.
		-->
		<!-- svelte-ignore a11y_autofocus -->
		<input
			type="search"
			class="lang-search"
			placeholder={t('header.toggleLocale')}
			aria-label={t('header.toggleLocale')}
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
				<p class="lang-empty">—</p>
			{/each}
		</div>
	</div>
</div>

<style>
	.lang-dropdown {
		position: absolute;
		top: calc(100% + var(--fill-u) * 0.375);
		right: 0;
		z-index: 9501;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs, 6px);
		width: min(92vw, 760px);
		max-height: min(80dvh, 540px);
		padding: calc(var(--fill-u) * 0.5);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		background: var(--color-bg-surface);
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
		box-sizing: border-box;
	}

	.lang-search-wrapper {
		flex-shrink: 0;
		padding-bottom: 4px;
	}

	.lang-search {
		width: 100%;
		box-sizing: border-box;
		padding: 8px 12px;
		font: inherit;
		font-size: var(--font-size-sm, 0.875rem);
		color: var(--color-text);
		background: var(--color-bg-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		outline: none;
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
		padding-right: 2px;
	}

	.lang-columns {
		columns: 145px;
		column-gap: 12px;
	}

	.lang-group {
		break-inside: avoid;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding-bottom: 10px;
	}

	.lang-group-label {
		padding: 4px 6px 2px;
		font-size: 0.75rem;
		font-weight: var(--font-weight-bold, 700);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-muted);
	}

	.lang-item {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 36px;
		padding: 4px 8px;
		border-radius: var(--radius-sm);
		color: var(--color-text);
		text-decoration: none;
		font-size: var(--font-size-sm, 0.85rem);
		transition: background 0.15s ease;
		cursor: pointer;
	}

	.lang-item:hover,
	.lang-item:focus-visible {
		background: color-mix(in srgb, var(--color-text), transparent 90%);
		outline: none;
	}

	.lang-item.active {
		background: var(--color-accent);
		color: var(--color-text-on-accent);
		font-weight: var(--font-weight-bold, 700);
	}

	.lang-item.active:hover {
		background: var(--color-accent-hover, var(--color-accent));
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
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.lang-empty {
		padding: 16px;
		text-align: center;
		color: var(--color-text-muted);
	}
</style>
