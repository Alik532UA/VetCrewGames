<script lang="ts">
	import { tick } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import { t, formatFont } from '$lib/i18n';
	import { loadAccountText } from '$lib/i18n/account';
	import { settings } from '$lib/services/settings.svelte';
	import Avatar from './Avatar.svelte';
	import AvatarPicker from './AvatarPicker.svelte';

	/**
	 * АВАТАРКА ПОРУЧ З ІМЕНЕМ — плитка-кнопка, а вибір відкривається ОКРЕМИМ ВІКНОМ.
	 *
	 * Прохання автора 2026-09-26: значок і колір вибирають там, де людина й так каже, як її
	 * видно іншим, — поруч із прапором та іменем, а не лише в профілі.
	 *
	 * ## Чому вікно, а не рядок під іменем (скарга автора 2026-09-27)
	 *
	 * Доти вибір розгортався рядком ПІД рядком імені й розсував сторінку. На хабі рядок
	 * імені стоїть під трьома дорогами, тож тридцять клітинок лягали нижче краю телефона:
	 * «треба ще користувачу додуматися проскролити, щоб дізнатися, що можна міняти
	 * аватарку». Вікно стоїть посередині екрана, хоч би де була плитка, і все в ньому видно
	 * одразу.
	 *
	 * ## Чому `<dialog>`, а не саморобна накладка
	 *
	 * `showModal()` — платформа: верхній шар (без `z-index`), `Escape`, фокус, що не виходить
	 * за вікно, і неактивна сторінка під ним. Власного закривача на `Escape` тут немає, тож
	 * перелік саморобних накладок не росте (`src/overlays.test.ts`). Свої — лише дві речі:
	 * клік по тлу (його браузер `<dialog>` не закриває) і повернення фокуса на плитку.
	 *
	 * ## Підписи — з лінивого чанка
	 *
	 * Назви варіантів («Кіт», «Синій») лежать у `i18n/account`, а не в головному словнику,
	 * бо той їде в першому payload КОЖНОГО відвідувача (причина — у `i18n/account/index.ts`).
	 * Чанк довантажується на першому відкритті, і доти вибору у вікні немає: радіокнопки
	 * без підписів озвучувалися б як «кнопка» тридцять разів.
	 *
	 * ## Вибір зберігає ВЛАСНИК значення
	 *
	 * Натиск на клітинку і є рішення — «Зберегти» тут немає, як і в профілі; «Готово» лише
	 * закриває вікно. Що значить «зберегти», знає не цей компонент: у формі входу це спільний
	 * стан і профіль, у лобі — ще й рядок складу кімнати.
	 */
	interface Props {
		/** Поточна аватарка; порожньо — лише без сховища, і тоді видно нейтральний силует. */
		value: string;
		/** Вибрали клітинку. */
		onpick: (avatar: string) => void;
		/** Основа локаторів і імен радіогруп — унікальна на сторінці. */
		scope: string;
		/** Пари, які тримають інші в кімнаті (пара → імʼя), — їх не вибрати. */
		taken?: ReadonlyMap<string, string>;
	}

	let { value, onpick, scope, taken }: Props = $props();

	let open = $state(false);
	let dict = $state<Record<string, string> | null>(null);
	let dialog = $state<HTMLDialogElement>();
	let toggle = $state<HTMLButtonElement>();
	let heading = $state<HTMLElement>();

	// Словник — коли вибір відкрито, і заново на зміну мови: інакше підписи
	// лишилися б мовою, якою вибір відкрили вперше.
	$effect(() => {
		if (!open) return;
		const locale = settings.locale;
		let current = true;
		void loadAccountText(locale).then((loaded) => {
			if (current) dict = loaded;
		});
		return () => {
			current = false;
		};
	});

	const text = $derived((key: string) => dict?.[key] ?? '');

	async function show() {
		open = true;
		await tick();
		if (!dialog) return;
		// Браузер без `showModal` (старіший за 2022 рік) показує вікно на місці, без тла.
		if (typeof dialog.showModal === 'function') dialog.showModal();
		else dialog.setAttribute('open', '');
		heading?.focus();
	}

	const hide = () => dialog?.close();

	/** Вікно закрилося — будь-як: «Готово», `Escape` чи клік по тлу. Фокус — на плитку. */
	function closed() {
		open = false;
		toggle?.focus();
	}

	/**
	 * Вікно — у `<body>`, а не там, де плитка (скарга автора 2026-09-27: «на широкому екрані
	 * відрізаний верх та низ вікна»). Хаб і лобі на великому екрані збільшує `zoom`
	 * (`fitToViewport`, «лише вгору»), а `zoom` діє на все, що лежить у дереві під ними, —
	 * і на `<dialog>` у верхньому шарі теж: вікно на 30rem ставало у 1,6 раза більшим і
	 * виходило за екран. У `<body>` предків із `zoom` немає, тож межі вікна — межі екрана.
	 * Верхньому шару місце в дереві байдуже, а фокус і `aria-controls` тримаються за `id`.
	 * Той самий переїзд робить меню країн (`utils/menuColumns.ts`, `fitMenu`).
	 */
	const toBody: Attachment<HTMLDialogElement> = (node) => {
		document.body.appendChild(node);
		return () => node.remove();
	};

	/**
	 * Клік по тлу закриває. Ціль такого кліку — сам `<dialog>`: вміст займає його цілком,
	 * тож клік усередині вікна потрапляє в дитину й вікна не закриває.
	 */
	const closeOnBackdrop: Attachment<HTMLDialogElement> = (node) => {
		const click = (event: MouseEvent) => {
			if (event.target === node) node.close();
		};
		node.addEventListener('click', click);
		return () => node.removeEventListener('click', click);
	};
</script>

<div class="chooser">
	<button
		type="button"
		class="chooser__toggle btn-secondary"
		bind:this={toggle}
		aria-haspopup="dialog"
		aria-expanded={open}
		aria-controls="{scope}-dialog"
		aria-label={t('pairs.avatarChange')}
		onclick={show}
		data-testid="{scope}-toggle-btn"
	>
		<Avatar avatar={value} size={30} showDefault />
	</button>
	<dialog
		bind:this={dialog}
		id="{scope}-dialog"
		class="chooser__dialog"
		aria-labelledby="{scope}-title"
		onclose={closed}
		{@attach toBody}
		{@attach closeOnBackdrop}
		data-testid="{scope}-modal"
	>
		{#if open}
			<div class="chooser__window fill" data-testid="{scope}-panel">
				<h2 class="chooser__title" id="{scope}-title" tabindex="-1" bind:this={heading}>
					{@html formatFont(t('pairs.avatarChange'))}
				</h2>
				{#if dict}
					<AvatarPicker {value} {text} {scope} onchange={onpick} preview {taken} />
				{/if}
				<button
					type="button"
					class="chooser__done btn-accent"
					onclick={hide}
					data-testid="{scope}-done-btn"
				>
					{@html formatFont(t('pairs.avatarDone'))}
				</button>
			</div>
		{/if}
	</dialog>
</div>

<style>
	/* Корінь не малює нічого: плитка лишається в одному ряду з прапором та іменем. */
	.chooser {
		display: contents;
	}

	/*
	 * Та сама ціль, що кубик поруч (44px, ACCESSIBILITY-v8 § 8), і той самий вигляд —
	 * кнопки (`.btn-secondary`), а не плитки панелі.
	 */
	.chooser__toggle {
		width: 44px;
		height: 44px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border-radius: var(--radius-sm);
	}

	/*
	 * `<dialog>` — лише рамка верхнього шару: без полів, рамки й тла, щоб клік по ньому
	 * означав рівно «по тлу» (див. `closeOnBackdrop`). Вікно малює `.chooser__window`.
	 */
	.chooser__dialog {
		width: min(calc(100vw - 32px), 30rem);
		max-height: calc(100dvh - 32px);
		padding: 0;
		border: none;
		background: transparent;
		color: inherit;
		overflow: visible;
	}

	.chooser__dialog::backdrop {
		background: rgba(0, 0, 0, 0.55);
	}

	/*
	 * Та сама панель, що вікна хабу (`OnlineWindow`): тло й текст — пара, яку гейт контрасту
	 * вже бачив у всіх чотирьох темах. Прокрутка — всередині вікна й лише на низькому
	 * екрані (телефон боком), а не сторінки під ним.
	 */
	.chooser__window {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		max-height: calc(100dvh - 32px);
		padding: var(--space-lg);
		border-radius: var(--radius-md);
		background: var(--color-bg-panel);
		color: var(--color-text-on-panel);
		box-shadow: var(--shadow-card);
		box-sizing: border-box;
		overflow-y: auto;
	}

	.chooser__title {
		margin: 0;
		font-size: var(--font-size-lg);
		color: var(--color-text-on-panel);
	}

	/* «Готово» — на всю ширину вікна: головна дія тут одна, і палець знаходить її внизу. */
	.chooser__done {
		min-height: 44px;
		border-radius: var(--radius-sm);
		font: inherit;
		font-weight: var(--font-weight-bold);
	}
</style>
