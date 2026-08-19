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
	 * Стан позначено НЕ лише кольором: рамка втричі товща, підпис напівжирний,
	 * і на кнопці стоїть `aria-pressed`. Кольору самого замало й для того, хто
	 * його не розрізняє, і для скрінрідера.
	 *
	 * ПІДПИС ЛИШАЄТЬСЯ `--color-text`, і це виправлення, а не спрощення. Доти
	 * тут стояло `color: #ef4444 / #eab308 / #22c55e` — трьома літералами, тобто
	 * однаково в усіх чотирьох темах. На тлі рядка (`--color-bg-surface`) це
	 * давало, виміряно:
	 *
	 *   light-green   fail 3.08   weird 1.57   ok 1.86
	 *   winter        fail 3.32   weird 1.69   ok 2.01
	 *   dark          fail 4.13   weird 8.09   ok 6.81
	 *   orange-purple fail 4.35   weird 8.53   ok 7.18
	 *
	 * Тобто у ДВОХ світлих темах підпис позначеного стану був практично невидимий
	 * (1,57:1 при потрібних 4,5), а в решті двох «не працює» не дотягував. І це
	 * той самий підпис, який тестувальник читає, щоб знати, що він щойно
	 * поставив.
	 *
	 * Заміна літералів на токени тем цього не лікує: у світлих темах
	 * `--color-warning` (#b8860b) на тому самому тлі дає 2,66. Ті токени
	 * розраховані на акцент і рамку, а не на дрібний текст.
	 *
	 * Тому колір стану пішов туди, де він не мусить бути читним ТЕКСТОМ: у рамку
	 * й у слабку підкладку. Обидві — з токенів теми, тож у темній темі стан
	 * червоний тим червоним, який має ця тема.
	 *
	 * Чому 1.4.11 (3:1 для елементів керування) тут не порушено при
	 * `--color-warning` 2,66 на рамці: колір НЕ є єдиним носієм стану. Товщина,
	 * напівжирність і `aria-pressed` кажуть те саме, а самі підписи кнопок —
	 * «Не працює», «Дивно», «Працює» — називають стан словами.
	 *
	 * Чому цього не зловив `src/contrast.test.ts`: у `.vote` стоїть
	 * `background-color: transparent`, тож пара «тло+текст» статично не
	 * розвʼязується й іде в НЕПОКРИТО. Саме тому те число друкується у звіті —
	 * ось як виглядає дефект, що в ньому сховався.
	 */
	.vote--active {
		border-width: 3px;
		font-weight: 700;
	}

	.vote--fail.vote--active {
		border-color: var(--color-error);
		background-color: color-mix(in srgb, var(--color-error), transparent 88%);
	}

	.vote--weird.vote--active {
		border-color: var(--color-warning);
		background-color: color-mix(in srgb, var(--color-warning), transparent 88%);
	}

	.vote--ok.vote--active {
		border-color: var(--color-success);
		background-color: color-mix(in srgb, var(--color-success), transparent 88%);
	}

	.stale {
		margin: 0;
		font-size: 0.8rem;
		opacity: 0.7;
	}
</style>
