<script lang="ts">
	import { PawPrint } from 'lucide-svelte';
	import { t, td, formatPlain } from '$lib/i18n';
	import type { MemorySlot } from '$lib/controllers/memoryGame.svelte';

	/**
	 * Одна картка на дошці: сорочкою догори або лицем.
	 *
	 * Переворот — справжній, через `rotateY` на двох боках. Тому обидва боки в
	 * розмітці ЗАВЖДИ: підміна вмісту в момент кліку виглядала б як блимання,
	 * а не як переворот, і ніякий перехід її не врятував би.
	 *
	 * Підпису під зображенням немає навмисно: гра про те, щоб ЗАПАМ'ЯТАТИ, де
	 * що лежить, а назва під картинкою перетворює її на читання.
	 */
	interface Props {
		slot: MemorySlot;
		/** Партія триває, а картку чіпати не можна: лежать уже дві. */
		disabled: boolean;
		/**
		 * Ходить ІНШИЙ: сорочка сіріє.
		 *
		 * Окремий проп, а не `disabled`, і це не зайва деталь. `disabled` означає
		 * «цю картку зараз не перевернути», і в одиночній грі він стоїть, поки
		 * лежать дві відкриті, — тобто сорочки блимали б сірим двічі на хід. Тут
		 * питання інше: чи взагалі МІЙ хід. Типово `false`, тож одиночна гра лишається
		 * такою, як була.
		 */
		waiting?: boolean;
		/** Номер у колоді — ним називається закрита картка для читалок. */
		position: number;
		onflip: () => void;
		testId: string;
	}

	let { slot, disabled, waiting = false, position, onflip, testId }: Props = $props();

	const open = $derived(slot.faceUp || slot.takenBy !== null);

	/*
	 * Закрита картка називається номером, а не твариною: інакше читалка
	 * проговорювала б відповідь, і гра для неї зникала б як гра.
	 */
	const label = $derived(
		open ? formatPlain(td(slot.card.nameKey)) : `${formatPlain(t('memory.card'))} ${position}`
	);
</script>

<button
	type="button"
	class="card"
	class:card--open={open}
	class:card--taken={slot.takenBy !== null}
	class:card--waiting={waiting}
	disabled={disabled || open}
	aria-label={label}
	onclick={onflip}
	data-testid={testId}
>
	<span class="card__inner">
		<span class="card__face card__face--back" aria-hidden="true">
			<PawPrint size={28} />
		</span>
		<span class="card__face card__face--front">
			<img src={slot.card.image} alt="" class="card__image" loading="lazy" width="499" height="665" />
		</span>
	</span>
</button>

<style>
	.card {
		display: block;
		width: 100%;
		aspect-ratio: 3 / 4;
		padding: 0;
		border: none;
		background: none;
		/* Глибина перевороту. Без неї обидва боки просто зникали б і з'являлися. */
		perspective: 700px;
		cursor: pointer;
	}

	.card:disabled {
		cursor: default;
	}

	/*
	 * Зібрана пара блякне й перестає змагатися за увагу з тим, що ще закрите.
	 * Не зникає: її місце на дошці — частина того, що гравець запам'ятовує.
	 *
	 * Три секунди, а не звичні 300мс: швидке згасання читається як «картку
	 * прибрали», а тут навпаки — треба встигнути роздивитися, ЩО саме збіглося,
	 * і аж тоді хай тьмяніє. Тому й `ease-out`: помітний початок, довгий хвіст.
	 *
	 * `prefers-reduced-motion` вимикає це глобальним правилом у `global.css` —
	 * там `transition-duration: 0.01ms !important` на все.
	 */
	.card--taken {
		opacity: 0.25;
		transition: opacity 3s ease-out;
	}

	.card__inner {
		position: relative;
		display: block;
		width: 100%;
		height: 100%;
		transform-style: preserve-3d;
		transition: transform var(--transition-normal);
	}

	.card--open .card__inner {
		transform: rotateY(180deg);
	}

	.card__face {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		overflow: hidden;
		border-radius: var(--radius-md);
		/* Зворотний бік не малюється — інакше видно обидва одночасно. */
		backface-visibility: hidden;
		border: 2px solid var(--color-border);
	}

	.card__face--back {
		background: color-mix(in srgb, var(--color-bg-panel), transparent 15%);
		color: color-mix(in srgb, var(--color-accent), transparent 35%);
	}

	/*
	 * СОРОЧКА СІРІЄ, КОЛИ ХОДИТЬ ІНШИЙ.
	 *
	 * Прохання автора: «лапка кольорова тільки коли мій хід, а коли інший гравець
	 * ходить, то сірий колір». Це не оздоба: дошка на цей час і так не клікається,
	 * але сказано про це було лише курсором — тобто дізнатися можна, тицьнувши.
	 * Тепер стан видно з самої дошки, а не з реакції на дотик.
	 *
	 * Сірий рахується від `--color-text`, а не з літерала: тем чотири, і будь-який
	 * зашитий сірий у якійсь із них або зникне у тлі, або стане плямою.
	 *
	 * Плавність окремо не задається — у `global.css` `color` уже під переходом для
	 * майже всього, тож лапка не перескакує, а гасне. Специфічність тут вища за
	 * `.card__face--back` (два класи проти одного), тобто перекриття навмисне, а не
	 * нічия порядку правил (SVELTE-UI-v8 § 3.6).
	 */
	.card--waiting .card__face--back {
		color: color-mix(in srgb, var(--color-text), transparent 55%);
	}

	.card:hover:not(:disabled) .card__face--back {
		border-color: var(--color-accent);
	}

	.card__face--front {
		transform: rotateY(180deg);
		background: var(--color-bg-surface);
	}

	.card--taken .card__face--front {
		border-color: var(--color-success);
	}

	/* Зображення на всю картку: 3:4 у файлів і 3:4 у самої картки. */
	.card__image {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
