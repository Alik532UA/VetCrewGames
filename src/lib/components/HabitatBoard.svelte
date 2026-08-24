<script lang="ts">
	import { slide } from 'svelte/transition';
	import { t, td, formatFont } from '$lib/i18n';
	import type { HabitatGameController } from '$lib/controllers/habitatGame.svelte';
	import type { HabitatMode } from '$lib/config/habitat-game';
	import type { TranslationKey } from '$lib/i18n/translations/uk';
	import { revealScroll } from '$lib/utils/revealScroll';
	import HabitatOptions from '$lib/components/HabitatOptions.svelte';

	/**
	 * ДОШКА «Де живем?»: тварина, питання, варіанти, розбір відповіді.
	 *
	 * ## Чому окремо від `HabitatRound`
	 *
	 * Та сторінка тримає ще й навігацію, лічильник раундів і `GameOverCard` —
	 * тобто все, чого в спільній вікторині бути не мусить: там раунд один, а
	 * підсумок спільний і живе в кімнаті.
	 *
	 * Це той самий поділ, що вже є в проєкті: `MythCard` і `FeedingBoard` теж
	 * приймають контролер і не знають ні про сторінку, ні про мережу. Саме через
	 * його відсутність «Де живем?» доти не можна було внести в `ONLINE_GAMES`.
	 *
	 * ## Контролер ПРИХОДИТЬ, а не створюється тут
	 *
	 * У спільній грі контролер мусить народитися з ЗЕРНОМ раунду — інакше двоє
	 * гравців отримають різних тварин, і партія перестане бути спільною. Створити
	 * його всередині означало б заховати цей вибір там, де його не видно.
	 */
	/**
	 * `hideNext` — ОНЛАЙН-РАУНД, у якому темп задає не гравець.
	 *
	 * У соло кнопка «Далі» лишається: вона і є темп, і саме за нею читають розбір.
	 * У кімнаті ж наступний раунд оголошує господар за спільним таймером, тож своя
	 * кнопка тут або нічого не робила б, або перескакувала б раунд у себе одного.
	 * Замість неї `QuizRound` ставить рядок «чекаємо на решту» — на те саме місце,
	 * щоб дошка не стрибала.
	 */
	interface Props {
		game: HabitatGameController;
		mode: HabitatMode;
		/** Онлайн-раунд: своєї кнопки «Далі» тут немає. */
		hideNext?: boolean;
	}

	let { game, mode, hideNext = false }: Props = $props();

	/** Підпис варіанта залежить від підрежиму: континент чи природна зона. */
	const optionKey = (option: string): TranslationKey =>
		(mode === 'continents'
			? `habitat.continent.${option}`
			: `habitat.biome.${option}`) as TranslationKey;
</script>

{#if game.round}
	<div class="animal text-panel">
		<!--
			Головне зображення раунду, тобто LCP: `eager`, а не `lazy`
			(PERFORMANCE-v8 § 3.1 — «типова помилка з добрих намірів»). Розмітку
			створює вже гідрований застосунок, тож у момент вставки зображення
			ЗАВЖДИ у видимій області, і `lazy` додавав лише перевірку перетину
			перед запитом — на кожному раунді, а не раз. `fetchpriority` діє
			слабше, ніж для статичного hero, але діє: за канал із ним конкурують
			шрифт і фонове зображення теми.
		-->
		<img
			src={game.round.animal.image}
			alt={td(game.round.animal.nameKey)}
			class="animal__image"
			loading="eager"
			fetchpriority="high"
			decoding="async"
			width="300"
			height="400"
		/>
		<span class="animal__name" data-testid="habitat-animal-name-text">
			{@html formatFont(td(game.round.animal.nameKey))}
		</span>
	</div>

	<div class="question text-panel">
		<p class="question__prompt">
			{@html formatFont(
				t(mode === 'continents' ? 'habitat.prompt.continents' : 'habitat.prompt.biomes')
			)}
		</p>
		<p class="question__hint">{@html formatFont(t('habitat.hintMultiple'))}</p>
	</div>

	<HabitatOptions
		options={game.round.options}
		{mode}
		selected={game.selected}
		correct={game.round.correct}
		checked={game.checked}
		ontoggle={(option) => game.toggle(option)}
	/>

	{#if !game.checked}
		<button
			type="button"
			class="btn-primary"
			disabled={!game.canCheck}
			onclick={() => game.check()}
			data-testid="habitat-check-btn"
		>
			{@html formatFont(t('habitat.check'))}
		</button>
	{:else}
		<div class="result" use:revealScroll transition:slide={{ duration: 300 }}>
			<div
				class="result__header"
				class:result__header--correct={game.outcome === 'correct'}
				class:result__header--partial={game.outcome === 'partial'}
				data-testid="habitat-outcome-status"
			>
				{#if game.outcome === 'correct'}
					{@html formatFont(t('habitat.correct'))}
				{:else if game.outcome === 'partial'}
					{@html formatFont(t('habitat.partial'))}
				{:else}
					{@html formatFont(t('habitat.incorrect'))}
				{/if}
			</div>

			<p class="result__answer">
				{@html formatFont(t('habitat.correctAnswerWas'))}
				<strong>
					{@html formatFont(game.round.correct.map((option) => t(optionKey(option))).join(', '))}
				</strong>
			</p>

			{#if game.round.noteKey}
				<p class="result__note" data-testid="habitat-note-text">
					{@html formatFont(t(game.round.noteKey as TranslationKey))}
				</p>
			{/if}

			{#if !hideNext}
				<button
					type="button"
					class="btn-primary"
					onclick={() => game.nextRound()}
					data-testid="habitat-next-btn"
				>
					{@html formatFont(t('common.next'))}
				</button>
			{/if}
		</div>
	{/if}
{/if}

<style>
	.animal {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-xs);
	}
	.animal__image {
		width: clamp(96px, 22svh, 168px);
		aspect-ratio: 3 / 4;
		height: auto;
		object-fit: cover;
		border-radius: var(--radius-md);
		border: 2px solid var(--color-bg-panel-dark);
		box-shadow: var(--shadow-card);
	}
	.animal__name {
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-bold);
		color: var(--color-text);
	}
	.question {
		text-align: center;
	}
	.question__prompt {
		margin: 0;
		font-size: var(--font-size-md);
		font-weight: var(--font-weight-bold);
		color: var(--color-text);
	}
	.question__hint {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}
	.result {
		max-width: 460px;
	}
	.result {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-sm);
		width: 100%;
		padding: var(--space-md);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-bg-surface), transparent 15%);
		backdrop-filter: var(--blur-glass);
		box-shadow: var(--shadow-card);
	}
	.result__header {
		font-size: var(--font-size-xl);
		font-weight: var(--font-weight-bold);
		color: var(--color-error);
	}
	.result__header--correct {
		color: var(--color-success);
	}
	.result__header--partial {
		color: var(--color-warning);
	}
	.result__answer {
		margin: 0;
		text-align: center;
		color: var(--color-text);
	}
	.result__note {
		margin: 0;
		font-size: var(--font-size-sm);
		line-height: 1.5;
		color: var(--color-text);
		background: color-mix(in srgb, var(--color-bg-panel), transparent 90%);
		padding: var(--space-md);
		border-radius: var(--radius-md);
		border-left: 4px solid var(--color-accent);
	}
	/*
	 * На широкому екрані блоки НЕ розтягуються на всю ширину.
	 *
	 * Правило переїхало сюда разом із розміткою: у `HabitatRound` воно лишилося б
	 * мертвим селектором, бо самих класів там уже немає. `svelte-check` це й
	 * показав трьома попередженнями — саме той різновид, коли стиль виглядає
	 * робочим, а не діє.
	 */
	@media (min-width: 1000px) {
		.animal,
		.question,
		.result {
			max-width: 460px;
		}
	}
</style>
