<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import { settings } from '$lib/services/settings.svelte';
	import { acceptsShortcut } from '$lib/services/keyboard';
	import { SPEEDS, type Speed } from '$lib/controllers/reserve.svelte';

	/**
	 * КЕРУВАННЯ ЧАСОМ: пауза, ×1, ×2, ×5 — і клавіші під ними.
	 *
	 * ## Чому окремий компонент, а не частина шапки
	 *
	 * Доти ця група жила в `ReserveHud`, тобто зверху праворуч. Автор попросив
	 * перенести її вниз праворуч — і разом із переїздом вона перестала бути
	 * частиною шапки: показники нагорі, керування знизу, і це дві різні речі, які
	 * доти ділили один файл лише через сусідство на екрані.
	 *
	 * ## Клавіші
	 *
	 * `` ` `` — пауза, `1` — ×1, `2` — ×2, `3` — ×5. Прохання автора дослівно:
	 * «гарячі кнопка `123 (пауза це ' далі x1 це 1 тощо)».
	 *
	 * Клавіша ліворуч від одиниці на різних розкладках друкує різне (`` ` `` на
	 * латинській, `'` на українській), і саме тому вона читається як
	 * `code: 'Backquote'` — фізична клавіша та сама. Це не дрібниця: `event.key`
	 * тут дав би скорочення, яке зникає при перемиканні розкладки
	 * (HOTKEYS-v8, `HK-EVENT-CODE`).
	 *
	 * Цифри приймаються і з ряду, і з допоміжного блока: канон каже про це прямо
	 * — «людині, яка натиснула `3`, байдуже, який це був `3`».
	 *
	 * ## Відхилення від канонічної карти, і воно назване
	 *
	 * Канон віддає `1`–`9` під «секцію за номером» (HOTKEYS-v8 § 1.1). Секцій
	 * тут немає, а от група з чотирьох швидкостей — це і є нумерований набір, з
	 * якого вибирають за номером; тобто буква закону інша, а дух той самий.
	 * Відхилення вузьке: обробник живе в ЦЬОМУ компоненті, а він існує лише на
	 * сторінці заповідника. На решті сайту цифри вільні, як і доти.
	 *
	 * ## Чотири захисти (HOTKEYS-v8 § 2, `HK-HANDLER-GUARDS`)
	 *
	 *  1. **модифікатори** — `Ctrl+1` перемикає вкладку браузера, і віддавати цю
	 *     комбінацію грі не можна. Перевіряє `acceptsShortcut`;
	 *  2. **поля вводу** — там же: службова панель має числові поля, і набір «2»
	 *     у них не мусить чіпати час;
	 *  3. **автоповтор** — затиснута `3` інакше надсилала б команду щокадру;
	 *  4. **найвищий шар** — поки відкрите вікно, яке вимагає рішення (вибір без
	 *     працівника, наліт), час уже спинено контролером, і клавіша, що його
	 *     розганяє, сперечалася б із самим вікном. Перевірка дивиться в DOM, а не
	 *     в проп: так вона сама покриє й наступне модальне вікно, якого ще немає.
	 *
	 * Усі чотири разом і роблять скорочення сумісним із WCAG SC 2.1.4: вимикач
	 * `settings.shortcutsEnabled` глушить їх усі, бо йде в `acceptsShortcut`
	 * обовʼязковим параметром.
	 */
	interface Props {
		speed: Speed;
		onSpeed: (speed: Speed) => void;
	}

	let { speed, onSpeed }: Props = $props();

	/**
	 * Клавіша під кожну швидкість — у ТОМУ САМОМУ порядку, що `SPEEDS`.
	 *
	 * Мапа, а не `switch` в обробнику: підпис для читалки (`aria-keyshortcuts`) і
	 * саме розпізнавання мусять брати клавішу з одного джерела. Розійшовшись, вони
	 * дали б кнопку, яка обіцяє одну клавішу, а слухає іншу.
	 *
	 * `codes` — масив, бо цифра приходить із двох фізичних клавіш; `hint` — те, що
	 * бачить людина, і воно навмисно коротке.
	 */
	const KEYS: Record<Speed, { codes: string[]; hint: string; aria: string }> = {
		0: { codes: ['Backquote'], hint: '`', aria: '`' },
		1: { codes: ['Digit1', 'Numpad1'], hint: '1', aria: '1' },
		2: { codes: ['Digit2', 'Numpad2'], hint: '2', aria: '2' },
		5: { codes: ['Digit3', 'Numpad3'], hint: '3', aria: '3' }
	};

	/** Підпис для читалки: пауза називається дією, а не значком. */
	const speedLabel = (value: Speed) =>
		value === 0 ? t('reserve.speed.pause') : t(`reserve.speed.x${value}` as const);

	/**
	 * Чи відкрите вікно, яке володіє клавіатурою.
	 *
	 * `alertdialog` — роль обох модальних вікон заповідника (вибір без працівника
	 * й наліт), а `:popover-open` покриває накладки на платформі. Питати DOM тут
	 * дешевше й надійніше за проп: проп доводилося б проводити з `ReserveGame`
	 * і не забути про третє вікно, коли воно зʼявиться.
	 */
	const layerBusy = () =>
		document.querySelector('[role="alertdialog"], [popover]:popover-open') !== null;

	function handleShortcut(event: KeyboardEvent) {
		if (!acceptsShortcut(event, settings.shortcutsEnabled)) return;
		// Автоповтор: затиснута клавіша інакше надсилала б команду щокадру.
		if (event.repeat) return;
		if (layerBusy()) return;

		for (const value of SPEEDS) {
			if (!KEYS[value].codes.includes(event.code)) continue;
			onSpeed(value);
			// `preventDefault` ПІСЛЯ дії, а не перед нею (HOTKEYS-v8 § 2.4).
			event.preventDefault();
			return;
		}
	}
</script>

<svelte:window onkeydown={handleShortcut} />

<div
	class="speeds"
	role="group"
	aria-label={t('reserve.speed.group')}
	data-testid="reserve-speed-toolbar"
>
	{#each SPEEDS as value (value)}
		<button
			type="button"
			class="speed"
			class:speed--on={speed === value}
			aria-pressed={speed === value}
			aria-label={speedLabel(value)}
			aria-keyshortcuts={settings.shortcutsEnabled ? KEYS[value].aria : undefined}
			title={`${speedLabel(value)} · ${KEYS[value].hint}`}
			onclick={() => onSpeed(value)}
			data-testid="reserve-speed-{value}-btn"
		>
			<span class="speed__mark">{value === 0 ? '⏸' : `×${value}`}</span>
			<!--
				Клавіша ПІДПИСАНА на кнопці, а не лише в `aria-keyshortcuts`: атрибут
				чує читалка, а бачить його ніхто. Підпис ховається разом із вимикачем
				скорочень — інакше він обіцяв би клавішу, якої немає
				(HOTKEYS-v8, `HK-DISCOVERABILITY`).
			-->
			{#if settings.shortcutsEnabled}
				<kbd class="speed__key">{@html formatFont(KEYS[value].hint)}</kbd>
			{/if}
		</button>
	{/each}
</div>

<style>
	/* Керування часом — окрема плашка: це інша річ, ніж показники. */
	.speeds {
		display: flex;
		flex: 0 0 auto;
		/* Праворуч у своєму рядку: смуга панелей ліворуч забирає решту місця. */
		margin-inline-start: auto;
		gap: 4px;
		padding: 4px;
		border-radius: var(--radius-sm);
		background: var(--color-bg-panel);
	}

	.speed {
		/* 44px — найменша ціль, у яку впевнено влучає палець (ACCESSIBILITY-v8). */
		min-width: 44px;
		min-height: 44px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1px;
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: inherit;
		font: inherit;
		font-variant-numeric: tabular-nums;
		cursor: pointer;
	}

	.speed--on {
		background: var(--color-accent);
		color: var(--color-text-on-accent);
	}

	.speed__mark {
		line-height: 1;
	}

	/*
	 * Підпис клавіші — дрібний, але не прозорий: `opacity` на цій підкладці
	 * завалює контраст (та сама причина, що в `.hud__label`). Кегль і є засіб.
	 */
	.speed__key {
		font-family: inherit;
		font-size: 10px;
		line-height: 1;
	}
</style>
