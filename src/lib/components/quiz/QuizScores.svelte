<script lang="ts">
	import type { Member } from '$lib/net/roomTypes';
	import Flag from '$lib/components/ui/Flag.svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import YouTag from '$lib/components/ui/YouTag.svelte';

	/**
	 * Спільне табло вікторини: хто на якому кроці й скільки набрав.
	 *
	 * ## Це і є «спільна» частина партії
	 *
	 * Дошки в кожного своя (усі відповідають одночасно), тож єдине, що всі бачать
	 * однаково, — програма й рахунок. Табло тут не оздоба поруч із грою: воно і є
	 * причина грати разом.
	 *
	 * ## Крок, а не відсоток
	 *
	 * «3 / 6» відповідає на питання «скільки ще», а відсоток — ні: у партії шість
	 * кроків, і «50%» вимагає порахувати назад. Числом видно й те, чого відсоток
	 * не показує взагалі: наскільку суперник попереду або позаду.
	 */
	interface Props {
		players: Member[];
		/** Хто вже відповів у поточному раунді. Саме ФАКТ, без правильності. */
		answered: string[];
		/** Рахунок кожного. Показується лише коли `withScores`. */
		scores: Record<string, number>;
		/**
		 * ЧИ ПОКАЗУВАТИ РАХУНОК.
		 *
		 * Під час раунду — ні, і це вимога автора: цифри поруч із питанням тягнуть
		 * увагу на себе саме тоді, коли її треба на питанні. Рахунок з'являється на
		 * таблі між раундами, тобто рівно тоді, коли на нього й дивляться.
		 */
		withScores: boolean;
		me: string;
	}

	let { players, answered, scores, withScores, me }: Props = $props();

	/*
	 * Порядок — за РАХУНКОМ, але лише коли рахунок видно.
	 *
	 * Під час раунду сортування за очками переставляло б рядки просто від того, що
	 * хтось відповів, — тобто показувало б те, що ми навмисно ховаємо. Тому в
	 * раунді порядок за входом: стабільний і нічого не виказує.
	 */
	const ranked = $derived(
		withScores
			? [...players].sort(
					(a, b) => (scores[b.uid] ?? 0) - (scores[a.uid] ?? 0) || a.order - b.order
				)
			: [...players].sort((a, b) => a.order - b.order)
	);
</script>

<ul class="scores text-panel" data-testid="quiz-scores-list">
	{#each ranked as player (player.uid)}
		<!--
			ФОН РЯДКА — ЦЕ Й Є «ВІН УЖЕ ВІДПОВІВ».
			
			Саме факт, без правильності: показати «правильно» до кінця раунду
			означало б підказати відповідь тим, хто ще думає. Автор попросив рівно
			це — «просто сам факт відповіді, наприклад інший фон контейнеру».
		-->
		<li
			class="scores__row"
			class:scores__row--answered={answered.includes(player.uid)}
			data-testid="quiz-score-{player.uid}-item"
		>
			<span class="scores__who">
				<Avatar avatar={player.avatar} />
				<Flag code={player.country} />
				{player.name}{#if player.uid === me}&nbsp;<YouTag />{/if}
			</span>
			{#if withScores}
				<b class="scores__points" data-testid="quiz-score-{player.uid}-value">
					{scores[player.uid] ?? 0}
				</b>
			{/if}
		</li>
	{/each}
</ul>

<style>
	.scores {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		margin: 0;
		padding: var(--space-sm) var(--space-md);
		list-style: none;
		width: 100%;
	}

	/*
	 * Підкладка «відповів» — домішка АКЦЕНТУ до тла, а не свій колір: у чотирьох
	 * темах акцент різний, і власне значення тут розійшлося б із трьома з них.
	 */
	.scores__row--answered {
		background: color-mix(in srgb, var(--color-accent), transparent 82%);
		border-radius: var(--radius-sm);
	}

	.scores__row {
		display: flex;
		padding: 2px var(--space-xs);
		align-items: center;
		gap: var(--space-sm);
		font-size: var(--font-size-sm);
	}

	.scores__who {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/*
	 * `tabular-nums` на обох числових колонках: без нього рядок сіпається на кожному
	 * оновленні рахунку, бо «1» і «4» у пропорційному шрифті різної ширини — а
	 * сіпається він саме тоді, коли на нього дивляться.
	 */
	.scores__points {
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
	}

	.scores__points {
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
		min-width: 2.5ch;
		text-align: right;
		color: var(--color-accent);
	}
</style>
