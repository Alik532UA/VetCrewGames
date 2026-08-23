<script lang="ts">
	import { RotateCcw, Home } from 'lucide-svelte';
	import { fade } from 'svelte/transition';
	import { t, formatFont } from '$lib/i18n';
	import { langPath, type Language } from '$lib/i18n/routing';

	/**
	 * Екран підсумку партії: рахунок, «Грати знову» і повернення в меню.
	 *
	 * Винесено разом зі СТИЛЯМИ. Це не формальність: Svelte скоупить стилі по
	 * компоненту, і правила, залишені в батьківському блоці стилів, до цієї
	 * розмітки не застосувалися б ніколи — без жодного попередження
	 * (SVELTE-UI-v8 § 3.5).
	 *
	 * Дві раніші гри мають власні копії цього екрана й поки лишаються на них:
	 * переїзд змінив би вигляд робочих сторінок, а про це ніхто не просив.
	 * Нові ігри користуються цим компонентом.
	 */
	interface Props {
		score: number;
		/**
		 * Максимум за партію. НЕ показується цифрою поруч із рахунком — лише в
		 * підказці.
		 *
		 * Причина не косметична: «18 / 30» на екрані підсумку читається як оцінка
		 * («ти взяв менше двох третин»), і саме це трохи демотивує. Набране число
		 * саме собою — результат, а не оцінка. Максимум лишається доступним тому,
		 * хто його шукає.
		 *
		 * Приходити мусить із правила рахунку (`maxSessionPoints` у
		 * `config/scoring.ts`), а не з числа раундів: бінарний раунд коштує три
		 * бали, складений — частини плюс надбавка за бездоганність. Доти сюди
		 * передавали `totalRounds`, і всі п’ять ігор показували знаменник, менший
		 * за справжній максимум.
		 */
		total: number;
		lang: Language;
		onPlayAgain: () => void;
		/** Префікс для `data-testid` дочірніх елементів (TESTID-AND-NAMING-v8 § 1.7). */
		testId: string;
	}

	let { score, total, lang, onPlayAgain, testId }: Props = $props();

	/**
	 * Текст підказки. Одне джерело для `title` і для читалки.
	 *
	 * Формулювання з ДВОКРАПКОЮ, а не «максимум 30 балів», і це не стилістика:
	 * «балів» вимагає узгодження з числом (1 бал, 22 бали, 30 балів), а в проєкті
	 * плюралізації немає — власну арифметику з нього прибрали як анти-патерн
	 * (I18N-v8 § 4.2), і `Intl.PluralRules` заводити заради одного рядка не варто.
	 * Двокрапка знімає узгодження й однаково працює в усіх чотирьох мовах.
	 */
	const maxHint = $derived(`${t('common.maxScore')}: ${total}`);
</script>

<div class="game-over-card" in:fade={{ duration: 400 }} data-testid="{testId}-card">
	<h2 class="game-over-title">{@html formatFont(t('common.gameOver'))}</h2>

	<div class="game-over-score">
		<span class="score-label">{@html formatFont(t('common.yourScore'))}</span>
		<!--
			Підказка — `title` ПЛЮС `aria-label`, і це не дублювання.

			`title` показує спливаючий текст мишею, але читалки озвучують його
			непослідовно, а на дотику він не показується взагалі. `aria-label` дає
			читалці той самий текст надійно. Саме число лишається у вмісті, тож
			побачити його можна й без наведення — воно просто не кричить.
		-->
		<span
			class="score-value"
			title={maxHint}
			aria-label="{score}. {maxHint}"
			data-testid="{testId}-score-value">{score}</span
		>
	</div>

	<div class="game-over-actions">
		<button
			type="button"
			class="btn-play-again"
			onclick={onPlayAgain}
			data-testid="{testId}-play-again-btn"
		>
			<RotateCcw size={24} aria-hidden="true" />
			{@html formatFont(t('common.playAgain'))}
		</button>
		<a href={langPath(lang)} class="btn-menu" data-testid="{testId}-main-menu-link">
			<Home size={24} aria-hidden="true" />
			{@html formatFont(t('common.mainMenu'))}
		</a>
	</div>
</div>

<style>
	.game-over-card {
		width: 100%;
		background: var(--color-bg-surface);
		border-radius: var(--radius-lg);
		padding: var(--space-2xl);
		box-shadow: var(--shadow-card);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-xl);
		text-align: center;
	}

	.game-over-title {
		font-size: var(--font-size-2xl);
		font-weight: var(--font-weight-bold);
		margin: 0;
		color: var(--color-text);
	}

	.game-over-score {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.score-label {
		font-size: var(--font-size-md);
		color: var(--color-text-muted);
		text-transform: uppercase;
	}

	.score-value {
		font-size: 3rem;
		font-weight: 900;
		color: var(--color-accent);
		line-height: 1;
	}

	.game-over-actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		width: 100%;
		max-width: 300px;
	}

	.btn-play-again,
	.btn-menu {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		padding: var(--space-md) var(--space-xl);
		border-radius: var(--radius-md);
		border: none;
		font: inherit;
		font-weight: var(--font-weight-bold);
		font-size: var(--font-size-lg);
		cursor: pointer;
		text-decoration: none;
		transition: all var(--transition-fast);
	}

	.btn-play-again {
		background: var(--color-accent);
		color: var(--color-text-on-accent);
		box-shadow: 0 4px 0 color-mix(in srgb, var(--color-accent), black 30%);
	}

	.btn-play-again:hover {
		transform: translateY(-2px);
		background: var(--color-accent-hover);
	}

	.btn-menu {
		background: color-mix(in srgb, var(--color-bg-panel), transparent 80%);
		color: var(--color-text);
		border: 1px solid var(--color-border);
	}

	.btn-menu:hover {
		transform: translateY(-2px);
	}
</style>
