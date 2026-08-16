<script lang="ts">
	import { AlertTriangle, Check, X } from 'lucide-svelte';
	import { td, formatFont, t } from '$lib/i18n';
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
	 *
	 * Список показують ТРИЧІ на екран — по одному біля кожної тварини й один під
	 * смітником, — тож спільного заголовка тут немає: три «Розбори» поспіль
	 * нічого не пояснюють. Замість нього назва йде в `aria-label` групи.
	 */
	interface Props {
		verdicts: FeedingVerdict[];
		/** Тварини раунду — щоб назвати ціль словами, а не «bin»/«cow». */
		animals: readonly Animal[];
		/** Кому належить ця група — для читалок. */
		label: string;
		testId: string;
	}

	let { verdicts, animals, label, testId }: Props = $props();

	/** Підпис цілі: імʼя тварини або «Смітник». */
	function targetName(target: Target): string {
		if (target === BIN) return t('feeding.bin');
		const animal = animals.find((item) => item.id === target);
		return animal ? td(animal.nameKey) : String(target);
	}
</script>

<div class="verdicts" role="group" aria-label={label} data-testid={testId}>
	{#each verdicts as verdict (verdict.food.id)}
		<!--
			Небезпечна страва — та, чиє місце в смітнику й у якої є пояснення шкоди.
			Умова спільна для значка й для тексту навмисно: інакше вони розійшлися б
			і трикутник стояв би над поясненням про користь.
		-->
		{@const isHazard = verdict.correct === BIN && !!verdict.food.hazardKey}
		<div
			class="verdict"
			class:verdict--correct={verdict.isCorrect}
			data-testid="feeding-verdict-item-{verdict.food.id}"
		>
			<div class="verdict__head">
				<span class="verdict__mark">
					{#if !verdict.isCorrect}
						<X size={18} aria-hidden="true" />
					{:else if isHazard}
						<!-- Вгадав — але вгадав НЕБЕЗПЕКУ. Галочка тут гасила б саме те,
						     заради чого гра й існує. Колір лишається зеленим: відповідь
						     правильна, попереджає знак, а не помилку. -->
						<AlertTriangle size={18} aria-hidden="true" />
					{:else}
						<Check size={18} aria-hidden="true" />
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
				{#if isHazard}
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
