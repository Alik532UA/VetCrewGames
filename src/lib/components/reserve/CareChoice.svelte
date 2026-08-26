<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import { speciesById } from '$lib/reserve/species';
	import { WAGES } from '$lib/reserve/constants';
	import type { ReserveEvent } from '$lib/reserve/events';
	import ReserveTrial from './ReserveTrial.svelte';

	/**
	 * ПОТРІБНА ДІЯ, А ПРАЦІВНИКА НЕМА: найняти, зробити самому або нічого.
	 *
	 * ## Чому вікно, а не тихе правило
	 *
	 * Доти відповідь була одна й молчазна: немає ветеринара — тварина гасне, немає
	 * доглядача — стрес росте. Технічне завдання автора: «Робимо для кожної дії, що
	 * немає працівника вибір: 1. Найняти працівника 2. Зробити самому», і «поки
	 * вікно вибору то гра на паузі».
	 *
	 * Пауза живе в контролері (`pending` ставить `speed = 0`), а не тут: час — його
	 * справа, і вікно, яке спиняло б час самотужки, лишило б гру спиненою, якби
	 * зникло з екрана не по-своєму.
	 *
	 * ## Три кнопки, і чому саме такі
	 *
	 * НАЙНЯТИ — гроші замість часу. Ціна названа одразу: зарплата за добу, бо саме
	 * вона й повторюватиметься щодня, а не разовий внесок.
	 *
	 * ЗРОБИТИ САМОМУ — час замість грошей: пʼять раундів міні-гри з порогом 70%
	 * очок. Провал теж витрачає день, і про це сказано ДО початку — інакше
	 * перевірка виглядала б безкоштовною спробою.
	 *
	 * НІЧОГО НЕ РОБИТИ — теж рішення, і воно назване, а не «закрити вікно». Тварина
	 * далі гасне; наступного разу про неї спитають не раніше, ніж за пʼять діб
	 * (`ASK_COOLDOWN_DAYS`), щоб питання не стало щоденним.
	 */
	interface Props {
		/**
		 * Перекладач ЛІНИВОГО словника (`i18n/reserveCare`), а не головного.
		 *
		 * Тринадцять рядків цього вікна коштували кілобайт у чанку, який везе кожен
		 * відвідувач, — заради вікна, яке побачить лише той, хто дійшов до
		 * заповідника й лишився без працівника. Той самий прийом, що у вікторині та
		 * в акаунті.
		 *
		 * Назва виду тварини при цьому й далі з ГОЛОВНОГО словника (`t`): вона стоїть
		 * на екрані заповідника всюди, і лінивою її робити нема сенсу.
		 */
		text: (key: string) => string;
		need: Extract<ReserveEvent, { kind: 'needs-care' }>;
		/** Чи є гроші на зарплату: без них найм лишається видним, але недієвим. */
		canHire: boolean;
		onhire: () => void;
		/** Перевірку пройдено чи ні — рішення ухвалює `ReserveTrial`. */
		onself: (ok: boolean) => void;
		onignore: () => void;
	}

	let { text, need, canHire, onhire, onself, onignore }: Props = $props();

	/** Чи вже почалася перевірка: тоді замість кнопок стоїть сама гра. */
	let trial = $state(false);

	const species = $derived(speciesById(need.speciesId));
	const wage = $derived(WAGES[need.role]);
</script>

<div class="care" data-testid="reserve-care-panel">
	{#if trial}
		<ReserveTrial careText={text} ondone={onself} oncancel={() => (trial = false)} />
	{:else}
		<!--
			ВИБІР ЛИШАЄТЬСЯ ВУЗЬКИМ, а перевірка бере всю ширину вікна.
			
			Причина заміряна: дошка «Де живем?» показує дев'ять природних зон у ряд, і
			у вікні на 26rem їхні підписи налазять один на одного. Розширювати вікно
			для трьох кнопок було б гірше — рядок «Найняти працівника» на пів екрана
			читається як помилка розкладки.
		-->
		<div class="care__choice">
			<h2 class="care__title">
				{@html formatFont(text(`reserve.care.title.${need.role}`))}
			</h2>

			<!--
			Кого саме це стосується — першим рядком. «Комусь потрібен лікар» не
			відповідає на питання, з якою твариною зараз щось робити.
		-->
			<p class="care__who" data-testid="reserve-care-animal-text">
				{@html formatFont(species ? t(species.nameKey) : '')}
			</p>
			<p class="care__hint">{@html formatFont(text(`reserve.care.hint.${need.role}`))}</p>

			<button
				type="button"
				class="care__btn care__btn--main"
				onclick={onhire}
				aria-disabled={!canHire}
				data-testid="reserve-care-hire-btn"
			>
				{@html formatFont(text('reserve.care.hire'))} · {wage}/{@html formatFont(
					text('reserve.care.perDay')
				)}
			</button>

			<button
				type="button"
				class="care__btn"
				onclick={() => (trial = true)}
				data-testid="reserve-care-self-btn"
			>
				{@html formatFont(text('reserve.care.self'))}
			</button>
			<p class="care__hint">{@html formatFont(text('reserve.care.selfHint'))}</p>

			<button
				type="button"
				class="care__btn care__btn--quiet"
				onclick={onignore}
				data-testid="reserve-care-ignore-btn"
			>
				{@html formatFont(text('reserve.care.ignore'))}
			</button>
		</div>
	{/if}
</div>

<style>
	.care {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		width: 100%;
	}

	/* Вибір — вузький стовпчик посередині широкого вікна. */
	.care__choice {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		width: 100%;
		max-width: 26rem;
		margin-inline: auto;
	}

	.care__title {
		margin: 0;
		font-size: var(--font-size-md);
	}

	.care__who {
		margin: 0;
		font-weight: var(--font-weight-bold);
	}

	/* Підказка — кеглем, а не прозорістю: те саме рішення, що в решті панелей. */
	.care__hint {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-on-panel);
	}

	.care__btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-xs);
		width: 100%;
		/* 48px — та сама міра, що в решті кнопок вибору проєкту. */
		min-height: 48px;
		padding: 0 var(--space-md);
		border: 1px solid color-mix(in srgb, var(--color-text), transparent 78%);
		border-radius: var(--radius-md);
		background: var(--color-bg-card);
		color: var(--color-text);
		font: inherit;
		font-weight: var(--font-weight-bold);
		cursor: pointer;
	}

	.care__btn--main {
		border-color: var(--color-accent);
		background: var(--color-accent);
		color: var(--color-text-on-accent);
	}

	/*
	 * «Нічого не робити» — тиха кнопка: це законний вибір, але не той, по який
	 * сюди приходять. Вимкненою вона бути не може — інакше вікно не мало б виходу.
	 */
	.care__btn--quiet {
		background: color-mix(in srgb, var(--color-text), transparent 90%);
		font-weight: var(--font-weight-normal);
	}

	.care__btn[aria-disabled='true'] {
		cursor: not-allowed;
		opacity: 0.6;
	}
</style>
