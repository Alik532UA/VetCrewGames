<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { t, formatFont } from '$lib/i18n';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { MemoryGameController } from '$lib/controllers/memoryGame.svelte';
	import { layoutForViewport } from '$lib/config/memory-game';
	import { toast } from '$lib/controllers/toast.svelte';
	import GameOverCard from '$lib/components/GameOverCard.svelte';
	import MemoryCard from '$lib/components/MemoryCard.svelte';
	import MemoryDeck from '$lib/components/MemoryDeck.svelte';

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
		/*
		 * «Назад» веде в РОЗДІЛ, а не в головне меню. Після того, як ігри переїхали
		 * під «Вікторину» й «Знайди пару», типовий крок на головну змушував би
		 * спускатися двома рівнями заново.
		 */
		const releaseHeader = settings.claimHeader('memory.title', () => goto(langPath(lang, 'pairs')));

		window.addEventListener('resize', offerRelayout);
		return () => {
			window.removeEventListener('resize', offerRelayout);
			releaseHeader();
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

		<!-- Уся дошка на екрані й колонки — з партії (`MemoryDeck`). -->
		<MemoryDeck cols={game.cols} count={game.slots.length} testId="memory-deck-container">
			{#each game.slots as slot, index (slot.card.id)}
				<MemoryCard
					{slot}
					position={index + 1}
					disabled={game.gameOver}
					onflip={() => flip(index)}
					testId="memory-card-btn-{slot.card.id}"
				/>
			{/each}
		</MemoryDeck>
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

	/*
	 * Чия черга — ПЛАШКА, а не підкрашений текст.
	 *
	 * `--color-accent` (`#ffb327`) однаковий у всіх чотирьох темах, бо це колір
	 * марки. Як ТЕКСТ він читабельний лише на темному: заміряно 1.50:1 у
	 * light-green і 1.60:1 у winter при потрібних 4.5
	 * (`tests/contrast-runtime.spec.ts`) — найгірша пара, знайдена цим гейтом.
	 *
	 * Тому акцент переїхав у ТЛО, а текст став `--color-text-on-accent` — токен,
	 * який для цього й існує і в кожній темі підібраний саме під акцент: 7.38:1 у
	 * light-green, 7.64:1 у winter.
	 *
	 * Побічно сигнал став сильнішим: плашку видно з відстані, з якої відтінок
	 * тексту не розрізняється, — а «чия черга» треба бачити, не вчитуючись.
	 */
	.scoreboard__player--turn {
		font-weight: var(--font-weight-bold);
		background: var(--color-accent);
		color: var(--color-text-on-accent);
		/* Плашка не мусить розсувати рядок: відступи дрібні, а місце під них уже є. */
		padding: 0 var(--space-xs);
		border-radius: var(--radius-sm);
	}

	.scoreboard__moves {
		color: var(--color-text-muted);
	}
</style>
