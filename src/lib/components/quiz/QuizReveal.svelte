<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';
	import { rankedByPhase } from '$lib/utils/revealOrder';
	import { formatFont } from '$lib/i18n';
	import type { Member } from '$lib/net/roomTypes';
	import Flag from '$lib/components/ui/Flag.svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import YouTag from '$lib/components/ui/YouTag.svelte';

	/**
	 * ТАБЛО МІЖ РАУНДАМИ: посередині екрана, з набором балів.
	 *
	 * ## Що було
	 *
	 * Рядок «Наступний раунд» і числа, які просто ставали іншими у смузі зверху.
	 * Автор описав це точно: «просто стає число миттєво більше, зверху табло», а
	 * хотів «результати по центру екрану по кожному з гравцю з анімацією набору
	 * балів». Тобто пауза між раундами існувала, але нічого не показувала.
	 *
	 * ## Чому приріст, а не лише сума
	 *
	 * «+90» відповідає на питання «як я щойно зіграв», якого сума не бачить. Сума
	 * поруч лишається, бо саме вона тримає порядок місць.
	 *
	 * ## Анімація рахує ЧАС, а не кадри
	 *
	 * Крок за кадр (`value += 3`) на 120-герцевому екрані домалював би вдвічі
	 * швидше, ніж на 60-герцевому, і «однакова анімація» залежала б від монітора.
	 * Тут rAF лише питає час, а число виводиться з частки пройденого — тож
	 * тривалість та сама всюди, а пропущені кадри просто зменшують плавність.
	 *
	 * `prefers-reduced-motion` вимикає набір ЦІЛКОМ: підсумок ставиться одразу.
	 * Це не «менша анімація», а її відсутність — саме те, про що просить критерій.
	 */
	interface Props {
		/**
		 * Перекладач вікторини: її рядки лежать у ЛІНИВОМУ чанку
		 * (`i18n/quiz`), бо головний словник вантажать усі відвідувачі.
		 */
		text: (key: string) => string;
		players: Member[];
		/**
		 * КОГО НЕМАЄ ОНЛАЙН — за uid.
		 *
		 * Табло між раундами показує той самий склад, що смуга над дошкою й
		 * підсумок, тож і зниклого мусить показувати так само. Пропустити його тут
		 * означало б, що з трьох переліків гравця видно у двох — а питання «хто
		 * дізконект» ставлять саме на таблі, коли дивляться на рахунок.
		 */
		away?: string[];
		/** Підсумковий рахунок кожного — після цього раунду. */
		scores: Record<string, number>;
		/** Скільки дав саме цей раунд. Нуль — не встиг або схибив. */
		gains: Record<string, number>;
		me: string;
		/** Скільки триває набір, мс. Нуль — без анімації. */
		duration?: number;
		/**
		 * Пауза між кінцем набору й переїздом рядків, мс.
		 *
		 * Не оздоба: без неї два рухи зливаються в один, і питання «як змінилося
		 * моє становище» знову лишається без відповіді — око не встигає відокремити
		 * «долічили» від «поїхали».
		 */
		settle?: number;
		/** Скільки триває переїзд рядків на нові місця, мс. */
		travel?: number;
	}

	let {
		text,
		players,
		scores,
		gains,
		me,
		away = [],
		duration = 700,
		settle = 250,
		travel = 500
	}: Props = $props();

	const reduceMotion = new MediaQuery('(prefers-reduced-motion: reduce)');

	/**
	 * Частка набору: 0 — рахунок до раунду, 1 — після нього.
	 *
	 * Одне число на всіх, а не окреме на гравця: рядки мусять доїхати разом,
	 * інакше порядок місць змінюється на очах у різні миті, і читати таблицю під
	 * час цього неможливо.
	 */
	let progress = $state(0);

	$effect(() => {
		if (reduceMotion.current || duration <= 0) {
			progress = 1;
			return;
		}

		let frame = 0;
		let started: number | null = null;
		const step = (now: number) => {
			started ??= now;
			progress = Math.min(1, (now - started) / duration);
			if (progress < 1) frame = requestAnimationFrame(step);
		};
		frame = requestAnimationFrame(step);
		return () => cancelAnimationFrame(frame);
	});

	/**
	 * ЧИ ВЖЕ ПЕРЕЇХАЛИ РЯДКИ. Друга фаза табла, окрема від набору чисел.
	 *
	 * Доти рядки стояли на КІНЦЕВИХ місцях від першого кадру, і в коді була
	 * записана причина: інакше вони стрибали б місцями протягом самої анімації.
	 * Занепокоєння правильне, а рішення викидало половину сенсу — числа рухалися, а
	 * на питання «як змінилося моє становище» табло не відповідало.
	 *
	 * Скарга автора саме про це: «не видно на якому місці був гравець до цього
	 * раунду і як змінилось його положення».
	 *
	 * Тепер фаз дві, і стрибків так само немає: під час набору порядок МИНУЛОГО
	 * раунду й не міняється, а після паузи всі рядки їдуть РАЗОМ, один раз.
	 */
	let moved = $state(false);

	$effect(() => {
		if (reduceMotion.current || duration <= 0) {
			moved = true;
			return;
		}
		moved = false;
		const timer = setTimeout(() => (moved = true), duration + settle);
		return () => clearTimeout(timer);
	});

	const shown = (uid: string) => {
		const total = scores[uid] ?? 0;
		const gain = gains[uid] ?? 0;
		return Math.round(total - gain * (1 - progress));
	};

	/**
	 * Порядок — за МИНУЛИМ рахунком, поки рядки не переїхали, і за підсумковим
	 * після. Саме правило живе в `utils/revealOrder` — там його й перевірено.
	 *
	 * Ключем `{#each}` лишається `uid`, тому переїзд малює `animate:flip`: Svelte
	 * бачить, що ті самі вузли змінили місця, і рухає їх плавно.
	 */
	const ranked = $derived(rankedByPhase(players, scores, gains, moved));
</script>

<section class="reveal text-panel" data-testid="quiz-reveal-panel">
	<h2 class="reveal__title">{@html formatFont(text('quiz.nextRound'))}</h2>

	<ul class="reveal__list">
		{#each ranked as player, place (player.uid)}
			<li
				class="reveal__row"
				class:player-away={away.includes(player.uid)}
				data-testid="quiz-reveal-{player.uid}-row"
				animate:flip={{ duration: reduceMotion.current ? 0 : travel, easing: cubicOut }}
			>
				<!--
					Номер місця їде РАЗОМ із рядком, а не перемальовується раніше: інакше
					гравець бачив би нове число на старому місці — тобто саме те
					протиріччя, яке табло й мусить розв'язати.
				-->
				<b class="reveal__place">{place + 1}</b>
				<span class="reveal__who">
					<Avatar avatar={player.avatar} />
					<Flag code={player.country} />
					{player.name}{#if player.uid === me}&nbsp;<YouTag />{/if}
				</span>
				<!--
					Приріст стоїть ЛІВОРУЧ від суми: очима читають зліва направо, а
					питання тут «скільки я щойно взяв», і лише потім «скільки всього».
				-->
				{#if (gains[player.uid] ?? 0) > 0}
					<span class="reveal__gain" data-testid="quiz-reveal-{player.uid}-count">
						+{gains[player.uid]}
					</span>
				{/if}
				<b class="reveal__score" data-testid="quiz-reveal-{player.uid}-value">
					{shown(player.uid)}
				</b>
			</li>
		{/each}
	</ul>
</section>

<style>
	/*
	 * Табло стоїть у потоці на місці дошки — тобто посередині того, на що людина
	 * щойно дивилася. Накладка поверх (`position: fixed`) тут була б гіршою: під
	 * нею лишалася б видима дошка з питанням, на яке вже відповіли.
	 */
	.reveal {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-sm);
		width: 100%;
		max-width: 26rem;
		margin: auto;
		padding: var(--space-md);
		box-sizing: border-box;
	}

	.reveal__title {
		margin: 0;
		font-size: var(--font-size-md);
		text-align: center;
		color: var(--color-text-muted);
	}

	.reveal__list {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		width: 100%;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.reveal__row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-xs);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-text), transparent 94%);
	}

	.reveal__place {
		flex-shrink: 0;
		min-width: 2ch;
		font-variant-numeric: tabular-nums;
		color: var(--color-text-muted);
		text-align: right;
	}

	.reveal__who {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Приріст — акцентом, бо це єдине нове число на екрані. */
	.reveal__gain {
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
		font-weight: var(--font-weight-bold);
		color: var(--color-accent);
	}

	/*
	 * `tabular-nums` обов'язкові на числі, що біжить: у пропорційному шрифті «1» і
	 * «4» різної ширини, тож рядок сіпався б саме тоді, коли на нього дивляться.
	 */
	.reveal__score {
		flex-shrink: 0;
		min-width: 4ch;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
</style>
