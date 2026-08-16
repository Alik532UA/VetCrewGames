<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { t, formatFont } from '$lib/i18n';
	import { languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { MemoryGameController } from '$lib/controllers/memoryGame.svelte';
	import { layoutForViewport } from '$lib/config/memory-game';
	import { toast } from '$lib/controllers/toast.svelte';
	import GameOverCard from '$lib/components/GameOverCard.svelte';
	import MemoryCard from '$lib/components/MemoryCard.svelte';

	/**
	 * Правила — у контролері; тут показ і введення (SVELTE-CORE-v8 § 3.1).
	 *
	 * Єдине, що сторінка додає до правил, — ЧАС: пауза, за яку встигаєш
	 * роздивитися невдалу пару. Контролер про неї не знає навмисно: у спільній
	 * партії ту саму дію робитиме повідомлення, а не таймер.
	 */
	const game = new MemoryGameController();
	const lang = $derived(languageFromParam(page.params.lang));

	/** Скільки видно невдалу пару, перш ніж вона закриється. */
	const PEEK_MS = 900;

	let hideTimer: ReturnType<typeof setTimeout> | null = null;

	/** Зерно колоди. Для соло воно випадкове; спільній партії його дасть кімната. */
	const freshSeed = () => Math.floor(Math.random() * 2 ** 31);

	/**
	 * Нова партія: зерно випадкове, розкладка — за екраном.
	 *
	 * Розкладка питається САМЕ тут, а не при створенні контролера: контролер
	 * створюється й під час prerender, де `matchMedia` не існує. І питається
	 * один раз на партію — далі вона належить партії, а не вікну.
	 */
	const newParty = () => ({ seed: freshSeed(), ...layoutForViewport() });

	/**
	 * Вікно змінило розмір посеред партії — пропонуємо перерозкласти, але НЕ
	 * робимо цього самі.
	 *
	 * Перебудовувати сітку мовчки не можна: гра вся про те, що де лежить, і
	 * колода, яка перескочила з 4×5 на 7×2 з хвостиком, стирає все, що гравець
	 * уже запам'ятав. Тому рішення лишається за ним — і разом із пропозицією
	 * він бачить, що це саме нова роздача.
	 *
	 * До першого ходу пропонувати нема чого: запам'ятовувати ще нічого, тож
	 * там просто перерозкладаємо.
	 */
	function offerRelayout() {
		const wanted = layoutForViewport();
		if (wanted.cols === game.cols || game.gameOver) return;

		if (game.moves === 0) {
			game.start(newParty());
			return;
		}

		if (toast.has('memory.resized')) return;
		toast.info('memory.resized', 12000, {
			labelKey: 'memory.relayout',
			onAction: playAgain
		});
	}

	function flip(index: number) {
		if (!game.flip(index)) return;

		/*
		 * Успішний хід гасить попередній таймер завжди.
		 *
		 * Правила самі перегортають невдалу пару, щойно гравець торкнувся
		 * третьої картки, тож старий таймер уже нічого не стереже — але, якщо
		 * його лишити, він спрацює посеред НАСТУПНОГО ходу й закриє пару,
		 * якої гравець ще не бачив.
		 */
		if (hideTimer) {
			clearTimeout(hideTimer);
			hideTimer = null;
		}
		if (!game.awaitingPeek) return;

		hideTimer = setTimeout(() => {
			hideTimer = null;
			game.resolvePeek();
		}, PEEK_MS);
	}

	function playAgain() {
		if (hideTimer) clearTimeout(hideTimer);
		hideTimer = null;
		game.start(newParty());
	}

	onMount(() => {
		game.start(newParty());
		settings.setHeaderTitle('memory.title');

		window.addEventListener('resize', offerRelayout);
		return () => {
			window.removeEventListener('resize', offerRelayout);
			settings.releaseHeader('memory.title');
		};
	});

	// Таймер живе поза Svelte, тож його прибирає окремий хук: без цього
	// `resolvePeek()` спрацював би вже після виходу зі сторінки.
	onDestroy(() => {
		if (hideTimer) clearTimeout(hideTimer);
	});
</script>

<div class="game-page">
	{#if game.gameOver}
		<GameOverCard
			score={game.localScore}
			total={game.pairs}
			{lang}
			onPlayAgain={playAgain}
			testId="memory-game-over"
		/>
	{:else}
		<p class="prompt text-panel">{@html formatFont(t('memory.prompt'))}</p>

		<!--
			Табло замість лічильника раундів: партія тут одна, а стежити треба за
			парами й ходами. У спільній грі сюди ж стане рахунок кожного.
		-->
		<div class="scoreboard text-panel">
			{#each game.players as player (player.id)}
				<span
					class="scoreboard__player"
					class:scoreboard__player--turn={player.id === game.current?.id}
					data-testid="memory-player-{player.id}-status"
				>
					{@html formatFont(t(player.nameKey))}: {player.score}
				</span>
			{/each}
			<span class="scoreboard__moves" data-testid="memory-moves-value">
				{@html formatFont(t('memory.moves'))}: {game.moves}
			</span>
		</div>

			<!--
				Колонки приходять зі СТАНУ ПАРТІЇ, а не з медіазапиту: сітка, яку
				перебудовує ширина вікна, стирає запам'ятане.
			-->
			<div class="deck" style="--cols: {game.cols}; --rows: {Math.ceil(game.slots.length / game.cols)}" data-testid="memory-deck-container">
			{#each game.slots as slot, index (slot.card.id)}
				<MemoryCard
					{slot}
					position={index + 1}
					disabled={game.gameOver}
					onflip={() => flip(index)}
					testId="memory-card-btn-{slot.card.id}"
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
		flex: 1;
		width: 95%;
		/*
		 * Ширшої стелі немає: дошці треба місце, а решта на сторінці —
		 * підказка й табло — і так вужчі за неї, бо це коробки за вмістом.
		 */
		max-width: 96vw;
		padding: 3dvh 0 var(--space-lg);
		gap: var(--space-sm);
		margin: 0 auto;
		box-sizing: border-box;
	}

	.prompt {
		margin: 0;
		text-align: center;
		font-size: var(--font-size-sm);
		color: var(--color-text);
	}

	.scoreboard {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-sm) var(--space-md);
		font-size: var(--font-size-sm);
		color: var(--color-text);
	}

	.scoreboard__player--turn {
		font-weight: var(--font-weight-bold);
		color: var(--color-accent);
	}

	.scoreboard__moves {
		color: var(--color-text-muted);
	}

	/*
	 * Дошка займає 90% екрана — але не сліпо.
	 *
	 * Сама лише ширина в 90vw на 1920px дала б картку завширшки 247px, а при
	 * 3:4 це 329 у висоту й 1316 на чотири ряди — тобто дошка, яка не
	 * вміщається у власний екран. Тому друга межа рахує ширину, за якої чотири
	 * ряди 3:4-карток ще влазять у відведену висоту:
	 *
	 *     ширина = висота × колонки × 3 / (ряди × 4)
	 *
	 * `min()` бере те з двох, що менше, тож на широкому й низькому екрані
	 * вирішує висота, на вузькому — ширина.
	 */
	/*
	 * `--cols` і `--rows` приходять ІНЛАЙНОМ зі стану партії — тут лише запасні
	 * значення на випадок, коли розмітка ще не встигла їх поставити. Медіазапит
	 * звідси прибраний свідомо: він перебудовував сітку на кожну зміну ширини
	 * вікна, а розкладка належить партії, а не вікну.
	 */
	.deck {
		--cols: 7;
		--rows: 4;
		/*
		 * Скільки заввишки лишається дошці: усе вікно мінус те, що над нею.
		 *
		 * 190px — це шапка, підказка, табло й відступи разом, і воно НЕ частка
		 * екрана, а стала висота, тож віднімається в пікселях. Частка тут дала б
		 * дошку, яка на низькому вікні вилазить, а на високому лишає порожнечу.
		 */
		--deck-height: calc(96dvh - 190px);

		display: grid;
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
		gap: var(--space-xs);
		width: min(90vw, calc(var(--deck-height) * var(--cols) * 3 / (var(--rows) * 4)));
	}

</style>
