<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import type { Member } from '$lib/net/roomTypes';
	import Flag from '$lib/components/ui/Flag.svelte';
	import YouTag from '$lib/components/ui/YouTag.svelte';

	/**
	 * Спільне табло вікторини: хто на якому кроці й скільки набрав.
	 *
	 * ## Це і є «спільна» частина партії
	 *
	 * Дошки в кожного своя (усі відповідають одночасно), тож єдине, що всі бачать
	 * однаково, — програма й рахунок. Табло тут не оздоба поруч із грою: воно і є
	 * причина грати разом.
	 *
	 * ## Крок, а не відсоток
	 *
	 * «3 / 6» відповідає на питання «скільки ще», а відсоток — ні: у партії шість
	 * кроків, і «50%» вимагає порахувати назад. Числом видно й те, чого відсоток
	 * не показує взагалі: наскільку суперник попереду або позаду.
	 */
	interface Props {
		players: Member[];
		/** Хто на якому кроці й з яким рахунком. Ключ — `uid`. */
		progress: Record<string, { step: number; score: number }>;
		/** Скільки кроків у партії. Нуль — програма ще не приїхала. */
		total: number;
		me: string;
	}

	let { players, progress, total, me }: Props = $props();

	/*
	 * Порядок — за РАХУНКОМ, а не за входом.
	 *
	 * Тут це не косметика: у вікторині всі рухаються одночасно, і питання, на яке
	 * дивляться, — «хто веде». Порядок входу відповідав би на нього лише
	 * випадково. Тайбрейк за `order`, щоб при рівному рахунку рядки не стрибали
	 * місцями на кожному оновленні.
	 */
	const ranked = $derived(
		[...players].sort((a, b) => {
			const byScore = (progress[b.uid]?.score ?? 0) - (progress[a.uid]?.score ?? 0);
			return byScore !== 0 ? byScore : a.order - b.order;
		})
	);
</script>

<ul class="scores text-panel" data-testid="quiz-scores-list">
	{#each ranked as player (player.uid)}
		{@const own = progress[player.uid] ?? { step: 0, score: 0 }}
		<li class="scores__row" data-testid="quiz-score-{player.uid}-item">
			<span class="scores__who">
				<Flag code={player.country} />
				{player.name}{#if player.uid === me}&nbsp;<YouTag />{/if}
			</span>
			<span class="scores__step">
				{#if total > 0 && own.step >= total}
					{@html formatFont(t('quiz.finished'))}
				{:else}
					{own.step}&nbsp;/&nbsp;{total}
				{/if}
			</span>
			<b class="scores__points" data-testid="quiz-score-{player.uid}-value">{own.score}</b>
		</li>
	{/each}
</ul>

<style>
	.scores {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		margin: 0;
		padding: var(--space-sm) var(--space-md);
		list-style: none;
		width: 100%;
	}

	.scores__row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		font-size: var(--font-size-sm);
	}

	.scores__who {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/*
	 * `tabular-nums` на обох числових колонках: без нього рядок сіпається на кожному
	 * оновленні рахунку, бо «1» і «4» у пропорційному шрифті різної ширини — а
	 * сіпається він саме тоді, коли на нього дивляться.
	 */
	.scores__step,
	.scores__points {
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
	}

	.scores__points {
		min-width: 2.5ch;
		text-align: right;
		color: var(--color-accent);
	}
</style>
