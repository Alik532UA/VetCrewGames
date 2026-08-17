<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import type { TranslationKey } from '$lib/i18n/translations/uk';
	import type { BetaCheck, Vote } from '$lib/config/betaChecks';
	import { betaProgress } from '$lib/services/betaProgress.svelte';

	/**
	 * Один пункт чеклиста з чотирма кнопками відповіді.
	 *
	 * Чотири, а не «галочка»: середній стан «працює, але дивно» ловить те, що
	 * бінарне «так/ні» округляє до «так», — а саме там і живуть дефекти, які потім
	 * знаходить користувач.
	 */
	interface Props {
		check: BetaCheck;
		/** Номер у списку. Малюється звідси, а не з тексту: розійтися нема чому. */
		index: number;
		/** Українська чи англійська: de та nl показують англійський текст. */
		uk: boolean;
	}

	let { check, index, uk }: Props = $props();

	// Ключ перекладу — ЯВНО, а не складений із назви стану: `t()` типізований
	// повним переліком ключів, і склеєний рядок цю перевірку обходить.
	const VOTES: { vote: Vote; key: 'fail' | 'weird' | 'ok'; label: TranslationKey }[] = [
		{ vote: 'fail', key: 'fail', label: 'beta.vote.fail' },
		{ vote: 'weird', key: 'weird', label: 'beta.vote.weird' },
		{ vote: 'ok', key: 'ok', label: 'beta.vote.ok' }
	];

	let mine = $derived(betaProgress.voteOf(check.id));
	let stale = $derived(betaProgress.isStale(check.id));
	let text = $derived(uk ? check.text.uk : check.text.en);
	let category = $derived(uk ? check.category.uk : check.category.en);

	/** Повторне натискання того самого стану знімає позначку. */
	const press = (vote: Vote) => betaProgress.vote(check.id, mine === vote ? 'none' : vote);
</script>

<li class="row" class:row--marked={mine !== 'none'} data-testid="beta-check-item">
	<p class="category" data-testid="beta-check-category-text">
		{index}. {@html formatFont(category)}
	</p>
	<p class="text" data-testid="beta-check-text">{@html formatFont(text)}</p>

	<div class="votes" role="group" aria-label={t('beta.progress')}>
		{#each VOTES as option (option.vote)}
			<button
				type="button"
				class="vote vote--{option.key}"
				class:vote--active={mine === option.vote}
				aria-pressed={mine === option.vote}
				onclick={() => press(option.vote)}
				data-testid="beta-vote-{option.key}-btn"
			>
				{@html formatFont(t(option.label))}
			</button>
		{/each}
	</div>

	{#if stale}
		<p class="stale" data-testid="beta-check-stale-hint">{@html formatFont(t('beta.stale'))}</p>
	{/if}
</li>

<style>
	.row {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px 12px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background-color: var(--color-bg-surface);
	}

	/* Позначений пункт видно з відстані: людина шукає, де вона зупинилася. */
	.row--marked {
		border-color: var(--color-accent);
	}

	.category {
		margin: 0;
		font-size: 0.8rem;
		opacity: 0.75;
	}

	.text {
		margin: 0;
		line-height: 1.4;
	}

	.votes {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.vote {
		flex: 1 1 auto;
		/*
		 * 44px — не мінімум WCAG «щоб пройшло», а власний стандарт проєкту для
		 * дотику: половину цих перевірок роблять із телефона в руках.
		 */
		min-height: 44px;
		padding: 0 10px;
		border: 2px solid var(--color-border);
		border-radius: 6px;
		background-color: transparent;
		color: var(--color-text);
		font: inherit;
		cursor: pointer;
	}

	.vote:hover {
		border-color: var(--color-accent);
	}

	/*
	 * Стан позначено НЕ лише кольором: кольором і рамкою разом. Кольору самого
	 * замало — і для того, хто його не розрізняє, і в темах, де контраст між
	 * зеленим і сірим на кнопці менший, ніж здається на світлій.
	 */
	.vote--active {
		border-width: 3px;
		font-weight: 700;
	}

	.vote--fail.vote--active {
		border-color: #ef4444;
		color: #ef4444;
	}

	.vote--weird.vote--active {
		border-color: #eab308;
		color: #eab308;
	}

	.vote--ok.vote--active {
		border-color: #22c55e;
		color: #22c55e;
	}

	.stale {
		margin: 0;
		font-size: 0.8rem;
		opacity: 0.7;
	}
</style>
