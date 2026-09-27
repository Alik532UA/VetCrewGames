<script lang="ts">
	import { fade, slide, fly } from 'svelte/transition';
	import { flyAndSlide } from '$lib/utils/transitions';
	import { t, td, formatFont } from '$lib/i18n';
	import { CheckCircle2, XCircle } from 'lucide-svelte';
	import { revealScroll } from '$lib/utils/revealScroll';
	import type { ActiveQuestion } from '$lib/controllers/mythGame.svelte';

	/**
	 * Картка одного питання «Правда чи міф»: тварина, твердження, дві відповіді й
	 * розбір.
	 *
	 * Винесена зі сторінки, і не для охайності. Маршрут стояв на 418 рядках при
	 * межі 400 і був у `OVERSIZED_ALLOWLIST`, де список може лише СКОРОЧУВАТИСЯ —
	 * тобто будь-яка правка в ньому впиралася в гейт. Саме на цьому вже відкотилася
	 * правка LCP-зображення: три рядки атрибутів піднімали файл до 421
	 * (PROJECT-STRUCTURE-v8 § 7).
	 *
	 * Стан партії лишається в контролері; сюди приходить лише поточне питання й
	 * два зворотні виклики. Компонент нічого не вирішує — він малює
	 * (SVELTE-CORE-v8 § 3.1).
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
		question: ActiveQuestion;
		onanswer: (truth: boolean) => void;
		onnext: () => void;
		/** Онлайн-раунд: своєї кнопки «Далі» тут немає. */
		hideNext?: boolean;
		/**
		 * ЛИШЕ РОЗБІР — твердження й пояснення, без картинки: табло між раундами спільної
		 * вікторини (`QuizBoard`, `settled`), де під рахунком мусить уміститися й це.
		 */
		compact?: boolean;
	}

	let { question, onanswer, onnext, hideNext = false, compact = false }: Props = $props();

	/**
	 * Відповідь БУЛА. У спільній вікторині час виходить і без неї — тоді розбір показує
	 * лише пояснення (воно й починається з «Міф.» чи «Правда.»), а не «Не зовсім...» і
	 * червону рамку за відповідь, якої ніхто не давав.
	 */
	const judged = $derived(question.answered && question.selectedTrue !== null);
</script>

<div
	class="myth-card"
	class:myth-card--correct={judged && question.isCorrect}
	class:myth-card--wrong={judged && !question.isCorrect}
	in:fly={{ y: 20, duration: 350, delay: 300 }}
	out:flyAndSlide={{ y: -20, duration: 300 }}
>
	<div class="myth-card__inner-key">
		{#if !compact}
			<div class="myth-card__image-wrap">
				<!--
					Головне зображення екрана, тобто LCP: `eager`, а не `lazy`
					(PERFORMANCE-v8 § 3.1 — канон називає `lazy` тут «типовою помилкою з
					добрих намірів»). Розмітку створює вже гідрований застосунок, тож у
					момент вставки зображення ЗАВЖДИ у видимій області — відкладати нічого.
					Та сама причина, що в `HabitatRound.svelte`.
				-->
				<img
					src={question.animal.image}
					alt={td(question.animal.nameKey)}
					class="myth-card__image"
					loading="eager"
					fetchpriority="high"
					decoding="async"
					width="200"
					height="266"
				/>
				<div class="myth-card__animal-name image-caption">
					{@html formatFont(td(question.animal.nameKey))}
				</div>
			</div>
		{/if}

		<div class="myth-card__content">
			<p class="myth-card__statement">{@html formatFont(td(question.statementKey))}</p>

			<div class="myth-card__dynamic-container">
				{#if !question.answered}
					<div class="myth-card__actions" out:slide={{ duration: 400 }} in:fade>
						<button
							class="btn-myth"
							onclick={() => onanswer(false)}
							data-testid="mythbusters-myth-btn"
						>
							{@html formatFont(t('myth.myth'))}
						</button>
						<button
							type="button"
							class="btn-truth"
							onclick={() => onanswer(true)}
							data-testid="mythbusters-truth-btn"
						>
							{@html formatFont(t('myth.truth'))}
						</button>
					</div>
				{:else}
					<div
						class="myth-card__result"
						use:revealScroll={!compact}
						in:slide={{ duration: 400 }}
						out:fade
					>
						{#if !hideNext}
							<button
								class="btn-next btn-secondary"
								onclick={() => onnext()}
								data-testid="mythbusters-next-btn"
							>
								{@html formatFont(t('myth.next'))}
							</button>
						{/if}
						{#if judged}
							<div class="result-header" class:result-header--correct={question.isCorrect}>
								{#if question.isCorrect}
									<CheckCircle2 size={24} />
									<span>{@html formatFont(t('myth.correct'))}</span>
								{:else}
									<XCircle size={24} />
									<span>{@html formatFont(t('myth.incorrect'))}</span>
								{/if}
							</div>
						{/if}
						<p class="myth-card__explanation">
							{@html formatFont(td(question.explanationKey))}
						</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.myth-card {
		grid-area: card;
		width: 100%;
		background: color-mix(in srgb, var(--color-bg-surface), transparent 25%);
		backdrop-filter: var(--blur-glass);
		border-radius: var(--radius-lg);
		overflow: hidden;
		box-shadow: var(--shadow-card);
		border: 4px solid transparent;
		transition:
			border-color 0.4s ease,
			box-shadow 0.4s ease;
		display: flex;
		flex-direction: column;
		animation: blur-in 3s ease 650ms both;
	}
	.myth-card__inner-key {
		display: flex;
		flex-direction: column;
		width: 100%;
	}

	.myth-card--correct {
		border-color: var(--color-success);
		box-shadow: var(--shadow-glow-success);
	}
	.myth-card--wrong {
		border-color: var(--color-error);
		box-shadow: var(--shadow-glow-error);
	}

	/*
	 * Картинка — половина картки, але НЕ вища за 36% екрана (2026-09-28). Масштаб гри цілить
	 * у 90% висоти (`FILL_SHARE`), і на широкому екрані картка ширшає (`--measure-myths`),
	 * щоб займати ті самі 30% площі. Без стелі ширша картка давала вищу картинку (3:4), масштаб
	 * падав, і площа не росла: 28,2% при 640px і 29,8% при 720px на 1600×800. На телефоні
	 * стеля не діє — там половина картки нижча за неї.
	 */
	.myth-card__image-wrap {
		width: min(50%, calc(36svh * 3 / 4));
		aspect-ratio: 3 / 4;
		position: relative;
		/* Підпис (`.image-caption`) міряється частками цієї ширини. */
		container-type: inline-size;
		margin: var(--space-lg) auto 0;
		border-radius: var(--radius-md);
		overflow: hidden;
		box-shadow: var(--shadow-card);
		border: 2px solid var(--color-bg-panel-dark);
	}
	.myth-card__image {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	/*
	 * Вигляд — спільний `.image-caption` (`global.css`). Кегль там 11cqi, тобто вдвічі більший
	 * за колишні 12px на картинці 216px (прохання автора 2026-09-28: «назва тварини займає 20%
	 * від зображення — зробити в 2 рази більшу»), і на телефоні частка та сама.
	 */
	.myth-card__animal-name {
		animation: blur-in 3s ease 1s both;
	}
	.myth-card__content {
		padding: var(--space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}
	.myth-card__statement {
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-bold);
		text-align: center;
		line-height: 1.4;
		margin: 0;
	}

	.myth-card__dynamic-container {
		display: grid;
		grid-template-areas: 'stack';
		align-items: start;
	}

	.myth-card__actions,
	.myth-card__result {
		grid-area: stack;
		width: 100%;
	}

	.myth-card__actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-md);
	}

	.btn-myth,
	.btn-truth {
		padding: var(--space-md);
		border-radius: var(--radius-md);
		border: none;
		font-weight: var(--font-weight-bold);
		font-size: var(--font-size-md);
		cursor: pointer;
		transition: all var(--transition-fast);
		text-transform: uppercase;
		letter-spacing: 1px;
	}

	.btn-myth {
		background: #e5e5e5;
		color: #333;
		box-shadow: 0 4px 0 #b0b0b0;
	}
	.btn-myth:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 0 #b0b0b0;
		background: #eee;
	}

	.btn-truth {
		background: var(--color-accent);
		color: var(--color-text-on-accent);
		box-shadow: 0 4px 0 color-mix(in srgb, var(--color-accent), black 30%);
	}
	.btn-truth:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 0 color-mix(in srgb, var(--color-accent), black 30%);
		background: var(--color-accent-hover);
	}

	.myth-card__result {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}
	.result-header {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		font-weight: var(--font-weight-bold);
		font-size: var(--font-size-xl);
	}
	.result-header--correct {
		color: var(--color-success);
	}

	.myth-card__explanation {
		font-size: var(--font-size-md);
		line-height: 1.5;
		color: var(--color-text);
		background: color-mix(in srgb, var(--color-bg-panel), transparent 90%);
		backdrop-filter: var(--blur-glass);
		padding: var(--space-md);
		border-radius: var(--radius-md);
		border-left: 4px solid var(--color-accent);
		margin: 0;
		animation: blur-in 3s ease 400ms both;
	}

	/*
	 * «Далі» — кнопкою (`.btn-secondary`). Доти тут стояло тло панелі з краєм
	 * `--color-bg-panel-dark`, а в зимовій темі той край збігався з тлом кнопки.
	 */
	.btn-next {
		padding: var(--space-md);
		border-radius: var(--radius-md);
		font: inherit;
		font-weight: var(--font-weight-bold);
	}
</style>
