<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import { ONLINE_GAMES } from '$lib/config/quizOnline';

	/**
	 * Які ігри попадатимуться в цій кімнаті.
	 *
	 * ## Прапорці, а не сегментований вибір
	 *
	 * Тут можна вибрати КІЛЬКА, і саме це відрізняє цей елемент від «автостарту»
	 * чи «хто може зайти»: ті — один варіант із двох, а тут набір. Сегментована
	 * панель на такому місці брехала б формою: вона показує вибір, а не набір.
	 *
	 * ## Останню гру вимкнути НЕ МОЖНА
	 *
	 * Порожній набір означав би партію без питань. Тому остання ввімкнена гра не
	 * приймає натиску, і причина стоїть у `title`, а не в тості: тост зникає, а
	 * питання «чому не вимикається» лишається.
	 *
	 * Це не заборона з нізвідки: `configToGames` порожній набір усе одно трактує як
	 * «усі» (див. `config/quizOnline.ts`), тож без цієї межі людина вимикала б усе
	 * і отримувала протилежне тому, що просила.
	 */
	interface Props {
		/**
		 * Перекладач вікторини: її рядки лежать у ЛІНИВОМУ чанку
		 * (`i18n/quiz`), бо головний словник вантажать усі відвідувачі.
		 */
		text: (key: string) => string;
		/** Вибрані ігри. Двобічне. */
		selected: string[];
		/** Чи можна міняти. Гість бачить набір, але не править його. */
		editable: boolean;
	}

	let { text, selected = $bindable(), editable }: Props = $props();

	const isLast = $derived(selected.length === 1);

	function toggle(id: string) {
		if (!editable) return;
		if (selected.includes(id)) {
			// Остання ввімкнена лишається ввімкненою: партія без питань неможлива.
			if (isLast) return;
			selected = selected.filter((game) => game !== id);
			return;
		}
		selected = [...selected, id];
	}
</script>

<fieldset class="games">
	<legend class="games__legend">{@html formatFont(text('quiz.gamesInRoom'))}</legend>
	<div class="games__list">
		{#each ONLINE_GAMES as game (game.id)}
			{@const on = selected.includes(game.id)}
			<button
				type="button"
				class="games__item"
				class:games__item--on={on}
				aria-pressed={on}
				aria-disabled={!editable || (on && isLast)}
				title={on && isLast ? text('quiz.gamesLast') : ''}
				onclick={() => toggle(game.id)}
				data-testid="quiz-game-{game.id}-toggle"
			>
				{@html formatFont(t(game.nameKey))}
			</button>
		{/each}
	</div>
</fieldset>

<style>
	.games {
		margin: 0;
		padding: 0;
		border: none;
		min-width: 0;
	}

	.games__legend {
		padding: 0;
		margin-bottom: var(--space-xs);
		font-size: var(--font-size-sm);
		color: var(--color-text-on-panel);
	}

	.games__list {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-xs);
		justify-content: center;
	}

	/*
	 * Вибране — суцільний акцент, НЕВИБРАНЕ — НІЯКЕ.
	 *
	 * Скарга автора: невибрані ігри читалися як «другий акцентний колір». Так і
	 * було: тут стояло `--color-bg-card`, а це в темі orange-purple насичений
	 * фіолетовий (#6b44a3) поруч із оранжевим акцентом (#ff8c00) — два насичені
	 * кольори поспіль, з яких жоден не означає «не вибрано». Різниця читалася як
	 * «два різні види вибраного».
	 *
	 * Узято рішення `SegmentedChoice` (`.seg__item`), на яке автор і показав:
	 * невибране — прозоре, тобто тло панелі; вибране — суцільний акцент.
	 *
	 * Рамка — ВІД КОЛЬОРУ ТЕКСТУ, а не `--color-border`: у цій темі
	 * `--color-border` дорівнює `--color-bg-panel` (обидва #4a2e7a), тож на панелі
	 * такої рамки не видно взагалі, і прозора кнопка втратила б межі. Те саме
	 * джерело кольору й із тієї самої причини — у `.seg__track`.
	 */
	.games__item {
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
		/*
		 * Перехід лише на тому, що справді міняється: `all` ловив би ще й `outline`
		 * фокусу, і рамка приїжджала б із запізненням (те саме в `SegmentedChoice`).
		 */
		transition:
			background-color var(--transition-fast),
			color var(--transition-fast);
	}

	@media (hover: hover) {
		.games__item:hover:not(.games__item--on) {
			background: color-mix(in srgb, var(--color-text-on-panel), transparent 88%);
		}
	}

	.games__item--on {
		border-color: var(--color-accent);
		background: var(--color-accent);
		color: var(--color-text-on-accent);
		font-weight: var(--font-weight-bold);
	}

	/*
	 * `aria-disabled`, а не `disabled`, тож курсор мусить сказати те саме: клік
	 * доходить (інакше `title` не показався б), але нічого не робить.
	 */
	.games__item[aria-disabled='true'] {
		cursor: default;
	}
</style>
