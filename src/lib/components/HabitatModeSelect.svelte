<script lang="ts">
	import { Globe2, Trees } from 'lucide-svelte';
	import { fade } from 'svelte/transition';
	import { t, formatFont } from '$lib/i18n';
	import { langPath, type Language } from '$lib/i18n/routing';

	/**
	 * Стартовий екран гри «Де живем?»: вибір підрежиму (концепція, гра 3).
	 *
	 * Окремий компонент, а не блок у сторінці, і причина не в розмірі: це
	 * інший ЕКРАН, у якого немає нічого спільного з раундом — ні картки
	 * тварини, ні варіантів, ні кнопки перевірки. Стилі переїхали разом із
	 * розміткою: scoped-правила батька до дочірньої розмітки не дістають, і
	 * компілятор про це не попереджає (SVELTE-UI-v8 § 3.5).
	 *
	 * Пункти — ПОСИЛАННЯ, а не кнопки: кожен режим тепер має власну адресу, і
	 * її має бути видно. Середній клік відкриє в новій вкладці, а посилання
	 * можна просто надіслати.
	 */
	interface Props {
		lang: Language;
	}

	let { lang }: Props = $props();
</script>

<div class="mode-picker fill" in:fade={{ duration: 300 }}>
	<h2 class="mode-picker__title text-panel">{@html formatFont(t('habitat.chooseMode'))}</h2>

	<!--
		ПЛИТКИ, А НЕ РЯДКИ (прохання автора 2026-09-27: «класична проблема, що 50% вільного
		простору — зробити наш новий підхід з великими кнопками, коли іконка над текстом»). Той
		самий вигляд, що в меню «Грати» й у «Створити кімнату» (`.menu-tile-grid`).
	-->
	<nav class="menu-tile-grid">
		<a
			class="menu-btn menu-btn--game menu-tile"
			href={langPath(lang, 'game-habitat/continents')}
			data-testid="habitat-mode-continents-link"
		>
			<Globe2 class="menu-tile__icon" aria-hidden="true" />
			<strong>{@html formatFont(t('habitat.mode.continents'))}</strong>
			<span class="menu-tile__hint">{@html formatFont(t('habitat.mode.continents.hint'))}</span>
		</a>

		<a
			class="menu-btn menu-btn--game menu-tile"
			href={langPath(lang, 'game-habitat/biomes')}
			data-testid="habitat-mode-biomes-link"
		>
			<Trees class="menu-tile__icon" aria-hidden="true" />
			<strong>{@html formatFont(t('habitat.mode.biomes'))}</strong>
			<span class="menu-tile__hint">{@html formatFont(t('habitat.mode.biomes.hint'))}</span>
		</a>
	</nav>
</div>

<style>
	/*
	 * Власна стеля ширини, і вона тут обов'язкова.
	 *
	 * Сторінка гри від 1000px розширюється до 1100px — але заради ОДНОГО свого
	 * елемента, ряду варіантів у раунді. Цей екран у той перелік не потрапив і
	 * розтягувався на всі 1100: заміряно на 1730px вікні — кнопка 1100px, текст у
	 * ній 269px, тобто 755px порожнечі праворуч від підпису.
	 *
	 * Стеля — в одиницях екрана (`.fill`), а не 560px: дві плитки по 15 одиниць стають
	 * поруч і на великому екрані, де одиниця росте до 34px, а не падають одна під одну.
	 */
	.mode-picker {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		width: 100%;
		max-width: calc(var(--fill-u) * 36);
		margin: auto;
	}

	.mode-picker__title {
		margin: 0;
		text-align: center;
		font-size: var(--font-size-xl);
		color: var(--color-text);
	}
</style>
