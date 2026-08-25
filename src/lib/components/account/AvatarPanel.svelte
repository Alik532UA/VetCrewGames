<script lang="ts">
	import { formatFont } from '$lib/i18n';
	import AvatarPicker from '$lib/components/ui/AvatarPicker.svelte';

	/**
	 * АВАТАР — ОКРЕМА ПАНЕЛЬ, і зберігається сам.
	 *
	 * ## Чому не разом з імʼям
	 *
	 * Доти аватар стояв першим у формі профілю, під однією кнопкою «Зберегти» з
	 * імʼям, псевдонімом і прапором. Автор попросив розділити, і причина видна в
	 * самій взаємодії: імʼя й нік ПИШУТЬ (і хочуть перечитати перед відправкою), а
	 * аватар ВИБИРАЮТЬ — натиск на плитку вже і є рішення. Кнопка після нього
	 * питає те саме вдруге.
	 *
	 * Різна природа — різна панель: інакше половина вмісту зберігається натиском
	 * на плитку, а половина чекає кнопки, і про це нема як сказати одним підписом.
	 *
	 * ## Тихо, а голос — лише при невдачі
	 *
	 * Вибір видно на самій плитці, тобто підтверджувати нічого. А ось НЕвдачу
	 * видно не буває: без цього рядка мовчання означало б і «збережено», і
	 * «мережі немає». Тому при невдачі вибір ВЕРТАЄТЬСЯ до попереднього — щоб на
	 * екрані не лишалося те, чого немає в базі, — і про це кажуть уголос.
	 *
	 * ## Поки профілю немає, це лише місцевий вибір
	 *
	 * Запис у базу вимагає наявного профілю (`Account.saveAvatar` — там причина:
	 * інакше вийшов би профіль з одного аватара, без імені). Доти аватар живе у
	 * сховищі й доїде в базу першим «Зберегти» в сусідній панелі. Для людини це
	 * непомітно: у грі й у шапці аватар діє одразу.
	 */
	interface Props {
		/** Перекладач сторінки: рядки акаунта лежать у лінивому чанку. */
		text: (key: string) => string;
		/** Вибраний аватар — рядок `значок:колір`. */
		value: string;
		/** Триває мережева дія. */
		busy: boolean;
		/**
		 * Зберегти вибір. `false` — не збереглося, і тоді панель вертає попередній.
		 *
		 * Мережу знає сторінка; сюда приходить лише відповідь «вийшло чи ні».
		 */
		onpick: (avatar: string) => Promise<boolean>;
	}

	let { text, value, busy, onpick }: Props = $props();

	/**
	 * Чи не вдалося зберегти останній вибір.
	 *
	 * Власного «оптимістичного» стану тут НЕМА навмисно: сторінка міняє `value`
	 * ще до мережі й сама вертає його, якщо запис не вдався. Друга копія
	 * значення тут дала б два джерела правди про те саме — і саме на цьому
	 * Svelte попереджав, що `$state(value)` бачить лише початкове значення.
	 */
	let failed = $state(false);

	async function pick(next: string) {
		failed = false;
		failed = !(await onpick(next));
	}
</script>

<section class="avatar-panel text-panel" data-testid="account-avatar-panel">
	<h2 class="avatar-panel__title">{@html formatFont(text('account.avatarTitle'))}</h2>

	<AvatarPicker
		{value}
		onchange={(next) => void pick(next)}
		{text}
		disabled={busy}
		scope="account-avatar"
	/>

	<p class="avatar-panel__hint">{@html formatFont(text('account.avatarHint'))}</p>

	{#if failed}
		<p class="avatar-panel__error" role="alert" data-testid="account-avatar-error-text">
			{@html formatFont(text('account.avatarFailed'))}
		</p>
	{/if}
</section>

<style>
	.avatar-panel {
		display: flex;
		flex-direction: column;
		gap: var(--account-gap);
		width: 100%;
		border-radius: var(--account-card-radius);
		padding: var(--account-pad);
	}

	.avatar-panel__title {
		margin: 0;
		font-size: var(--font-size-md);
	}

	/*
	 * Підказка — КЕГЛЕМ, а не прозорістю: те саме рішення й та сама причина, що в
	 * решті панелей акаунта (прозорість опускає пару під 4,5:1).
	 */
	.avatar-panel__hint {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-on-panel);
	}

	/* Помилка — акцентом: свого токена для помилки в проєкті немає. */
	.avatar-panel__error {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-accent);
		font-weight: var(--font-weight-bold);
	}
</style>
