<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t, formatFont } from '$lib/i18n';
	import { dragWindow } from './dragWindow.svelte';

	/**
	 * Вікно про те, що вибрано НА КАРТІ: мешканця або вольєр.
	 *
	 * Окреме від `BottomSheet`, і не через вигляд. Панель зі смуги — модальна: вона
	 * гасить карту тлом, бо доки вибираєш розмір вольєра, карта не потрібна. Ця ж
	 * картка — оглядач: вона мусить лишатися відкритою, поки тицяєш по карті далі,
	 * тож тла не має й кліки повз себе не ловить.
	 *
	 * **Чому вона плаває, а не стоїть у стовпці.** Доти картка мешканця була
	 * звичайним рядком розкладки й лежала ПІСЛЯ смуги кнопок — тобто під нею.
	 * Мінікарта (`position: absolute`) накривала її зверху, і кнопку закриття
	 * ставало нічим натиснути: вікно було, а вийти з нього — ні.
	 *
	 * Тому: ліворуч (мінікарта праворуч), над смугою кнопок і вище за обидві —
	 * `z-index` 22 проти 21 у панелі й 2 в мінікарти. Ще й тягається за заголовок:
	 * як і решта вікон тут.
	 */
	interface Props {
		title: string;
		/** Імʼя вікна: під ним запамʼятовується місце, куди його відтягнули. */
		id: string;
		/**
		 * Локатор картки. Різні картки — різні локатори, тож він приходить іззовні:
		 * `reserve-animal-card` лишається тим самим, яким був до переїзду у вікно.
		 */
		testid: string;
		onClose: () => void;
		children: Snippet;
	}

	let { title, id, testid, onClose, children }: Props = $props();
</script>

<section class="mapcard" use:dragWindow={{ id, handle: '.mapcard__head' }} data-testid={testid}>
	<!-- Заголовок — ручка вікна: за нього його й тягнуть. -->
	<header class="mapcard__head">
		<!--
			Заголовок проходить через `formatFont`: у «Ведмідь» і «Носоріг» є кирилична
			«і», якої немає у шрифті inglobal, і без заміни вона малюється чужим
			гліфом. Тексту, який ЧИТАЄ машина, це не стосується — `aria-label` кнопки
			закриття лишається чистим.
		-->
		<h2 class="mapcard__title">{@html formatFont(title)}</h2>
		<button
			type="button"
			class="mapcard__close"
			aria-label={t('common.close')}
			onclick={onClose}
			data-testid="reserve-card-close-btn">×</button
		>
	</header>

	<div class="mapcard__body">
		{@render children()}
	</div>
</section>

<style>
	.mapcard {
		position: fixed;
		/*
		 * Ліворуч і над смугою кнопок. Праворуч сидить мінікарта, і ставати з нею на
		 * те саме місце означало б повторити той самий дефект іншим боком.
		 */
		left: var(--space-sm);
		bottom: 4.5rem;
		width: min(20rem, calc(100vw - 2 * var(--space-sm)));
		/*
		 * Вище за панель (21) і за мінікарту (2).
		 *
		 * Саме вище, а не нижче: картка мала, панель велика, і накрита панеллю вона
		 * знову ставала б тим вікном, яке не закрити. Кнопку закриття самої панелі
		 * це не забирає — вона у своєму правому верхньому кутку.
		 */
		z-index: 22;
		display: flex;
		flex-direction: column;
		max-height: calc(100dvh - 4.5rem - 7rem);
		border-radius: var(--radius-md);
		background: var(--color-bg-panel);
		box-shadow: 0 8px 32px rgb(0 0 0 / 45%);
	}

	.mapcard__head {
		/* Ручка вікна: жест уздовж неї тягне картку, а не гортає сторінку. */
		cursor: grab;
		touch-action: none;
		display: flex;
		gap: var(--space-sm);
		align-items: center;
		justify-content: space-between;
		padding: var(--space-sm) var(--space-md);
		border-bottom: 1px solid var(--color-border);
	}

	.mapcard__title {
		margin: 0;
		font-size: var(--font-size-lg);
		overflow-wrap: anywhere;
	}

	.mapcard__close {
		min-width: 44px;
		min-height: 44px;
		border-radius: var(--radius-sm);
		color: inherit;
		font-size: var(--font-size-lg);
		cursor: pointer;
	}

	.mapcard__body {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: var(--space-md);
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}
</style>
