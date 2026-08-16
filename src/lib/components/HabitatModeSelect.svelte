<script lang="ts">
	import { Globe2, Trees } from 'lucide-svelte';
	import { fade } from 'svelte/transition';
	import { t, formatFont } from '$lib/i18n';
	import type { HabitatMode } from '$lib/config/habitat-game';

	/**
	 * Стартовий екран гри «Де живем?»: вибір підрежиму (концепція, гра 3).
	 *
	 * Окремий компонент, а не блок у сторінці, і причина не в розмірі: це
	 * інший ЕКРАН, у якого немає нічого спільного з раундом — ні картки
	 * тварини, ні варіантів, ні кнопки перевірки. Стилі переїхали разом із
	 * розміткою: scoped-правила батька до дочірньої розмітки не дістають, і
	 * компілятор про це не попереджає (SVELTE-UI-v8 § 3.5).
	 */
	interface Props {
		onchoose: (mode: HabitatMode) => void;
	}

	let { onchoose }: Props = $props();
</script>

<div class="mode-picker" in:fade={{ duration: 300 }}>
	<h2 class="mode-picker__title text-panel">{@html formatFont(t('habitat.chooseMode'))}</h2>

	<button
		type="button"
		class="mode-btn"
		onclick={() => onchoose('continents')}
		data-testid="habitat-mode-continents-btn"
	>
		<Globe2 size={28} aria-hidden="true" />
		<span class="mode-btn__text">
			<strong>{@html formatFont(t('habitat.mode.continents'))}</strong>
			<small>{@html formatFont(t('habitat.mode.continents.hint'))}</small>
		</span>
	</button>

	<button
		type="button"
		class="mode-btn"
		onclick={() => onchoose('biomes')}
		data-testid="habitat-mode-biomes-btn"
	>
		<Trees size={28} aria-hidden="true" />
		<span class="mode-btn__text">
			<strong>{@html formatFont(t('habitat.mode.biomes'))}</strong>
			<small>{@html formatFont(t('habitat.mode.biomes.hint'))}</small>
		</span>
	</button>
</div>

<style>
	/*
	 * Власна стеля ширини, і вона тут обов'язкова.
	 *
	 * Сторінка гри від 1000px розширюється до 1100px — але заради ОДНОГО свого
	 * елемента, ряду варіантів у раунді. Решту вона там-таки підрізає до 460px.
	 * Цей екран у той перелік не потрапив і розтягувався на всі 1100: заміряно
	 * на 1730px вікні — кнопка 1100px, текст у ній 269px, тобто 755px порожнечі
	 * праворуч від підпису.
	 *
	 * 560px — це та сама ширина, яку сторінка має до розширення. Вибір режиму
	 * так виглядає однаково на планшеті й на великому екрані, а не як окремий
	 * стан, що зʼявляється лише на широкому вікні.
	 */
	.mode-picker {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		width: 100%;
		max-width: 560px;
		margin: auto;
	}

	.mode-picker__title {
		margin: 0;
		text-align: center;
		font-size: var(--font-size-xl);
		color: var(--color-text);
	}

	.mode-btn {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		width: 100%;
		padding: var(--space-lg);
		border: none;
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-bg-panel), transparent 25%);
		backdrop-filter: var(--blur-glass);
		color: var(--color-text-on-panel);
		box-shadow: var(--shadow-card);
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	@media (hover: hover) {
		.mode-btn:hover {
			transform: translateY(-2px);
			box-shadow: var(--shadow-glow-primary);
		}
	}

	.mode-btn__text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.mode-btn__text strong {
		font-size: var(--font-size-lg);
	}

	.mode-btn__text small {
		font-size: var(--font-size-sm);
		opacity: 0.85;
	}

</style>
