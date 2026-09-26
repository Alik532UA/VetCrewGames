<script lang="ts">
	import { t } from '$lib/i18n';
	import { loadAccountText } from '$lib/i18n/account';
	import { DEFAULT_AVATAR } from '$lib/config/avatars';
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
	 * Двадцять дві клітинки по 44px (вісім кольорів і чотирнадцять значків) — це
	 * два повні ряди на всю ширину панелі; спливна панель біля кнопки на телефоні
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
		/** Поточна аватарка; порожньо — не вибирали, і тоді видно типову плитку. */
		value: string;
		/** Вибрали плитку. */
		onpick: (avatar: string) => void;
		/** Основа локаторів і імен радіогруп — унікальна на сторінці. */
		scope: string;
	}

	let { value, onpick, scope }: Props = $props();

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
	const shown = $derived(value || DEFAULT_AVATAR);
</script>

<div class="chooser">
	<button
		type="button"
		class="chooser__toggle"
		aria-expanded={open}
		aria-controls="{scope}-panel"
		aria-label={t('pairs.avatarChange')}
		onclick={() => (open = !open)}
		data-testid="{scope}-toggle-btn"
	>
		<Avatar avatar={shown} size={30} showDefault />
	</button>
	{#if open}
		<div class="chooser__panel" id="{scope}-panel" data-testid="{scope}-panel">
			{#if dict}
				<AvatarPicker value={shown} {text} {scope} onchange={onpick} preview={false} />
			{/if}
		</div>
	{/if}
</div>

<style>
	/* Корінь не малює нічого: плитка й панель — елементи ряду батька (див. докблок). */
	.chooser {
		display: contents;
	}

	/* Та сама ціль, що кубик поруч (44px, ACCESSIBILITY-v8 § 8), і той самий вигляд. */
	.chooser__toggle {
		width: 44px;
		height: 44px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-text), transparent 92%);
		cursor: pointer;
	}

	/* Відкритий вибір видно й на кнопці: інакше незрозуміло, чим його закрити. */
	.chooser__toggle[aria-expanded='true'] {
		box-shadow: inset 0 0 0 2px var(--color-text-on-panel);
	}

	@media (hover: hover) {
		.chooser__toggle:hover {
			background: color-mix(in srgb, var(--color-text), transparent 82%);
		}
	}

	.chooser__panel {
		flex: 1 0 100%;
		order: 1;
		min-width: 0;
	}
</style>
