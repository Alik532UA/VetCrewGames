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

<div class="mode-picker" in:fade={{ duration: 300 }}>
	<h2 class="mode-picker__title text-panel">{@html formatFont(t('habitat.chooseMode'))}</h2>

	<a
		class="mode-btn btn-secondary"
		href={langPath(lang, 'game-habitat/continents')}
		data-testid="habitat-mode-continents-link"
	>
		<Globe2 size={28} aria-hidden="true" />
		<span class="mode-btn__text">
			<strong>{@html formatFont(t('habitat.mode.continents'))}</strong>
			<small>{@html formatFont(t('habitat.mode.continents.hint'))}</small>
		</span>
	</a>

	<a
		class="mode-btn btn-secondary"
		href={langPath(lang, 'game-habitat/biomes')}
		data-testid="habitat-mode-biomes-link"
	>
		<Trees size={28} aria-hidden="true" />
		<span class="mode-btn__text">
			<strong>{@html formatFont(t('habitat.mode.biomes'))}</strong>
			<small>{@html formatFont(t('habitat.mode.biomes.hint'))}</small>
		</span>
	</a>
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

	/* Режим — кнопкою (`.btn-secondary`), а не напівпрозорою панеллю з тінню (2026-09-27). */
	.mode-btn {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		width: 100%;
		padding: var(--space-lg);
		border-radius: var(--radius-md);
		text-decoration: none;
		font: inherit;
		text-align: left;
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

	/*
	 * Пояснення приглушене КЕГЛЕМ, а не прозорістю — та сама причина, що в `RoomList`: на
	 * тлі кнопки (`--color-bg-card`) `opacity: 0.85` давала 4,01:1 у світло-зеленій темі й
	 * 3,71:1 у зимовій (заміряно `tests/contrast-runtime.spec.ts`).
	 */
	.mode-btn__text small {
		font-size: var(--font-size-sm);
	}

</style>
