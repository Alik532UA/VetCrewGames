<script lang="ts">
	import { t } from '$lib/i18n';
	import { loadAccountText } from '$lib/i18n/account';
	import { settings } from '$lib/services/settings.svelte';
	import Avatar from './Avatar.svelte';
	import AvatarPicker from './AvatarPicker.svelte';

	/**
	 * АВАТАРКА ПОРУЧ З ІМЕНЕМ — плитка-кнопка, а під рядком розгортається вибір.
	 *
	 * Прохання автора 2026-09-26: значок і колір вибирають там, де людина й так
	 * каже, як її видно іншим, — у формі входу поруч із прапором та іменем, а не
	 * лише в профілі. Доти аватарку можна було змінити тільки на `/account/`, і для
	 * того, хто акаунта не має, вона не змінювалася ніде.
	 *
	 * ## Чому розгортається РЯДОК, а не спливає меню
	 *
	 * Тридцять клітинок по 44px (дванадцять кольорів і вісімнадцять значків) — це
	 * кілька повних рядів на всю ширину панелі; спливна панель біля кнопки на телефоні
	 * або вилізла б за край, або стала б прокручуваною в прокручуваному. Тому вибір
	 * лягає окремим рядком ПІД рядком імені.
	 *
	 * Зроблено це без обгортки в батька: корінь тут `display: contents`, тож плитка
	 * лишається в одному ряду з прапором та іменем, а панель — елемент того самого
	 * гнучкого ряду з `flex-basis: 100%` і `order: 1`, і переноситься на свій рядок
	 * сама. Умова одна: ряд батька мусить мати `flex-wrap: wrap`.
	 *
	 * ## Підписи — з лінивого чанка
	 *
	 * Назви варіантів («Кіт», «Синій») лежать у `i18n/account`, а не в головному
	 * словнику, бо той їде в першому payload КОЖНОГО відвідувача (причина — у
	 * `i18n/account/index.ts`). Чанк довантажується на першому відкритті вибору, і
	 * доти вибору просто немає на екрані: радіокнопки без підписів озвучувалися б
	 * як «кнопка» двадцять два рази.
	 *
	 * ## Це РОЗГОРТАННЯ, а не накладка
	 *
	 * Панель нічого не перекриває — вона розсуває сторінку, як абзац. Тому тут
	 * взірець disclosure (`aria-expanded` + `aria-controls`), а не спливна панель:
	 * ні власного `Escape`, ні кліку по тлу, ні повернення фокуса — закриває та сама
	 * плитка, що відкрила. Саморобний закривач тут зробив би з розгортання ще одну
	 * саморобну накладку, а їхній перелік лише коротшає (`src/overlays.test.ts`).
	 *
	 * ## Вибір зберігає ВЛАСНИК значення
	 *
	 * Натиск на плитку і є рішення — «Зберегти» тут немає, як і в профілі. Але що
	 * значить «зберегти», знає не цей компонент: у формі входу це спільний стан і
	 * профіль, у лобі — ще й рядок складу кімнати.
	 */
	interface Props {
		/** Поточна аватарка; порожньо — лише без сховища, і тоді видно нейтральний силует. */
		value: string;
		/** Вибрали плитку. */
		onpick: (avatar: string) => void;
		/** Основа локаторів і імен радіогруп — унікальна на сторінці. */
		scope: string;
		/** Пари, які тримають інші в кімнаті (пара → імʼя), — їх не вибрати. */
		taken?: ReadonlyMap<string, string>;
	}

	let { value, onpick, scope, taken }: Props = $props();

	let open = $state(false);
	let dict = $state<Record<string, string> | null>(null);

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
</script>

<div class="chooser">
	<button
		type="button"
		class="chooser__toggle btn-secondary"
		aria-expanded={open}
		aria-controls="{scope}-panel"
		aria-label={t('pairs.avatarChange')}
		onclick={() => (open = !open)}
		data-testid="{scope}-toggle-btn"
	>
		<Avatar avatar={value} size={30} showDefault />
	</button>
	{#if open}
		<div class="chooser__panel" id="{scope}-panel" data-testid="{scope}-panel">
			{#if dict}
				<AvatarPicker {value} {text} {scope} onchange={onpick} preview={false} {taken} />
			{/if}
		</div>
	{/if}
</div>

<style>
	/* Корінь не малює нічого: плитка й панель — елементи ряду батька (див. докблок). */
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
	 * Відкритий вибір видно й на кнопці — утиснутою, як натиснута клавіша: інакше
	 * незрозуміло, чим його закрити.
	 */
	.chooser__toggle[aria-expanded='true'] {
		transform: translateY(2px);
		box-shadow: inset 0 0 0 2px var(--color-text);
	}

	.chooser__panel {
		flex: 1 0 100%;
		order: 1;
		min-width: 0;
	}
</style>
