<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t, formatFont } from '$lib/i18n';
	import { dragWindow } from './dragWindow.svelte';

	/**
	 * Панель, що висувається знизу поверх карти.
	 *
	 * Не модальне вікно по центру: на телефоні воно перекрило б усе, і звʼязок
	 * «натиснув вольєр на карті → бачу його» загубився б. Знизу карта лишається
	 * видною зверху, і видно, ЩО саме ти щойно вибрав.
	 */
	interface Props {
		title: string;
		/**
		 * Центр кнопки, з якої панель викликали, у пікселях вікна.
		 *
		 * `null` означає «по центру екрана» — так відкриваються панелі, у яких кнопки
		 * немає (наприклад, коли сюди привело попередження з іншої панелі).
		 */
		anchorX: number | null;
		/** Імʼя вікна: під ним запамʼятовується місце, куди його відтягнули. */
		id: string;
		onClose: () => void;
		/**
		 * Ліворуч уже стоїть картка мапи — панель мусить її обійти.
		 *
		 * Скарга автора: «іноді вікна можуть налазити один на одне». Так і було, і
		 * на будь-якій ширині: картка сидить у `left: var(--space-sm)`, а панель
		 * спливає над своєю кнопкою — а «Мешканці» це найлівіша кнопка смуги, тож
		 * після затиску `clamp` панель ставала теж у лівий край.
		 *
		 * Прапорець, а не ширина числом: скільки місця займає картка, знає її
		 * власний CSS, і два числа розійшлися б на першій же правці. Тут потрібне
		 * лише «обходити чи ні».
		 */
		beside?: boolean;
		children: Snippet;
	}

	let { title, anchorX, id, beside = false, onClose, children }: Props = $props();
</script>

<!--
	Тло ловить клік повз панель. `aria-hidden`, бо кнопка закриття вже є в
	заголовку: читалці не потрібні два способи зробити одне й те саме.
-->
<div
	class="sheet-backdrop"
	aria-hidden="true"
	onclick={onClose}
	data-testid="reserve-sheet-backdrop"
></div>

<section
	class="sheet"
	class:sheet--beside={beside}
	style={anchorX === null ? undefined : `--anchor: ${Math.round(anchorX)}px`}
	use:dragWindow={{ id: `sheet:${id}`, handle: '.sheet__head' }}
	data-testid="reserve-sheet-panel"
>
	<!-- Заголовок — ручка вікна: за нього його й тягнуть. -->
	<header class="sheet__head">
		<!-- Через `formatFont`: у «Вольєри» кирилична «і», якої немає в шрифті. -->
		<h2 class="sheet__title">{@html formatFont(title)}</h2>
		<button
			type="button"
			class="sheet__close"
			aria-label={t('common.close')}
			onclick={onClose}
			data-testid="reserve-sheet-close-btn">×</button
		>
	</header>

	<div class="sheet__body">
		{@render children()}
	</div>
</section>

<style>
	.sheet-backdrop {
		position: fixed;
		inset: 0;
		z-index: 20;
		background: rgb(0 0 0 / 45%);
	}

	.sheet {
		position: fixed;
		/*
		 * Ширина названа змінною, бо її читає `clamp` нижче: щоб не вилізти за край,
		 * треба знати, наскільки вікно широке.
		 */
		--sheet-w: min(34rem, calc(100vw - 2 * var(--space-sm)));
		--anchor: 50vw;
		/*
		 * Скільки місця треба лишити ліворуч. Нуль — картки мапи немає, панель
		 * стоїть як доти.
		 */
		--sheet-avoid: 0px;
		/*
		 * НАД смугою кнопок, а не під нею.
		 *
		 * Доти панель стояла в `bottom: 0` і накривала ту саму смугу, з якої її
		 * відкрили: гравець тиснув «Вольєри» й переставав бачити, що натиснув.
		 * Відступ у 4rem — висота смуги плюс проміжок.
		 */
		bottom: 4.5rem;
		/*
		 * Панель спливає НАД своєю кнопкою — і не вилазить за екран.
		 *
		 * `clamp` робить обидві речі одним рядком: середнє значення ставить вікно по
		 * центру кнопки, а межі не дають йому виїхати за краї. Доти панель завжди
		 * стояла в середині екрана, і на широкому вікні звʼязок із кнопкою губився.
		 *
		 * Не на всю ширину: панель зі списком у три слова, розтягнута на 1900px,
		 * читається як помилка розкладки. Ліворуч лишається видною карта.
		 */
		/*
		 * Нижня межа затиску — не край екрана, а `--sheet-avoid`: саме вона й
		 * відводить панель від картки мапи. Коли картки немає, змінна нульова, і
		 * рядок читається так само, як читався доти.
		 */
		left: clamp(
			calc(var(--space-sm) + var(--sheet-avoid)),
			calc(var(--anchor) - var(--sheet-w) / 2),
			calc(100vw - var(--sheet-w) - var(--space-sm))
		);
		width: var(--sheet-w);
		border-radius: var(--radius-md);
		z-index: 21;
		display: flex;
		flex-direction: column;
		/*
		 * Стеля — усе вільне місце, а не частка екрана.
		 *
		 * Було 62% висоти, і на високому вікні панель штучно стискалася: половина
		 * екрана порожня, а список усередині прокручується. Тепер межа рахується від
		 * того, що справді зайнято: смуга кнопок унизу (`bottom`), шапка з
		 * показниками зверху й проміжок. Карту над панеллю все одно видно — саме
		 * стільки, скільки лишила шапка.
		 */
		max-height: calc(100dvh - 4.5rem - 7rem);
		background: var(--color-bg-panel);
		box-shadow: 0 8px 32px rgb(0 0 0 / 45%);
	}

	/*
	 * ПАНЕЛЬ ПОРУЧ ІЗ КАРТКОЮ МАПИ, а не поверх неї.
	 *
	 * `20rem` — ширина картки (`MapCard`), і це число тут ЗАМІРЯНЕ, а не вгадане:
	 * SYNC із `.mapcard { width: min(20rem, …) }`. Медіазапит не вміє посилатися
	 * на чужий CSS, тож число неминуче у двох місцях; розійдуться вони як розмір
	 * картки, і тоді панель або налізе, або відʼїде задарма.
	 *
	 * Ширина панелі теж стискається: без цього на 900px вона впиралася б у правий
	 * край і `clamp` повертав би її назад під картку.
	 */
	.sheet--beside {
		--sheet-avoid: calc(20rem + var(--space-sm));
		--sheet-w: min(34rem, calc(100vw - 20rem - 3 * var(--space-sm)));
	}

	.sheet__head {
		/* Ручка вікна: жест уздовж неї тягне панель, а не гортає сторінку. */
		cursor: grab;
		touch-action: none;
		display: flex;
		gap: var(--space-sm);
		align-items: center;
		justify-content: space-between;
		padding: var(--space-sm) var(--space-md);
		border-bottom: 1px solid var(--color-border);
	}

	.sheet__title {
		margin: 0;
		font-size: var(--font-size-lg);
	}

	.sheet__close {
		min-width: 44px;
		min-height: 44px;
		border-radius: var(--radius-sm);
		color: inherit;
		font-size: var(--font-size-lg);
		cursor: pointer;
	}

	.sheet__body {
		flex: 1;
		padding: var(--space-md);
		overflow-y: auto;
		/* Інерція на iOS: без цього прокрутка всередині панелі відчувається мертвою. */
		-webkit-overflow-scrolling: touch;
	}
</style>
