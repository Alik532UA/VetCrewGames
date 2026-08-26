<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { t, formatFont } from '$lib/i18n';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { toast } from '$lib/controllers/toast.svelte';
	import BiomePicker from '$lib/components/reserve/BiomePicker.svelte';
	import { loadReserveText } from '$lib/i18n/reserve';
	import ReserveHud from '$lib/components/reserve/ReserveHud.svelte';
	import ReserveSpeeds from '$lib/components/reserve/ReserveSpeeds.svelte';
	import { reserve, type Speed } from '$lib/controllers/reserve.svelte';
	import { populatedSites, released, residents } from '$lib/reserve/simulation';
	import type { ReserveBiome } from '$lib/reserve/species';

	/**
	 * Вибір локації — окремий екран з окремою адресою.
	 *
	 * Доти це був стан усередині гри, і два наслідки виходили однаково погані:
	 * «назад» із карти вело в головне меню замість вибору локації, а новий вибір
	 * стирав попередній заповідник. Тепер кожна локація живе за власною адресою й
	 * у власному збереженні — партії тривають паралельно.
	 *
	 * «Почати заново» теж переїхало сюди, і не заради місця на смузі кнопок:
	 * усередині партії воно означало «стерти цю», а тут — усі. Сторінка, з якої
	 * видно всі чотири, і є єдине місце, де таке рішення взагалі має сенс.
	 *
	 * Показники фонду стоять і ТУТ — ті самі, що на карті. Каса, шкали й годинник
	 * спільні, тож питання «скільки в мене грошей» не залежить від того, на якій
	 * землі ти стоїш; а вибирати наступну ділянку, не бачивши бюджету, означало б
	 * вибирати навмання.
	 */
	const lang = $derived(languageFromParam(page.params.lang));
	const game = reserve;

	onMount(() => {
		/*
		 * Рядки заповідника довантажуються й тут, а не лише в самій грі: сторінка
		 * вибору ділянки показує шапку, назви біомів і кнопку скидання, тобто читає
		 * той самий словник. Виклик ідемпотентний — на переході в ділянку другого
		 * імпорту не буде (`i18n/reserve/index.ts`).
		 */
		void loadReserveText(settings.locale);
		const release = settings.claimHeader('reserve.title', () => goto(langPath(lang, '')));
		game.start();

		/*
		 * Годинник іде й на цій сторінці.
		 *
		 * Фонд живе, поки відкрита будь-яка сторінка розділу: інакше час спинявся б
		 * щоразу, коли гравець вибирає, куди піти, — і «вибір локації» став би
		 * безкоштовною паузою.
		 */
		const stop = game.startClock();
		return () => {
			stop();
			release();
		};
	});

	const open = (biome: ReserveBiome) => goto(langPath(lang, `reserve/${biome}` as const));

	/**
	 * Стирання йде в ДВА кліки, і другий підписаний інакше.
	 *
	 * Одним кліком тут зникають чотири партії, кожна з яких могла тривати години.
	 * Вікно підтвердження було б важчим за саму дію, а кнопка, яка змінює свій
	 * підпис на питання, ставить те саме питання й нічого не перекриває.
	 */
	let confirming = $state(false);

	function wipeAll() {
		if (!confirming) {
			confirming = true;
			return;
		}
		/*
		 * Через КОНТРОЛЕР, а не через сховище. Прибрати лише запис — саме той дефект,
		 * який тут був: фонд лишався в памʼяті синглтона, шапка показувала стару
		 * партію, а перший же запис повертав її назад у сховище.
		 */
		game.reset();
		confirming = false;
		toast.success('reserve.restartAllDone');
	}
</script>

<div class="menu-page">
	<ReserveHud
		day={game.day}
		budget={game.state.budget}
		feed={game.state.feed}
		impact={game.state.impact}
		reputation={game.state.reputation}
		inReserve={residents(game.state).length}
		inWild={released(game.state).length}
		manySites={populatedSites(game.state) > 1}
		journal={game.state.journal}
		todayNotes={game.state.today}
		dayStart={game.state.dayStart}
	/>

	<BiomePicker onPick={open} />

	<button
		type="button"
		class="wipe"
		class:wipe--armed={confirming}
		onclick={wipeAll}
		onblur={() => (confirming = false)}
		data-testid="reserve-startover-btn"
	>
		{@html formatFont(t(confirming ? 'reserve.restartAllConfirm' : 'reserve.restartAll'))}
	</button>

	<!--
		Керування часом і тут знизу праворуч — те саме місце, що на сторінці
		ділянки. Час на вітрині ІДЕ (див. `startClock` вище), тож ховати керування
		тут означало б спиняти партію переходом на вибір ділянки й не мати чим це
		скасувати.
	-->
	<div class="menu-page__time">
		<ReserveSpeeds speed={game.speed} onSpeed={(value: Speed) => (game.speed = value)} />
	</div>
</div>

<style>
	/* Праворуч у своєму рядку: сторінка — стовпчик на 480px, і «праворуч» тут його край. */
	.menu-page__time {
		display: flex;
		justify-content: flex-end;
		width: 100%;
	}

	.wipe {
		align-self: center;
		min-height: 44px;
		padding: 0 var(--space-lg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg-panel);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	/* Занесена рука виглядає інакше: колір попереджає до того, як текст прочитано. */
	.wipe--armed {
		border-color: var(--color-error);
		color: var(--color-error);
	}
</style>
