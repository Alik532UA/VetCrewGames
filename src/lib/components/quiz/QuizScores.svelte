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
		/**
		 * КОГО НЕМАЄ ОНЛАЙН — за uid.
		 *
		 * Вимога автора: «гравець який відключився виглядає на 50% ч/б та на сірому
		 * фоні, бо чітко видно було хто дізконект». Доти відсутній виглядав рівно як
		 * присутній: єдиною ознакою було вікно очікування над дошкою, тобто зв'язок
		 * «хто саме зник» доводилося тримати в голові.
		 *
		 * Порожньо — усі на місці; так само поводиться соло-режим, де присутності
		 * немає взагалі.
		 */
		away?: string[];
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
		/**
		 * СМУГА чи ТАБЛИЦЯ.
		 *
		 * `strip` — рядок над дошкою під час партії: гравці в ЛІНІЮ, бо це підпис
		 * до гри, а не сама гра. Стовпцем він з'їдав висоту екрана й відсував
		 * дошку — автор попросив рівно це: «в лінію і не ламає розмітку ігор».
		 *
		 * `table` — підсумок: стовпець із місцями, де рядок і є одиниця читання.
		 */
		layout?: 'strip' | 'table';
		me: string;
	}

	let { players, answered, scores, withScores, layout = 'strip', away = [], me }: Props = $props();

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

<ul
	class="scores text-panel"
	class:scores--strip={layout === 'strip'}
	class:scores--table={layout === 'table'}
	data-testid="quiz-scores-list"
>
	{#each ranked as player, place (player.uid)}
		<!--
			ФОН РЯДКА — ЦЕ Й Є «ВІН УЖЕ ВІДПОВІВ».
			
			Саме факт, без правильності: показати «правильно» до кінця раунду
			означало б підказати відповідь тим, хто ще думає. Автор попросив рівно
			це — «просто сам факт відповіді, наприклад інший фон контейнеру».
		-->
		<li
			class="scores__row"
			class:scores__row--answered={answered.includes(player.uid)}
			class:scores__row--away={away.includes(player.uid)}
			data-testid="quiz-score-{player.uid}-item"
		>
			{#if layout === 'table'}
				<!--
					Місце числом, і саме в таблиці: у смузі воно означало б порядок, який
					під час раунду навмисно нічого не виказує.
				-->
				<b class="scores__place" data-testid="quiz-score-{player.uid}-count">{place + 1}</b>
			{/if}
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
		gap: var(--space-xs);
		margin: 0;
		padding: var(--space-sm) var(--space-md);
		list-style: none;
		width: 100%;
		box-sizing: border-box;
	}

	/*
	 * СМУГА — рядок, що переноситься, а не стовпець.
	 *
	 * Стовпцем табло росло вниз на кожного гравця й відсувало дошку — на четвертому
	 * учаснику питання виїжджало за екран. `flex-wrap` лишає це чесним і на вузькому
	 * екрані: краще другий рядок, ніж обрізані підписи.
	 */
	.scores--strip {
		flex-flow: row wrap;
		justify-content: center;
		gap: var(--space-xs) var(--space-md);
	}

	.scores--table {
		flex-direction: column;
	}

	/*
	 * Підкладка «відповів» — домішка АКЦЕНТУ до тла, а не свій колір: у чотирьох
	 * темах акцент різний, і власне значення тут розійшлося б із трьома з них.
	 */
	.scores__row--answered {
		background: color-mix(in srgb, var(--color-accent), transparent 82%);
		border-radius: var(--radius-sm);
	}

	/*
	 * ВІДСУТНІЙ — СІРИЙ І ПРИТИШЕНИЙ, і саме двома засобами, а не одним.
	 *
	 * `grayscale(50%)` знімає колір із прапора й аватара — тобто з того, за чим
	 * гравця й розпізнають, — а сіра підкладка відповідає на друге питання: це не
	 * «картинка не завантажилася», а стан рядка. Вимога автора: «на 50% ч/б та на
	 * сірому фоні, бо чітко видно було хто дізконект».
	 *
	 * ПІСЛЯ `--answered` у файлі навмисно: обидва правила фарбують тло, і в
	 * відсутнього воно мусить перемагати. Той, хто відповів і потім зник, —
	 * найважливіший випадок: акцентна підкладка «він відповів» інакше читалася б як
	 * «усе гаразд».
	 *
	 * Прозорість НЕ використана: у чотирьох темах вона опускає контраст імені під
	 * 4.5:1, і жодне значення її не рятує (те саме міркування вже записане в
	 * `RoomList` та `OnlineGate`).
	 */
	.scores__row--away {
		background: color-mix(in srgb, var(--color-text-on-panel), transparent 88%);
		filter: grayscale(50%);
		border-radius: var(--radius-sm);
	}

	.scores__row {
		display: flex;
		padding: 2px var(--space-xs);
		align-items: center;
		gap: var(--space-sm);
		font-size: var(--font-size-sm);
	}

	/* У смузі рядок займає своє й не тягнеться на всю ширину. */
	.scores--strip .scores__row {
		flex: 0 1 auto;
	}

	.scores__place {
		flex-shrink: 0;
		min-width: 2ch;
		font-variant-numeric: tabular-nums;
		color: var(--color-text-muted);
		text-align: right;
	}

	.scores__who {
		display: flex;
		align-items: center;
		gap: 6px;
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
	.scores--table .scores__who {
		flex: 1;
	}

	.scores__points {
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
		min-width: 2.5ch;
		text-align: right;
		color: var(--color-accent);
	}
</style>
