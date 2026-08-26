<script lang="ts">
	/**
	 * СМУГА ЧАСУ, ЩО СПЛИВАЄ: раунд вікторини, хід у спільній партії.
	 *
	 * ## Чому один компонент на двох
	 *
	 * Смуга народилася у вікторині й жила в `QuizRound` разом зі своїм CSS. Автор
	 * попросив таку саму в «Знайди пару»: «краще додай таймер, який вже
	 * реалізований в вікторині». Скопіювати шість рядків розмітки й п'ятнадцять
	 * CSS було б швидше — і саме тому не зроблено: дві копії того самого вигляду
	 * розходяться на першій же правці, і розходяться непомітно, бо кожна виглядає
	 * правильною окремо. Той самий висновок уже зроблено для `PlayerBadge`.
	 *
	 * ## Час приходить ЧИСЛАМИ, а не годинником
	 *
	 * Свій `setInterval` тут дав би другий годинник, і смуга в двох гравців
	 * розійшлася б саме тому, що кожен рахував би від власного `Date.now()`.
	 * Залишок виводиться зі СЕРВЕРНИХ позначок часу вище — у контролері, — і
	 * приходить сюди готовим числом.
	 *
	 * ## Чому без цифри
	 *
	 * Цифра, що біжить, тягне погляд сильніше за саму смугу, а знати треба не
	 * «скільки лишилося», а «встигаю чи ні». Тому число живе лише в `aria-label`:
	 * скрінрідеру смуга не каже нічого, і без підпису це був би порожній елемент.
	 */
	interface Props {
		/** Скільки лишилося, мс. */
		leftMs: number;
		/** Скільки триває відрізок, мс. Нуль — відрізка немає, смуга порожня. */
		limitMs: number;
		/** Підпис для скрінрідера: `formatPlain` НЕ застосовувати (див. AGENTS.md). */
		label: string;
		testId: string;
	}

	let { leftMs, limitMs, label, testId }: Props = $props();

	const leftPercent = $derived(limitMs === 0 ? 0 : Math.round((leftMs / limitMs) * 100));
</script>

<div class="timer" role="timer" aria-label={label} data-testid={testId}>
	<span class="timer__fill" style="width: {leftPercent}%"></span>
</div>

<style>
	.timer {
		width: 100%;
		height: 6px;
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--color-text), transparent 88%);
		overflow: hidden;
		flex-shrink: 0;
	}

	.timer__fill {
		display: block;
		height: 100%;
		background: var(--color-accent);
		/* Лінійно й без згладжування: смуга мусить показувати час, а не наздоганяти його. */
		transition: width 0.1s linear;
	}
</style>
