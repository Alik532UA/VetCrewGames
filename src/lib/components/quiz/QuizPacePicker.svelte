<script lang="ts">
	import { formatFont } from '$lib/i18n';
	import { QUIZ_PACES, type QuizPace } from '$lib/config/quizOnline';

	/**
	 * ШВИДКІСТЬ КІМНАТИ: час на раунд і час на перегляд відповіді — ОКРЕМО.
	 *
	 * ## Чому дві шкали, а не одна
	 *
	 * Прохання автора дослівне: «ці дві — час на раунд і час на перегляд відповіді —
	 * окремі налаштування, наприклад можна поставити „час на раунд“ повільний, а
	 * „час на перегляд відповіді“ швидкий». І це не гнучкість заради гнучкості:
	 * потреби різні. Часу на раунд бракує тому, хто читає повільно; часу на розбір —
	 * тому, хто хоче зрозуміти, ЧОМУ відповідь така. Один рівень змушував би платити
	 * другим за перший.
	 *
	 * ## Чому кнопки, а не список
	 *
	 * Рівнів три, і всі три мусять бути видні разом: вибір «стандартна» має сенс
	 * лише поруч зі «швидкою» й «повільною». Список під клік показує один варіант і
	 * ховає два — тобто вимагає відкрити його, щоб дізнатися, з чого вибирають.
	 *
	 * Розмітка й локатори — як у сусіднього `QuizGamePicker`: `<fieldset>` із
	 * `<legend>` групує вибір для скрінрідера, `aria-pressed` каже, що натиснуто.
	 * Дві групи, бо це два незалежні питання, і скрінрідер мусить це чути.
	 */
	interface Props {
		/**
		 * Перекладач вікторини: її рядки лежать у ЛІНИВОМУ чанку (`i18n/quiz`), бо
		 * головний словник вантажать усі відвідувачі.
		 */
		text: (key: string) => string;
		/** Час на раунд. */
		round: QuizPace;
		/** Час на перегляд відповіді. */
		reveal: QuizPace;
		/** Чи можна міняти. Гість бачить швидкість, але не править її. */
		editable: boolean;
		/**
		 * Вибір віддається ВГОРУ, а не пишеться двобічним звʼязком: правда про кімнату
		 * живе в кімнаті, і саме її відповідь мусить перемалювати кнопки. Той самий
		 * підхід, що в наборі ігор.
		 */
		onpick: (round: QuizPace, reveal: QuizPace) => void;
	}

	let { text, round, reveal, editable, onpick }: Props = $props();

	/** Дві однакові групи — один опис. Другий примірник розійшовся б із першим. */
	const groups = $derived([
		{ id: 'round', legend: 'quiz.paceRound', value: round },
		{ id: 'reveal', legend: 'quiz.paceReveal', value: reveal }
	]);

	function pick(group: string, pace: QuizPace) {
		if (!editable) return;
		onpick(group === 'round' ? pace : round, group === 'reveal' ? pace : reveal);
	}
</script>

{#each groups as group (group.id)}
	<fieldset class="pace" data-testid="quiz-pace-{group.id}-fieldset">
		<legend class="pace__legend">{@html formatFont(text(group.legend))}</legend>
		<div class="pace__list">
			{#each QUIZ_PACES as pace (pace)}
				{@const on = group.value === pace}
				<button
					type="button"
					class="pace__item"
					class:pace__item--on={on}
					aria-pressed={on}
					aria-disabled={!editable}
					onclick={() => pick(group.id, pace)}
					data-testid="quiz-pace-{group.id}-{pace}-btn"
				>
					{@html formatFont(text(`quiz.pace.${pace}`))}
				</button>
			{/each}
		</div>
	</fieldset>
{/each}

<style>
	/*
	 * Вигляд узятий у `QuizGamePicker` навмисно: це два сусідні налаштування однієї
	 * кімнати, і різний вигляд читався б як різна природа. Спільного класу немає, бо
	 * спільним був би цілий компонент — а групи тут інші (одна з трьох, а не будь-які
	 * з шести), і зводити їх в один означало б проп «скільки можна вибрати».
	 *
	 * ЗВІРЕНО ЗНОВУ, бо вигляд розійшовся. Набір ігор відтоді перейшов на суцільний
	 * акцент для вибраного й прозоре тло для решти (скарга автора про «другий
	 * акцентний колір»), а тут лишилися старі правила: вибране — акцент на 18%,
	 * рамка — `--color-border`. Поруч в одній панелі це читалося як дві різні
	 * природи вибору — рівно те, від чого застерігає перший абзац.
	 *
	 * Друга причина — не смак. У лобі шкала тепер лежить на `--color-bg-panel`, а в
	 * темі orange-purple `--color-border` дорівнює цьому тлу (обидва #4a2e7a):
	 * невибрані кнопки втратили б межі зовсім. Рамка від кольору тексту панелі —
	 * те саме джерело й та сама причина, що в `QuizGamePicker`.
	 */
	.pace {
		margin: 0;
		padding: 0;
		border: none;
		min-width: 0;
	}

	/*
	 * Підпис — як у набору ігор: ліворуч і кольором тексту панелі. Тут стояло
	 * `opacity: 0.75`, а приглушення прозорістю опускає пару нижче 4.5:1 — у
	 * проєкті його прибрано всюди саме з цієї причини (`OnlineGate`, `RoomList`).
	 */
	.pace__legend {
		padding: 0;
		margin-bottom: var(--space-xs);
		font-size: var(--font-size-sm);
		color: var(--color-text-on-panel);
	}

	.pace__list {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-xs);
	}

	.pace__item {
		/* 44px — власний стандарт сенсорної цілі (ACCESSIBILITY-v8 § 8). */
		min-height: 44px;
		padding: 0 var(--space-md);
		border: 1px solid color-mix(in srgb, var(--color-text-on-panel), transparent 82%);
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text-on-panel);
		font: inherit;
		font-size: var(--font-size-sm);
		cursor: pointer;
		transition:
			background-color var(--transition-fast),
			color var(--transition-fast);
	}

	@media (hover: hover) {
		.pace__item:hover:not(.pace__item--on) {
			background: color-mix(in srgb, var(--color-text-on-panel), transparent 88%);
		}
	}

	/*
	 * Вибране — суцільний акцент і `--color-text-on-accent`, як у набору ігор.
	 * Відрізняється тлом і жирністю, а не лише кольором тексту (WCAG 1.4.1).
	 */
	.pace__item--on {
		border-color: var(--color-accent);
		background: var(--color-accent);
		color: var(--color-text-on-accent);
		font-weight: var(--font-weight-bold);
	}

	.pace__item[aria-disabled='true'] {
		cursor: default;
	}
</style>
