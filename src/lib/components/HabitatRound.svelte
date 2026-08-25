<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { HabitatGameController } from '$lib/controllers/habitatGame.svelte';
	import type { HabitatMode } from '$lib/config/habitat-game';
	import { fitToViewport } from '$lib/utils/fitToViewport';
	import RoundIndicator from '$lib/components/RoundIndicator.svelte';
	import GameOverCard from '$lib/components/GameOverCard.svelte';
	import HabitatBoard from '$lib/components/HabitatBoard.svelte';

	/**
	 * Партія «Де живем?» в одному з підрежимів.
	 *
	 * Підрежим приходить ПРОПСОМ, а не вибирається всередині, бо він живе в
	 * адресі: `/game-habitat/continents/` і `/game-habitat/biomes/` — це дві
	 * різні сторінки, і кожною можна поділитися. Доти обидві були одним URL, і
	 * надіслати другові конкретну гру було нічим.
	 *
	 * Компонент, а не два майже однакові маршрути: різниця між режимами — одне
	 * слово, і дві копії цієї розмітки розійшлися б на першій же правці.
	 */
	interface Props {
		mode: HabitatMode;
	}

	let { mode }: Props = $props();

	// Правила — у контролері; тут показ і кліки (SVELTE-CORE-v8 § 3.1).
	const game = new HabitatGameController();
	const lang = $derived(languageFromParam(page.params.lang));

	onMount(() => {
		game.chooseMode(mode);

		/*
		 * «Назад» веде до вибору режиму, а не в головне меню: гравець, який хоче
		 * перемкнути континенти на природні зони, інакше йшов би через меню й
		 * заходив у гру заново.
		 *
		 * Тепер це справжня адреса, тож перехід звичайний — і працює однаково
		 * що з історії, що при прямому заході за посиланням.
		 */
		return settings.claimHeader('habitat.title', () => goto(langPath(lang, 'game-habitat')));
	});
</script>

<div class="game-page" use:fitToViewport>
	{#if game.gameOver}
		<GameOverCard
			score={game.sessionScore}
			total={game.maxScore}
			{lang}
			onPlayAgain={() => game.chooseMode(mode)}
			testId="habitat-game-over"
		/>
	{:else if game.round}
		<div class="round-indicator-wrapper">
			<RoundIndicator
				current={game.roundNumber}
				total={game.totalRounds}
				results={game.roundResults}
			/>
		</div>

		<HabitatBoard {game} {mode} />
	{/if}
</div>

<style>
	.game-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex: 1;
		width: 95%;
		max-width: var(--measure-habitat);
		padding: 4svh 0 var(--space-lg);
		gap: clamp(var(--space-xs), 2svh, var(--space-md));
		margin: 0 auto;
		box-sizing: border-box;
	}

	.round-indicator-wrapper {
		display: flex;
		justify-content: center;
		width: 100%;
	}

	/*
	 * Від 1000px варіанти стають одним рядом (див. HabitatOptions), і сторінка
	 * ширшає під нього. Ширшає САМЕ вона: картка тварини, питання й розбір
	 * лишаються вузькими — рядок тексту на 1100px не читається.
	 *
	 * SYNC: поріг той самий, що й у HabitatOptions. Медіазапит не вміє
	 * посилатися на чужий, тож число неминуче у двох місцях.
	 */
	@media (min-width: 1000px) {
		.game-page {
			max-width: var(--measure-habitat-wide);
		}
	}
</style>
