<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { t, formatFont } from '$lib/i18n';
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
		players: Member[];
		/** Підсумковий рахунок кожного — після цього раунду. */
		scores: Record<string, number>;
		/** Скільки дав саме цей раунд. Нуль — не встиг або схибив. */
		gains: Record<string, number>;
		me: string;
		/** Скільки триває набір, мс. Нуль — без анімації. */
		duration?: number;
	}

	let { players, scores, gains, me, duration = 700 }: Props = $props();

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

	const shown = (uid: string) => {
		const total = scores[uid] ?? 0;
		const gain = gains[uid] ?? 0;
		return Math.round(total - gain * (1 - progress));
	};

	/**
	 * Порядок — за ПІДСУМКОМ, а не за поточним показаним числом.
	 *
	 * Інакше рядки стрибали б місцями протягом самої анімації: той, кому ще не
	 * долічили, опускався б униз і піднімався назад.
	 */
	const ranked = $derived(
		[...players].sort((a, b) => (scores[b.uid] ?? 0) - (scores[a.uid] ?? 0) || a.order - b.order)
	);
</script>

<section class="reveal text-panel" data-testid="quiz-reveal-panel">
	<h2 class="reveal__title">{@html formatFont(t('quiz.nextRound'))}</h2>

	<ul class="reveal__list">
		{#each ranked as player, place (player.uid)}
			<li class="reveal__row" data-testid="quiz-reveal-{player.uid}-row">
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
