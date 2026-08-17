<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { t, formatFont } from '$lib/i18n';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { toast } from '$lib/controllers/toast.svelte';
	import { ReserveController, type Speed } from '$lib/controllers/reserve.svelte';
	import type { Quality } from '$lib/reserve/constants';
	import { freeEnclosures, released, residents } from '$lib/reserve/simulation';
	import type { RaidTactic, ReserveCommand } from '$lib/reserve/types';
	import type { ReserveBiome } from '$lib/reserve/species';
	import type { RouteRest } from '$lib/i18n/routing';
	import ReserveHud from './ReserveHud.svelte';
	import ReserveStage from './ReserveStage.svelte';
	import ReserveOutcome from './ReserveOutcome.svelte';
	import ReserveSheet from './ReserveSheet.svelte';
	import AnimalCard from './AnimalCard.svelte';
	import RaidModal from './RaidModal.svelte';
	import ReserveBar, { type Panel } from './ReserveBar.svelte';

	/**
	 * Партія заповідника в ОДНОМУ біомі.
	 *
	 * Біом приходить пропсом від маршруту, а не вибирається тут: кожна ділянка живе
	 * за власною адресою й у власному збереженні, тож партії тривають ПАРАЛЕЛЬНО.
	 * Доти вибір біома був станом цієї сторінки — і стирав попередній заповідник.
	 *
	 * Правила — у `$lib/reserve/`, час — у контролері, тут лише показ і введення
	 * (SVELTE-CORE-v8 § 3.1). Сторінка не викликає `tick()` напряму й не рахує
	 * гроші: інакше та сама арифметика жила б у двох місцях, і мультиплеєр
	 * довелося б писати проти обох.
	 *
	 * Розкладка: карта на всю доступну висоту, знизу смуга кнопок, панелі
	 * висуваються поверх карти. Карта — це і є гра; списки й ціни приходять на
	 * вимогу й ідуть геть, коли не потрібні.
	 */
	interface Props {
		biome: ReserveBiome;
		/** Куди веде «назад»: на вибір ділянки, а не в головне меню. */
		backTo: RouteRest;
	}

	let { biome, backTo }: Props = $props();

	/*
	 * Біом читається РАЗ і назавжди — і це не недогляд, а умова задачі: партія
	 * привʼязана до ділянки на весь свій вік. Кожна ділянка живе за власною
	 * адресою, тож перехід у савану створює новий компонент замість того, щоб
	 * підмінити біом під уже наполовину відіграною лісовою партією.
	 */
	// svelte-ignore state_referenced_locally
	const game = new ReserveController(biome);
	const lang = $derived(languageFromParam(page.params.lang));

	let panel = $state<Panel | null>(null);

	/**
	 * Замовлення на вольєр, яке чекає МІСЦЯ.
	 *
	 * Розмір і якість гравець вибирає в панелі, а місце тицяє на карті — тому між
	 * двома кроками потрібен стан. `null` означає звичайний режим, де тап по
	 * вольєру вибирає мешканця.
	 */
	let pending = $state<{ size: number; quality: Quality } | null>(null);

	onMount(() => {
		const release = settings.claimHeader('reserve.title', () => goto(langPath(lang, backTo)));
		game.start();

		// Сейв, який не прочитався, каже про себе одразу: людина мусить знати, що
		// перед нею НОВА партія, а не та, яку вона лишила.
		if (game.restoreProblem) {
			toast.warn(
				game.restoreProblem.reason === 'from-the-future'
					? 'reserve.saveFuture'
					: 'reserve.saveBroken'
			);
		}

		const stop = game.startClock();
		return () => {
			stop();
			release();
		};
	});

	/**
	 * Кожна відмова пояснює причину.
	 *
	 * «Не можна» без пояснення читається як поламана кнопка. А тут кожна
	 * заборона — це рівно те, чого гра навчає: народжену в неволі не випустити,
	 * лева в тундру не привезти, у мінусі не розширитися.
	 */
	function command(cmd: ReserveCommand) {
		const result = game.run(cmd);
		if (!result.ok) toast.error(`reserve.reject.${result.reason}` as const);
	}

	/**
	 * Наліт: рішення ухвалене — і людина мусить дізнатися, чим воно скінчилося.
	 *
	 * Без цього тактика виглядала б однаково при будь-якому результаті: вікно
	 * закрилося, а що сталося з твариною й патрулем — шукай очима. Тому наслідок
	 * читається зі СТАНУ після ходу, а не з тактики: тактика — це намір, а
	 * повідомляти треба факт.
	 */
	function answerRaid(tactic: RaidTactic) {
		const targetId = game.state.raid?.animalId;
		const rangers = game.state.staff.ranger;

		const result = game.run({ type: 'raid', tactic });
		if (!result.ok) {
			toast.error(`reserve.reject.${result.reason}` as const);
			return;
		}

		if (game.state.animals.some((animal) => animal.id === targetId)) {
			toast.success('reserve.raid.saved');
		} else {
			toast.error('reserve.raid.lost');
		}
		if (game.state.staff.ranger < rangers) toast.warn('reserve.raid.injured');
	}

	/** Тап по землі в режимі розміщення: ставимо замовлений вольєр і виходимо. */
	function placeAt(cell: { x: number; z: number }) {
		if (!pending) return;
		const result = game.run({ type: 'build', ...pending, cell });
		if (!result.ok) {
			toast.error(`reserve.reject.${result.reason}` as const);
			return;
		}
		// Вийшло — режим знімається. Ставити десять вольєрів поспіль ніхто не
		// просив, а забутий режим ловив би наступні тапи.
		pending = null;
	}

	/** «Почати заново» перезапускає САМЕ цю ділянку, не чіпаючи інших. */
	function startOver() {
		game.reset(undefined, biome);
		panel = null;
		pending = null;
	}

	const here = $derived(residents(game.state));
	const wild = $derived(released(game.state));
	const free = $derived(freeEnclosures(game.state));
	const occupied = $derived(new Set(here.map((animal) => animal.enclosureId)));
</script>

<!--
	Власного `<title>` тут немає навмисно: заголовок вкладки належить кореневому
	layout, і жодна з решти сторінок його не перевизначає. Один виняток гірший за
	будь-яке з двох послідовних рішень.
-->
<div class="reserve-page" data-testid="reserve-page-container">
	<ReserveHud
		day={game.day}
		budget={game.state.budget}
		impact={game.state.impact}
		reputation={game.state.reputation}
		inReserve={here.length}
		inWild={wild.length}
		journal={game.state.journal}
		dayStart={game.state.dayStart}
		speed={game.speed}
		onSpeed={(value: Speed) => (game.speed = value)}
	/>

	{#if game.state.victory || game.state.gameOver}
		<ReserveOutcome
			victory={game.state.victory}
			impact={game.state.impact}
			day={game.day}
			onRestart={startOver}
		/>
	{:else}
		{#if game.state.subsidy}
			<p class="reserve-warning" role="status" data-testid="reserve-subsidy-status">
				{@html formatFont(t('reserve.subsidy'))}
			</p>
		{/if}

		<ReserveStage
			biome={game.state.biome}
			seed={game.state.seed}
			enclosures={game.state.enclosures}
			animals={here}
			selectedId={game.selectedId}
			onSelect={(id: number) => (game.selectedId = id)}
			placing={pending !== null}
			onGround={placeAt}
			showMinimap={!panel}
		/>

		<!-- Розпірка тримає смугу кнопок унизу, поки карта лежить під усім. -->
		<div class="reserve-fill"></div>

		<ReserveBar
			{panel}
			placing={pending !== null}
			onPanel={(id) => (panel = panel === id ? null : id)}
			onCampaign={() => command({ type: 'campaign' })}
			onCancel={() => (pending = null)}
			onRestart={startOver}
		/>

		{#if game.state.raid}
			<RaidModal
				target={game.state.animals.find((a) => a.id === game.state.raid?.animalId) ?? null}
				hasRanger={game.state.staff.ranger > 0}
				budget={game.state.budget}
				onTactic={answerRaid}
			/>
		{/if}

		{#if game.selected}
			<AnimalCard
				animal={game.selected}
				onCommand={command}
				onClose={() => (game.selectedId = null)}
			/>
		{/if}

		{#if panel}
			<ReserveSheet
				{panel}
				state={game.state}
				day={game.day}
				residents={here}
				released={wild}
				freeEnclosures={free}
				{occupied}
				selectedId={game.selectedId}
				onSelect={(id: number) => (game.selectedId = id)}
				onCommand={command}
				onPlace={(size: number, quality: Quality) => {
					pending = { size, quality };
					panel = null;
				}}
				onClose={() => (panel = null)}
			/>
		{/if}
	{/if}
</div>

<style>
	.reserve-page {
		position: relative;
		/*
		 * Власний контекст накладання. Без нього карта з відʼємним `z-index` поїхала б
		 * не за вміст сторінки, а за тло всього сайту — і зникла б.
		 */
		isolation: isolate;
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: var(--space-sm);
		/*
		 * На всю ширину, без `max-width`. Карта — це і є гра, і обрізати її
		 * колонкою на 1100px означало б залишити третину екрана тлом.
		 */
		width: 100%;
		padding: 0 var(--space-sm) var(--space-sm);
	}

	.reserve-fill {
		flex: 1;
		/* Порожня розпірка не має ловити жести: вони належать карті під нею. */
		pointer-events: none;
	}

	.reserve-warning {
		margin: 0;
		padding: var(--space-sm);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-error), transparent 85%);
	}
</style>
