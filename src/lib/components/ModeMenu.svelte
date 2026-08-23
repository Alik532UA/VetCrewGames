<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import { toast } from '$lib/controllers/toast.svelte';

	/**
	 * Підменю розділу: «Грати» і «Грати онлайн».
	 *
	 * Один компонент на «Вікторину» й на «Знайди пару», бо різниця між ними —
	 * єдина адреса, куди веде «Грати».
	 *
	 * ## «ГРАТИ З ДРУЗЯМИ» ТУТ БІЛЬШЕ НЕМА, і це не скорочення функції
	 *
	 * Пункт стояв вимкненим із тостом «скоро буде» — тобто обіцяв окремий режим.
	 * Окремого режиму не буде: гра з друзями ЗІЙШЛАСЯ з «грати онлайн» на
	 * `pairs/online`, де кімнату можна зробити закритою («лише друзі» —
	 * `SegmentedChoice` у формі входу), і саме це й означало «з друзями»:
	 * зайти можна тільки за кодом, який ви комусь надішлете.
	 *
	 * Вимкнена кнопка, яка обіцяє те, що вже зроблено поруч, гірша за відсутню:
	 * вона розводить один режим на два в голові людини, а тост каже «ще не
	 * зроблено» про роботу, яка зроблена.
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
	 *
	 * Лишився рівно один такий пункт — «грати онлайн» у розділі, де спільної гри
	 * ще немає. Переліку `SOON` тут більше немає: він містив один елемент
	 * («грати з друзями»), і той елемент обіцяв роботу, яка вже зроблена поруч.
	 */
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
</nav>
