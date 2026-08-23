<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import MemoryCard from '$lib/components/MemoryCard.svelte';
	import YouTag from '$lib/components/ui/YouTag.svelte';
	import type { PairsMatch } from '$lib/controllers/pairsMatch.svelte';

	/**
	 * Спільна партія «Знайди пару»: табло, дошка й підпис «чия черга».
	 *
	 * Компонент нічого не вирішує — навіть пауза перед перегортанням належить
	 * матчу, бо оголошує її ходом той, чия черга. Тут лишається показ і дотик.
	 */
	interface Props {
		match: PairsMatch;
		/** Хто я: підсвітити свій рядок у таблі. */
		me: string;
		/** Хто зараз на звʼязку. Присутність — окрема гілка бази. */
		online: string[];
		/** Нова партія; `undefined` — я не господар, і роздавати не мені. */
		onRematch?: () => void;
		/** Закрити кімнату назовсім. Так само лише господар. */
		onClose?: () => void;
		/**
		 * Забрати чергу в того, хто зник. `undefined` — ще не час або не мені.
		 *
		 * Кнопка з'являється лише коли межа очікування вийшла: доки суперник на
		 * звʼязку, нікого не підганяють.
		 */
		onYield?: () => void;
		/**
		 * Завершити партію, з якої суперник не вернувся. Умова та сама, що в
		 * `onYield`, — тож обидві кнопки зʼявляються разом, і людина вибирає, грати
		 * далі самій чи закінчити.
		 */
		onEnd?: () => void;
		/**
		 * Скільки лишилося до межі очікування, у мілісекундах. `null` — межа
		 * незастосовна (моя черга, глядач, партія скінчилася).
		 *
		 * Число приходить ГОТОВИМ, бо межу знає контролер, а не екран: інакше
		 * компонент мусив би тримати власну копію `TURN_LIMIT_MS`, і дві копії
		 * розійшлися б на першій же правці.
		 */
		yieldInMs?: number | null;
	}

	let { match, me, online, onRematch, onClose, onYield, onEnd, yieldInMs = null }: Props = $props();

	/**
	 * Хто з гравців зник із гілки присутності.
	 *
	 * Себе тут не буде: власний запис живий доти, доки жива вкладка, — а якби він
	 * зник, цього екрана вже ніхто не бачив би.
	 */
	const away = $derived(match.players.filter((player) => !online.includes(player.uid)));

	/**
	 * Залишок очікування як `0:47`. `null` — показувати нічого.
	 *
	 * Доти це число обчислювалося й ВИКИДАЛОСЯ: межа була відома, годинник цокав,
	 * а на екрані ті девʼяносто секунд не було нічого, крім перекресленого імені.
	 * Виглядало це як «гра зависла», а не як «чекаємо на суперника».
	 */
	const countdown = $derived.by(() => {
		if (yieldInMs === null || yieldInMs <= 0) return null;
		const total = Math.ceil(yieldInMs / 1000);
		return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
	});

	/** Скільки пар зібрав кожен: рахунок живе в правилах, не в кімнаті. */
	const scoreOf = (uid: string) => match.game.players.find((p) => p.id === uid)?.score ?? 0;

	/**
	 * Хто переміг. `null` — нічия, і це не рідкість: пар парна кількість.
	 *
	 * Рахується з дошки, а не пишеться в базу: усі мають ті самі ходи, тож усі
	 * отримають ту саму відповідь — а ще одне поле в кімнаті було б другим
	 * джерелом правди про те саме.
	 */
	const winner = $derived.by(() => {
		const best = Math.max(...match.players.map((player) => scoreOf(player.uid)));
		const top = match.players.filter((player) => scoreOf(player.uid) === best);
		return top.length === 1 ? top[0] : null;
	});

	const rows = $derived(Math.ceil(match.game.slots.length / match.game.cols));
</script>

<div class="board">
	<!--
		Підпис черги — головне, що людина шукає очима в спільній грі. Тому окремим
		рядком і словами, а не лише підсвіткою в таблі.
	-->
	<p class="board__turn text-panel" role="status" data-testid="pairs-turn-status">
		{#if match.over}
			{@html formatFont(t('pairs.over'))}
		{:else if match.myTurn}
			{@html formatFont(t('pairs.yourTurn'))}
		{:else}
			{@html formatFont(t('pairs.waitingFor'))}: {match.actor?.name ?? '—'}
		{/if}
	</p>

	<!--
		«Суперник відпав» — кнопка, а не автоматика. Але СКАЗАТИ про це треба одразу.

		Присутність гасне сама, і вона НЕ лежить у журналі ходів, отже не має права
		змінювати стан партії: інакше дошки розійшлися б залежно від того, чий сокет
		обірвався першим. Тому діяти замість того, хто стоїть, — це хід, який робить
		людина й однаково перевіряють усі.

		ЩО ЗМІНИЛОСЯ: панель зʼявляється, щойно зникла присутність, а не через
		девʼяносто секунд разом із кнопкою. Доти між «суперник зник» і «можна діяти»
		був проміжок, у якому екран не казав НІЧОГО — і саме він читався як зламана
		гра. Тепер видно причину, залишок часу й що буде далі.
	-->
	{#if away.length > 0 || onYield}
		<div class="board__stall text-panel" role="status" data-testid="pairs-stall-panel">
			{#if away.length > 0}
				<span data-testid="pairs-stall-away-text">
					{@html formatFont(t('pairs.away'))}: {away.map((player) => player.name).join(', ')}
				</span>
			{:else}
				<!-- Присутність є, а ходу немає: людина сидить у вкладці й не грає. -->
				<span>{@html formatFont(t('pairs.opponentGone'))}</span>
			{/if}

			{#if onYield}
				<button type="button" class="chip" onclick={onYield} data-testid="pairs-yield-btn">
					{@html formatFont(t('pairs.takeTurn'))}
				</button>
				{#if onEnd}
					<button type="button" class="chip" onclick={onEnd} data-testid="pairs-end-btn">
						{@html formatFont(t('pairs.endMatch'))}
					</button>
				{/if}
			{:else if countdown}
				<span class="board__wait" data-testid="pairs-stall-countdown-value">
					{@html formatFont(t('pairs.yieldIn'))} {countdown}
				</span>
			{:else if match.myTurn}
				<!-- Межа незастосовна, бо чекають МЕНЕ. Підганяти нікого не треба. -->
				<span class="board__wait">{@html formatFont(t('pairs.awayYourTurn'))}</span>
			{/if}
		</div>
	{/if}

	{#if match.over}
		<!--
			Підсумок замість зникнення дошки: картки лишаються на місці, бо після
			партії на них дивляться — «а де ж була та друга сова».
		-->
		<div class="board__over text-panel" data-testid="pairs-result-panel">
			<!--
				ЯК партія скінчилася — окремим рядком, і він тут не для повноти.

				«Перемога: Аня 4:2» над тим, хто пішов на другому ході, — правда про
				рахунок і неправда про партію. Рядок називає причину, тож рахунок нікого
				не вводить в оману й нічого не приховує.
			-->
			{#if match.endedBy !== null}
				<span class="board__wait" data-testid="pairs-ended-early-hint">
					{@html formatFont(t('pairs.endedEarly'))}
				</span>
			{/if}
			<b data-testid="pairs-result-text">
				{#if winner}
					<!--
						«Перемога: Аня», а не «Аня перемогла»: імʼя тут вільний рядок, і роду
						ми не знаємо. Перша версія писала «Аня — переміг», тобто вгадувала —
						і вгадувала неправильно рівно в половині випадків.
					-->
					{@html formatFont(t('pairs.won'))}: {winner.name}{#if winner.uid === me}
						<YouTag />
					{/if}
				{:else}
					{@html formatFont(t('pairs.draw'))}
				{/if}
			</b>
			{#if onRematch}
				<button
					type="button"
					class="btn-primary"
					onclick={onRematch}
					data-testid="pairs-rematch-btn"
				>
					{@html formatFont(t('pairs.rematch'))}
				</button>
				<button type="button" class="chip" onclick={onClose} data-testid="pairs-close-btn">
					{@html formatFont(t('pairs.closeRoom'))}
				</button>
			{:else}
				<span class="board__wait">{@html formatFont(t('pairs.waitingHost'))}</span>
			{/if}
		</div>
	{/if}

	<div class="board__score text-panel">
		{#each match.players as player (player.uid)}
			<span
				class="board__player"
				class:board__player--turn={player.uid === match.actor?.id}
				class:board__player--away={!online.includes(player.uid)}
				data-testid="pairs-player-{player.uid}-status"
			>
				{player.name}{#if player.uid === me}&nbsp;<YouTag />{/if}: {scoreOf(
					player.uid
				)}<!--
					СТАН СЛОВАМИ, а не лише стилем.

					Доти «немає звʼязку» передавалося перекресленням і прозорістю — тобто
					скрінрідер не отримував нічого, а очима це читалося як «видалено» або
					«недоступно», хоч людина могла просто зайти в тунель. Тепер причина
					написана, а стиль лишається підказкою, а не єдиним джерелом.
				-->{#if !online.includes(player.uid)}
					<span class="board__away">({@html formatFont(t('pairs.away'))})</span>
				{/if}
			</span>
		{/each}
		<span class="board__moves" data-testid="pairs-moves-value">
			{@html formatFont(t('memory.moves'))}: {match.game.moves}
		</span>
	</div>

	<!--
		Колонки приходять із КІМНАТИ, а не з екрана: сітка, яку перебудовує ширина
		вікна, стирає запамʼятане — і в спільній грі ще й розводить двох гравців.
	-->
	<div
		class="board__deck"
		style="--cols: {match.game.cols}; --rows: {rows}"
		data-testid="pairs-deck-container"
	>
		{#each match.game.slots as slot, index (slot.card.id)}
			<MemoryCard
				{slot}
				position={index + 1}
				disabled={!match.myTurn || match.over}
				onflip={() => match.flip(index)}
				testId="pairs-card-btn-{slot.card.id}"
			/>
		{/each}
	</div>
</div>

<style>
	.board {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-sm);
		width: 100%;
	}

	.board__stall {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		font-size: var(--font-size-sm);
	}

	.board__over {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-md);
		align-items: center;
		justify-content: center;
	}

	.chip {
		min-height: 44px;
		padding: 0 var(--space-md);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.board__wait {
		font-size: var(--font-size-sm);
		opacity: 0.75;
	}

	.board__turn {
		margin: 0;
		font-size: var(--font-size-md);
	}

	.board__score {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-md);
		justify-content: center;
		font-variant-numeric: tabular-nums;
	}

	/* Чия черга — видно й тут: підпис вище відповідає на питання, табло показує рахунок. */
	.board__player--turn {
		font-weight: var(--font-weight-bold);
		color: var(--color-accent);
	}

	/*
	 * Звʼязок обірвався. Не «вийшов»: людина могла просто зайти в тунель.
	 *
	 * ПЕРЕКРЕСЛЕННЯ ПРИБРАНО НАВМИСНО. Воно означає «видалено» — а гравець нікуди
	 * не подівся: його рахунок лишається в силі, його черга лишається його. Стан
	 * тепер написаний словами поруч (`board__away`), тож стилю досить бути
	 * приглушенням, а не окремим твердженням.
	 */
	.board__player--away {
		opacity: 0.75;
	}

	.board__away {
		font-size: var(--font-size-sm);
		opacity: 0.85;
		white-space: nowrap;
	}

	.board__moves {
		opacity: 0.75;
	}

	.board__deck {
		display: grid;
		grid-template-columns: repeat(var(--cols), 1fr);
		gap: clamp(4px, 1vw, var(--space-sm));
		width: 100%;
		max-width: min(96vw, calc(var(--cols) * 8rem));
	}
</style>
