<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t, formatFont } from '$lib/i18n';
	import type { TranslationKey } from '$lib/i18n/translations/uk';

	/**
	 * ПЕРЕГЛЯД МИНУЛОГО ПИТАННЯ — рамка, спільна на пʼять соло-ігор (прохання автора
	 * 2026-09-26): «можна перейти на попередні питання, щоб переглянути їх».
	 *
	 * Саме питання малює гра — тією самою дошкою, у стані «відповіли», — а рамка
	 * каже, ЯКЕ це питання, і дає дорогу назад. Поточне питання тим часом лежить у
	 * контролері неторкане: повернення відкриває його рівно в тому стані, у якому
	 * його лишили.
	 */
	interface Props {
		/** Котре питання (від нуля). */
		index: number;
		total: number;
		/** Куди веде «назад»: до поточного питання чи до підсумку. */
		backKey?: TranslationKey;
		onback: () => void;
		children: Snippet;
	}

	let { index, total, backKey = 'review.back', onback, children }: Props = $props();
</script>

<section class="review text-panel" data-testid="round-review-panel">
	<div class="review__head">
		<h2 class="review__title">
			{@html formatFont(`${t('review.question')} ${index + 1} ${t('review.of')} ${total}`)}
		</h2>
		<button type="button" class="btn-primary" onclick={onback} data-testid="round-review-back-btn">
			{@html formatFont(t(backKey))}
		</button>
	</div>
	{@render children()}
</section>

<style>
	.review {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-sm);
		width: 100%;
		padding: var(--space-sm);
		box-sizing: border-box;
	}

	/* Заголовок і «назад» — одним рядком, що переноситься на вузькому екрані. */
	.review__head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-sm);
		width: 100%;
	}

	.review__title {
		margin: 0;
		font-size: var(--font-size-md);
	}
</style>
