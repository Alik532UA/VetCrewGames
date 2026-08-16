<script lang="ts">
	import { Check, X } from 'lucide-svelte';
	import { t, td, formatFont } from '$lib/i18n';
	import { BIN, type Target } from '$lib/config/feeding-game';
	import type { FeedingVerdict } from '$lib/controllers/feedingGame.svelte';
	import type { Animal } from '$lib/config/population-game';
	import type { TranslationKey } from '$lib/i18n/translations/uk';

	/**
	 * Розбір кожної страви після «Погодувати» (концепція, гра 1: «детальний
	 * розбір кожного рішення гравця»).
	 *
	 * Саме тут і живе сенс гри: чому шоколад отруйний для собаки, чому хліб
	 * шкодить качкам. Загальне «правильно / неправильно» цього не сказало б.
	 */
	interface Props {
		verdicts: FeedingVerdict[];
		/** Тварини раунду — щоб назвати ціль словами, а не «bin»/«cow». */
		animals: readonly Animal[];
	}

	let { verdicts, animals }: Props = $props();

	/** Підпис цілі: імʼя тварини або «Смітник». */
	function targetName(target: Target): string {
		if (target === BIN) return t('feeding.bin');
		const animal = animals.find((item) => item.id === target);
		return animal ? td(animal.nameKey) : String(target);
	}
</script>

<div class="verdicts" data-testid="feeding-verdicts-list">
	<h3 class="verdicts__title">{@html formatFont(t('feeding.resultTitle'))}</h3>

	{#each verdicts as verdict (verdict.food.id)}
		<div
			class="verdict"
			class:verdict--correct={verdict.isCorrect}
			data-testid="feeding-verdict-item-{verdict.food.id}"
		>
			<div class="verdict__head">
				<span class="verdict__mark">
					{#if verdict.isCorrect}
						<Check size={18} aria-hidden="true" />
					{:else}
						<X size={18} aria-hidden="true" />
					{/if}
				</span>
				<strong>{@html formatFont(t(verdict.food.nameKey as TranslationKey))}</strong>
			</div>

			{#if !verdict.isCorrect}
				<p class="verdict__correction">
					{@html formatFont(`${t('feeding.youGaveTo')} ${targetName(verdict.chosen)}`)}
					<br />
					{@html formatFont(`${t('feeding.shouldBe')} ${targetName(verdict.correct)}`)}
				</p>
			{/if}

			<p class="verdict__explanation">
				{#if verdict.correct === BIN && verdict.food.hazardKey}
					{@html formatFont(t(verdict.food.hazardKey as TranslationKey))}
				{:else}
					{@html formatFont(t(verdict.food.goodKey as TranslationKey))}
				{/if}
			</p>
		</div>
	{/each}
</div>

<style>
	.verdicts {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		width: 100%;
	}

	.verdicts__title {
		margin: 0;
		text-align: center;
		font-size: var(--font-size-lg);
		color: var(--color-text);
	}

	.verdict {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		padding: var(--space-md);
		border-radius: var(--radius-md);
		border-left: 4px solid var(--color-error);
		background: color-mix(in srgb, var(--color-bg-surface), transparent 20%);
		backdrop-filter: var(--blur-glass);
	}

	.verdict--correct {
		border-left-color: var(--color-success);
	}

	.verdict__head {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		color: var(--color-text);
	}

	.verdict__mark {
		display: flex;
		color: var(--color-error);
	}

	.verdict--correct .verdict__mark {
		color: var(--color-success);
	}

	.verdict__correction {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.verdict__explanation {
		margin: 0;
		font-size: var(--font-size-sm);
		line-height: 1.5;
		color: var(--color-text);
	}
</style>
