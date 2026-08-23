<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { settings } from '$lib/services/settings.svelte';
	import { MythGameController } from '$lib/controllers/mythGame.svelte';
	import { page } from '$app/state';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { fitToViewport } from '$lib/utils/fitToViewport';
	import RoundIndicator from '$lib/components/RoundIndicator.svelte';
	import MythCard from '$lib/components/MythCard.svelte';
	import GameOverCard from '$lib/components/GameOverCard.svelte';

	const lang = $derived(languageFromParam(page.params.lang));

	// Компонент лише СТВОРЮЄ контролер і малює його стан (SVELTE-CORE-v8 § 3.1).
	// Стан партії гине разом зі сторінкою — саме тому контролер тут `new`, а не
	// module-level синглтон.
	const game = new MythGameController();

	onMount(() => {
		game.start();
		/*
		 * «Назад» веде в РОЗДІЛ, а не в головне меню. Після того, як ігри переїхали
		 * під «Вікторину» й «Знайди пару», типовий крок на головну змушував би
		 * спускатися двома рівнями заново.
		 */
		return settings.claimHeader('myth.title', () => goto(langPath(lang, 'quiz/play')));
	});
</script>

<div class="game-page" use:fitToViewport>
	{#if game.gameOver}
		<!--
			СПІЛЬНИЙ компонент, а не власна копія — і саме копія тут була дефектом.

			Доти цей блок був дослівно переписаним `GameOverCard`: та сама розмітка,
			ті самі 45 рядків стилів. Розійшлися вони в одному рядку: коли `.btn-menu`
			у спільному компоненті перевели на токени теми, копія лишилася з
			`color: #ffffff` на `rgba(255, 255, 255, 0.1)` — білий текст на світлому
			тлі у двох темах із чотирьох. Автор знайшов це оком, бо жоден гейт на
            екран підсумку не заходить: щоб його побачити, партію треба дограти.

			З чотирьох інших ігор жодна копії не мала — усі кликали `GameOverCard`.
			Тобто дефект був не в кольорі, а в дублікаті: полагодити копію означало б
			лишити причину на місці.

			Заразом сюди приїхало те, чого копія не мала зовсім: `data-testid` на
			картці, рахунку й обох кнопках, і `aria-hidden` на значках.
		-->
		<GameOverCard
			score={game.sessionScore}
			total={game.maxScore}
			{lang}
			onPlayAgain={() => game.reset()}
			testId="mythbusters-game-over"
		/>
	{:else if game.current}
		<div class="round-indicator-wrapper">
			<RoundIndicator
				current={game.roundNumber}
				total={game.totalRounds}
				results={game.roundResults}
			/>
		</div>

		<div class="myth-card-wrapper" in:fade={{ duration: 300 }}>
			{#each [game.current] as q (q.id)}
				<MythCard
					question={q}
					onanswer={(truth) => game.answer(truth)}
					onnext={() => game.nextRound()}
				/>
			{/each}
		</div>
	{/if}
</div>

<style>
	.game-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		flex: 1;
		width: 95%;
		max-width: 500px;
		padding: 10svh 0 var(--space-lg);
		gap: clamp(var(--space-xs), 2svh, var(--space-lg));
		margin: 0 auto;
		box-sizing: border-box;
	}
	@media (min-width: 769px) {
		.game-page {
			padding: 15svh 0 var(--space-2xl);
		}
	}

	.myth-card-wrapper {
		width: 100%;
		display: grid;
		grid-template-areas: 'card';
		align-items: start;
	}

	.round-indicator-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-bottom: var(--space-sm);
		width: 100%;
	}

	/*
	 * Стилів екрана підсумку тут БІЛЬШЕ НЕМА — усі 45 рядків жили в `GameOverCard`
	 * і були переписані сюди дослівно. Прибрано разом із розміткою: копія стилю
	 * без копії розмітки — це мертвий код, про який компілятор скаже лише
	 * попередженням про невикористаний селектор.
	 */
</style>
