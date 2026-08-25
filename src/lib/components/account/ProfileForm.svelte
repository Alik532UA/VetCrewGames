<script lang="ts">
	import { formatFont } from '$lib/i18n';
	import CountryPicker from '$lib/components/ui/CountryPicker.svelte';

	/**
	 * ПРОФІЛЬ: те, що бачать інші. Два імені й прапор.
	 *
	 * ## Чому окремим компонентом
	 *
	 * Сторінка акаунта вийшла за межу розміру (410 при орієнтирі 400), а решта її
	 * панелей — приватність, таблиця лідерів, пароль і видалення — уже давно
	 * компоненти зі своїм префіксом класів. Профіль лишався єдиною панеллю
	 * всередині маршруту, тобто виносити було що й без межі.
	 *
	 * ## АВАТАР І «ВИЙТИ» ЗВІДСИ ПІШЛИ
	 *
	 * Аватар — у власну панель (`AvatarPanel`), бо він зберігається САМИМ вибором:
	 * натиск на плитку вже і є рішення, а кнопка після нього питає те саме вдруге.
	 * Тут лишилося те, що ПИШУТЬ і хочуть перечитати перед відправкою, — і рівно
	 * тому кнопка «Зберегти» тепер відповідає за все, що в панелі, а не за половину.
	 *
	 * «Вийти з акаунта» переїхало в панель «Пароль і видалення» — до решти дій над
	 * САМИМ акаунтом. Тут вона стояла під формою свого підпису, тобто пропонувала
	 * вийти тому, хто щойно правив імʼя.
	 *
	 * ## ДВА ІМЕНІ, НАЗВАНІ ЗА ФУНКЦІЄЮ
	 *
	 * Доти підписи були «Нікнейм» і «Псевдонім» — два слова, які обидва
	 * перекладаються як «нікнейм». Вони не розводили нічого: людина бачила два
	 * синоніми й гадала, котре з них для чого, а автор написав про це прямо
	 * («потрібно подумати як їх переназвати»). Тепер підпис каже, ЩО поле робить:
	 * «Імʼя в грі» — те, що бачать інші; «@нік для пошуку» — унікальна латиниця,
	 * за якою знаходять. Знак «@» показує рід поля ще до читання підказки.
	 */
	interface Props {
		/** Перекладач сторінки: рядки акаунта лежать у лінивому чанку. */
		text: (key: string) => string;
		name: string;
		handle: string;
		country: string;
		/** Чи можна зберігати — імʼя непорожнє, нік допустимий, мережа вільна. */
		canSave: boolean;
		/** Ключ причини, чому не збереглося. `null` — нічого не сталося. */
		problem: string | null;
		onsave: () => void;
	}

	let {
		text,
		name = $bindable(),
		handle = $bindable(),
		country = $bindable(),
		canSave,
		problem,
		onsave
	}: Props = $props();
</script>

<section class="profile text-panel">
	<h2 class="profile__title">{@html formatFont(text('account.profileTitle'))}</h2>

	<label class="profile__label" for="account-name">
		<span>{@html formatFont(text('account.gameName'))}</span>
	</label>
	<input
		id="account-name"
		class="profile__input"
		type="text"
		bind:value={name}
		maxlength="48"
		data-testid="account-name-input"
	/>
	<p class="profile__hint">{@html formatFont(text('account.gameNameHint'))}</p>

	<label class="profile__label" for="account-handle">
		<span>{@html formatFont(text('account.handle'))}</span>
	</label>
	<!--
		Нік зводиться до дозволених символів ОДРАЗУ, у значенні. `pattern` лише
		малює помилку, а мережа однаково отримала б те, що ввели, — і правило бази
		відкинуло б запис уже після натиску.
	-->
	<input
		id="account-handle"
		class="profile__input"
		type="text"
		value={handle}
		oninput={(event) =>
			(handle = event.currentTarget.value
				.toLowerCase()
				.replace(/[^a-z0-9_]/g, '')
				.slice(0, 20))}
		maxlength="20"
		autocapitalize="none"
		autocomplete="off"
		spellcheck="false"
		data-testid="account-handle-input"
	/>
	<p class="profile__hint">{@html formatFont(text('account.handleHint'))}</p>

	<CountryPicker bind:value={country} scope="account-country" />

	<button
		type="button"
		class="btn-primary"
		onclick={onsave}
		aria-disabled={!canSave}
		data-testid="account-save-btn"
	>
		{@html formatFont(text('account.save'))}
	</button>

	{#if problem}
		<p class="profile__error" role="alert" data-testid="account-profile-error-text">
			{@html formatFont(text(problem))}
		</p>
	{/if}
</section>

<style>
	/*
	 * Стилі перенесені зі сторінки БЕЗ ЗМІН значень: вигляд не мусить поїхати від
	 * того, що розмітку витягли в компонент. Змінилися лише назви класів — на
	 * власний префікс, як у решти панелей акаунта (`privacy__`, `security__`).
	 */
	.profile {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		width: 100%;
	}

	.profile__title {
		margin: 0 0 var(--space-xs);
		font-size: var(--font-size-md);
	}

	.profile__label {
		font-size: var(--font-size-sm);
		color: var(--color-text-on-panel);
	}

	/*
	 * Підказки — КЕГЛЕМ, а не прозорістю: `opacity` на тексті цієї панелі опускає
	 * пару під 4.5:1, і жодне значення прозорості її не рятує. Те саме міркування
	 * записане в `RoomList` і `OnlineGate`.
	 */
	.profile__hint {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-on-panel);
	}

	/*
	 * Помилка — АКЦЕНТОМ, а не власним червоним.
	 *
	 * Свого токена для помилки в проєкті немає, і вигадувати колір тут означало б
	 * завести пару, якої гейт контрасту не бачив, — у чотирьох темах одразу. Акцент
	 * у кожній темі вже підібраний під текст на панелі, а те, що це саме помилка,
	 * каже `role="alert"` і сам текст.
	 */
	.profile__error {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-accent);
		font-weight: var(--font-weight-bold);
	}

	.profile__input {
		/* 44px — власний стандарт сенсорної цілі (ACCESSIBILITY-v8 § 8). */
		min-height: 44px;
		padding: 0 var(--space-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: var(--color-text);
		font: inherit;
	}
</style>
