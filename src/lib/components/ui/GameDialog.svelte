<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * ПІДКЛАДКА ВІКНА ПОВЕРХ ГРИ — одна на всі онлайн-вікна: «Чекаємо» й «Задовго думає» у
	 * вікторині, підсумок «Знайди пару». Доти вона жила лише в `QuizAway`, і друге вікно
	 * мусило б скопіювати її разом із причинами кожного рядка — а розійшлися б копії першою ж
	 * правкою (z-index під шапкою, поле під шапку, прозорість тла).
	 *
	 * САМЕ ВІКНО (`.text-panel`) — у того, хто кличе, а не тут: гейт `backdrop.test.ts` шукає
	 * підкладку тексту в ТОМУ САМОМУ файлі, що й текст. Панель тут дала б тексту фон із
	 * чужого файлу, і кожне вікно довелося б записати у виняток.
	 */
	interface Props {
		children: Snippet;
		/** `data-testid` підкладки. */
		testId: string;
	}

	let { children, testId }: Props = $props();
</script>

<!--
	`aria-modal` НЕ ставиться: вікно нічого не забирає у фокус силою. Роль — у самого вікна
	(`role="status"`): читалка мусить оголосити появу, а не вимагати дії.
-->
<div class="game-dialog" data-testid={testId}>
	{@render children()}
</div>

<style>
	.game-dialog {
		position: fixed;
		inset: 0;
		/*
		 * НИЖЧЕ ЗА ШАПКУ (`GameHeader`, 100), а не поверх неї (прохання автора 2026-09-27).
		 * Доти тут стояло 7000, і підкладка накривала шапку разом із «назад» і меню: той,
		 * хто чекав, не міг ні вийти з кімнати, ні піти в головне меню — лише чекати. Тепер
		 * шапка зверху й працює, а гра під підкладкою так само закрита. Що ця підкладка лежить
		 * під шапкою, тримає `src/content-fill.test.ts`.
		 */
		z-index: 90;
		display: flex;
		align-items: center;
		justify-content: center;
		container-type: inline-size;
		/*
		 * Зверху — під шапку, щоб велике вікно не заходило під неї. Шапка росте з одиницею
		 * (3,25 одиниці, `.fill-window` у global.css), тож і поле теж.
		 */
		--dialog-pad: clamp(8px, 2vmin, var(--space-md));
		padding: calc(var(--fill-u) * 3.25 + var(--dialog-pad)) var(--dialog-pad) var(--dialog-pad);
		box-sizing: border-box;
		/*
		 * Затемнення ПРОЗОРЕ: фонове фото теми мусить лишатися видимим (це стежить
		 * `backdrop.test.ts`), а гра під вікном — вгадуватися, щоб пауза читалася як
		 * пауза, а не як перехід на інший екран.
		 */
		background: color-mix(in srgb, var(--color-bg), transparent 35%);
		backdrop-filter: var(--blur-glass);
	}
</style>
