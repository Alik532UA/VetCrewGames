<script lang="ts">
	import { page } from '$app/state';
	import { t, formatPlain } from '$lib/i18n';
	import { settings } from '$lib/services/settings.svelte';
	import { LANGUAGE_META, flagSrc, languageLabel } from '$lib/i18n/languages';
	import { langPath, languageFromParam, routeRestFromId, type Language } from '$lib/i18n/routing';

	/**
	 * Перемикач мови: прапор поточної в шапці, перелік усіх у меню.
	 *
	 * Доти тут була одна кнопка «EN», яка перемикала між двома мовами по колу.
	 * З двома це працює, з чотирма — ні: щоб дістатися четвертої, треба тричі
	 * клацнути й тричі перезавантажити сторінку.
	 *
	 * Пункти лишаються ПОСИЛАННЯМИ, а не кнопками: мова живе в адресі, тож у
	 * кожної є власний URL, і його має бути видно — щоб можна було відкрити в
	 * новій вкладці, поділитися й щоб пошуковик пройшов за `hreflang`.
	 */

	let open = $state(false);

	const current = $derived(languageFromParam(page.params.lang));
	const rest = $derived(routeRestFromId(page.route.id));

	function choose(lang: Language) {
		open = false;
		// Той самий вибір, що й раніше: пам'ятаємо мову, щоб голий шлях відкрився
		// нею наступного разу.
		settings.rememberLocale(lang);
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (open = false)} />

<div class="lang">
	<button
		type="button"
		class="header-btn lang__trigger"
		aria-haspopup="menu"
		aria-expanded={open}
		aria-label={formatPlain(t('header.toggleLocale'))}
		onclick={() => (open = !open)}
		data-testid="header-locale-btn"
	>
		<img src={flagSrc(current)} alt="" class="lang__flag" width="24" height="16" />
	</button>

	{#if open}
		<!-- Тло ловить будь-який натиск поза меню: без нього воно лишалося б
		     відкритим, поки не влучиш у сам перемикач. -->
		<div
			class="lang__backdrop"
			role="presentation"
			onpointerdown={() => (open = false)}
			data-testid="header-locale-backdrop"
		></div>

		<ul class="lang__menu" role="menu" data-testid="header-locale-menu">
			{#each LANGUAGE_META as meta (meta.code)}
				<li>
					<a
						class="lang__item"
						class:lang__item--active={meta.code === current}
						href={langPath(meta.code, rest)}
						hreflang={meta.code}
						role="menuitem"
						aria-current={meta.code === current ? 'true' : undefined}
						onclick={() => choose(meta.code)}
						data-testid="header-locale-{meta.code}-link"
					>
						<img src={flagSrc(meta.code)} alt="" class="lang__flag" width="24" height="16" />
						<span class="lang__label">{languageLabel(meta.code)}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.lang {
		position: relative;
		display: flex;
	}

	/*
	 * Прапор — картинка з фіксованою коробкою. Розміри стоять і в атрибутах, і
	 * тут: без атрибутів рядок шапки смикається, поки SVG вантажиться, а без
	 * CSS кожен прапор мав би свою натуральну ширину.
	 */
	.lang__flag {
		width: 24px;
		height: 16px;
		object-fit: cover;
		border-radius: 2px;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25);
	}

	.lang__backdrop {
		position: fixed;
		inset: 0;
		z-index: 9500;
	}

	.lang__menu {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		z-index: 9501;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 168px;
		margin: 0;
		padding: 6px;
		list-style: none;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		background: var(--color-bg-surface);
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
	}

	.lang__item {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		/* 44px — власний стандарт сенсорної цілі (ACCESSIBILITY-v8 § 8). */
		min-height: 44px;
		padding: 0 var(--space-sm);
		border-radius: var(--radius-sm);
		color: var(--color-text);
		font-size: var(--font-size-sm);
		white-space: nowrap;
	}

	.lang__item:hover {
		background: color-mix(in srgb, var(--color-accent), transparent 85%);
	}

	.lang__item--active {
		background: color-mix(in srgb, var(--color-accent), transparent 70%);
		font-weight: var(--font-weight-bold);
	}

	.lang__label {
		min-width: 0;
	}
</style>
