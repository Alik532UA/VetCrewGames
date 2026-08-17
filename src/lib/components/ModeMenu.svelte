<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import { toast } from '$lib/controllers/toast.svelte';

	/**
	 * Підменю розділу: «Грати», «Грати з друзями», «Грати онлайн».
	 *
	 * Один компонент на «Вікторину» й на «Знайди пару», бо різниця між ними —
	 * єдина адреса, куди веде «Грати». Дві копії цих трьох кнопок розійшлися б
	 * на першій же правці, а вони тут ще й змінюватимуться: спільна гра
	 * зʼявиться спершу в «Знайди пару», потім у «Вікторині».
	 */
	interface Props {
		/** Куди веде «Грати». Єдине, чим розділи різняться. */
		playHref: string;
		/** Основа `data-testid`: `quiz` дає `quiz-play-link`. */
		testId: string;
		/**
		 * Куди веде «Грати онлайн»; `undefined` — спільної гри в розділі ще немає, і
		 * пункт лишається вимкненим із тостом.
		 *
		 * Саме так, а не прапорцем: адреса потрібна все одно, а прапорець довелося б
		 * тримати узгодженим із нею руками.
		 */
		onlineHref?: string;
	}

	let { playHref, testId, onlineHref }: Props = $props();

	/*
	 * Пункти, яких ще немає, — `aria-disabled`, а НЕ `disabled`.
	 *
	 * Атрибут `disabled` ковтає кліки: з такої кнопки повідомлення не показати,
	 * і людина лишається без пояснення, чому нічого не сталося. `aria-disabled`
	 * дає читалці те саме «вимкнено», але клік доходить — і тост каже, що це не
	 * поламано, а ще не зроблено.
	 */
	const SOON = [{ key: 'menu.playWithFriends', id: 'friends' }] as const;
</script>

<nav class="menu-grid">
	<a
		href={playHref}
		class="menu-btn menu-btn--game anim-stagger-1"
		data-testid="{testId}-play-link"
	>
		{@html formatFont(t('menu.play'))}
	</a>

	{#if onlineHref}
		<a
			href={onlineHref}
			class="menu-btn menu-btn--game anim-stagger-2"
			data-testid="{testId}-online-link"
		>
			{@html formatFont(t('menu.playOnline'))}
		</a>
	{:else}
		<button
			type="button"
			class="menu-btn menu-btn--disabled anim-stagger-2"
			aria-disabled="true"
			onclick={() => toast.info('menu.comingSoon')}
			data-testid="{testId}-online-btn"
		>
			{@html formatFont(t('menu.playOnline'))}
		</button>
	{/if}

	{#each SOON as item, index (item.id)}
		<button
			type="button"
			class="menu-btn menu-btn--disabled anim-stagger-{index + 2}"
			aria-disabled="true"
			onclick={() => toast.info('menu.comingSoon')}
			data-testid="{testId}-{item.id}-btn"
		>
			{@html formatFont(t(item.key))}
		</button>
	{/each}
</nav>
