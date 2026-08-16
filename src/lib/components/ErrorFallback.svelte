<script lang="ts">
	import { t, formatPlain } from '$lib/i18n';
	import { langPath, type Language } from '$lib/i18n/routing';

	/**
	 * Те, що показує межа помилок замість вмісту, який упав.
	 *
	 * Винесено з `+layout.svelte` разом зі СТИЛЯМИ. Це не формальність:
	 * Svelte скоупить стилі по компоненту, і правило, залишене в батьківському
	 * блоці стилів, до цієї розмітки не застосувалося б ніколи — без жодного
	 * попередження від компілятора (SVELTE-UI-v8 § 3.5).
	 *
	 * Назви тегів тут навмисно без кутових дужок: `svelte-check` сканує вміст
	 * `script` наївніше за компілятор, і літеральний тег стилів у коментарі дає
	 * «`script` was left open» на весь файл. Компілятор при цьому такий файл
	 * збирає без жодного слова — знайдено саме цим розходженням.
	 */
	interface Props {
		/** Мова поточної сторінки: посилання «на головну» має її зберегти. */
		lang: Language;
		/** Повторна спроба відрендерити те, що впало. Дає сама межа помилок. */
		onretry: () => void;
	}

	let { lang, onretry }: Props = $props();
</script>

<!-- `assertive`, бо це не інформація, а поломка того, що людина зараз робила. -->
<div class="error-fallback" role="alert" aria-live="assertive" data-testid="render-error-message">
	<h2>{formatPlain(t('error.title'))}</h2>
	<p>{formatPlain(t('error.message'))}</p>
	<div class="error-fallback__actions">
		<button type="button" onclick={onretry} data-testid="render-error-retry-btn">
			{formatPlain(t('error.retry'))}
		</button>
		<a href={langPath(lang)} data-testid="render-error-home-link">
			{formatPlain(t('error.goHome'))}
		</a>
	</div>
</div>

<style>
	.error-fallback {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-md);
		padding: var(--space-xl);
		text-align: center;
		max-width: 600px;
		margin: var(--space-xl) auto;
	}

	.error-fallback__actions {
		display: flex;
		gap: var(--space-md);
		flex-wrap: wrap;
		justify-content: center;
	}

	.error-fallback button,
	.error-fallback a {
		padding: var(--space-sm) var(--space-lg);
		border: 2px solid currentColor;
		border-radius: var(--radius-md);
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
		text-decoration: none;
	}
</style>
