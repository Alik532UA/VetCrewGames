<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { FamilyGameController } from '$lib/controllers/familyGame.svelte';
	import { fitToViewport } from '$lib/utils/fitToViewport';
	import RoundIndicator from '$lib/components/RoundIndicator.svelte';
	import GameOverCard from '$lib/components/GameOverCard.svelte';
	import FamilyBoard from '$lib/components/FamilyBoard.svelte';

	// Правила — у контролері; тут лише показ і кліки (SVELTE-CORE-v8 § 3.1).
	const game = new FamilyGameController();
	const lang = $derived(languageFromParam(page.params.lang));

	onMount(() => {
		game.start();
		/*
		 * «Назад» веде в РОЗДІЛ, а не в головне меню. Після того, як ігри переїхали
		 * під «Вікторину» й «Знайди пару», типовий крок на головну змушував би
		 * спускатися двома рівнями заново.
		 */
		return settings.claimHeader('family.title', () => goto(langPath(lang, 'quiz/play')));
	});
</script>

<div class="game-page" use:fitToViewport>
	{#if game.gameOver}
		<GameOverCard
			score={game.sessionScore}
			total={game.maxScore}
			{lang}
			onPlayAgain={() => game.reset()}
			testId="family-game-over"
		/>
	{:else if game.round}
		<div class="round-indicator-wrapper">
			<RoundIndicator
				current={game.roundNumber}
				total={game.totalRounds}
				results={game.roundResults}
			/>
		</div>

		<FamilyBoard {game} />
	{/if}
</div>

<style>
	.game-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex: 1;
		width: 95%;
		max-width: var(--measure-family);
		/* Верхній відступ теж від екрана: на низькому вікні 4svh — це ті самі
		   кілька рядків, яких бракує поясненню (FLUID-SIZING-v8 § 6). */
		padding: clamp(var(--space-sm), 3svh, var(--space-xl)) 0 var(--space-lg);
		gap: clamp(var(--space-xs), 2svh, var(--space-lg));
		margin: 0 auto;
		box-sizing: border-box;
	}

	.round-indicator-wrapper {
		display: flex;
		justify-content: center;
		width: 100%;
	}



	/*
	 * Чотири в ряд, щойно є ширина. Два ряди по 380px не лишали місця
	 * поясненню: на 1280×800 сторінка була 931px при 748 доступних, і це ще
	 * без самого пояснення.
	 *
	 * `@media`, а не `@container`: рішення залежить від вікна, бо разом із
	 * кількістю колонок міняється й ширина самої сторінки (§ 7A — контейнерний
	 * запит для того, що залежить від МІСЦЯ в батькові, медіазапит для того,
	 * що залежить від вікна).
	 */
	@media (min-width: 700px) {
		.game-page {
			max-width: var(--measure-family-wide);
		}


		/* Текст лишається вузьким: рядок на 980px не читається. */
	}


	@media (hover: hover) {
	}



















</style>
