<script lang="ts">
	import { ArrowLeft, House } from 'lucide-svelte';
	import { fade } from 'svelte/transition';
	import { page } from '$app/state';
	import { t } from '$lib/i18n';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import type { TranslationKey } from '$lib/i18n/translations/uk';

	/**
	 * Ліва частина шапки: «назад» і «додому».
	 *
	 * Дві кнопки, бо це дві різні дії. НАЗАД робить один крок, і на вкладених
	 * екранах цей крок веде в підменю: із гри «Знайди пару» — у розділ «Знайди
	 * пару», а не в головне меню. Щоб вийти зовсім, доводилося тиснути двічі-тричі
	 * й щоразу вгадувати, скільки саме.
	 *
	 * Обидві лишаються ПОСИЛАННЯМИ, а не кнопками: середній клік, Ctrl-клік і
	 * робота без JS зберігаються. Сторінка зі власним кроком назад перехоплює
	 * звичайний клік у «назад» — але не в «додому»: власного головного меню не
	 * має ніхто, воно одне.
	 */
	interface Props {
		showBack: boolean;
		activeTitleKey: TranslationKey;
	}

	let { showBack, activeTitleKey }: Props = $props();

	const currentLanguage = $derived(languageFromParam(page.params.lang));
	/** На головній «назад» і «додому» вели б туди, де ти вже є. */
	const inside = $derived(showBack && activeTitleKey !== 'app.title');
</script>

<div class="game-header__left">
	{#if inside}
		<div in:fade={{ duration: 300 }} out:fade={{ duration: 200 }} class="btn-wrap">
			<a
				href={langPath(currentLanguage)}
				class="header-btn"
				aria-label={t('common.back')}
				data-testid="header-back-link"
				onclick={(e) => {
					if (!settings.headerBack) return;
					e.preventDefault();
					settings.headerBack();
				}}
			>
				<ArrowLeft size={22} />
			</a>
		</div>

		<div in:fade={{ duration: 300 }} out:fade={{ duration: 200 }} class="btn-wrap">
			<a
				href={langPath(currentLanguage)}
				class="header-btn"
				aria-label={t('common.mainMenu')}
				data-testid="header-home-link"
			>
				<House size={22} />
			</a>
		</div>
	{:else}
		<div in:fade={{ duration: 300 }} out:fade={{ duration: 200 }} class="btn-wrap">
			<div class="header-btn placeholder"></div>
		</div>
	{/if}
</div>

<style>
	.game-header__left {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
	}

	.btn-wrap {
		display: grid;
		grid-template-areas: 'btn';
		align-items: center;
	}

	.btn-wrap > * {
		grid-area: btn;
	}

	/* Заповнювач тримає місце, щоб заголовок не стрибав на головній. */
	.placeholder {
		visibility: hidden;
	}
</style>
