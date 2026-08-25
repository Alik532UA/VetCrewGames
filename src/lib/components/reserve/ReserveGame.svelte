<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { t, formatFont } from '$lib/i18n';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { toast } from '$lib/controllers/toast.svelte';
	import { loadReserveCareText } from '$lib/i18n/reserveCare';
	import { loadReserveText } from '$lib/i18n/reserve';
	import type { ReserveEvent } from '$lib/reserve/events';
	import { createMilestoneWatch } from '$lib/reserve/milestones.svelte';
	import { reserve, type Speed } from '$lib/controllers/reserve.svelte';
	import type { Quality } from '$lib/reserve/constants';
	import { reserveHalf } from '$lib/reserve/plot';
	import {
		freeEnclosures,
		populatedSites,
		released,
		residents,
		residentsAt
	} from '$lib/reserve/simulation';
	import type { ReserveCommand } from '$lib/reserve/types';
	import type { ReserveBiome } from '$lib/reserve/species';
	import type { RouteRest } from '$lib/i18n/routing';
	import ReserveHud from './ReserveHud.svelte';
	import ReserveStage from './ReserveStage.svelte';
	import ReserveOutcome from './ReserveOutcome.svelte';
	import ReserveSheet from './ReserveSheet.svelte';
	import MapSelection from './MapSelection.svelte';
	import ReserveRaid from './ReserveRaid.svelte';
	import CareChoice from './CareChoice.svelte';
	import { WAGES } from '$lib/reserve/constants';
	import DevPanel from './DevPanel.svelte';
	import { devPanel } from '$lib/services/devPanel.svelte';
	import { dev } from '$app/environment';
	import ReserveBar, { type Panel } from './ReserveBar.svelte';

	/**
	 * Одна ДІЛЯНКА фонду: земля під ногами й керування нею.
	 *
	 * Фонд один на всі чотири адреси — каса, шкали й годинник спільні, — а ця
	 * сторінка показує ту землю, яку назвав маршрут. Тому карта, вольєри й персонал
	 * тут місцеві, а показники в шапці — фондові: витрати савани з'їдають ліс, і
	 * бачити це треба з будь-якої ділянки.
	 *
	 * Правила — у `$lib/reserve/`, час — у контролері, тут лише показ і введення
	 * (SVELTE-CORE-v8 § 3.1). Сторінка не викликає `tick()` напряму й не рахує
	 * гроші: інакше та сама арифметика жила б у двох місцях, і мультиплеєр
	 * довелося б писати проти обох.
	 *
	 * Розкладка: карта на всю площу, керування поверх неї. Карта — це і є гра;
	 * списки й ціни приходять на вимогу й ідуть геть, коли не потрібні.
	 */
	interface Props {
		biome: ReserveBiome;
		/** Куди веде «назад»: на вибір ділянки, а не в головне меню. */
		backTo: RouteRest;
	}

	let { biome, backTo }: Props = $props();

	/** Фонд — синглтон: сторінка не заводить свою партію, вона в неї заходить. */
	const game = reserve;
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

	/**
	 * Розмір, з яким відкриється панель вольєрів: приходить із прийому тварини.
	 *
	 * Гравець уже вибрав вид, і рекомендований для нього розмір — саме те, що він
	 * збирався поставити. Пропонувати вибрати число, яке гра щойно назвала, було б
	 * перекладанням своєї роботи на нього.
	 */
	let buildSize = $state<number | undefined>(undefined);

	/**
	 * Над якою точкою екрана спливе панель.
	 *
	 * Приходить із кнопки, що її відкрила. `null` — коли кнопки не було: до вольєрів
	 * можна потрапити з попередження в прийомі тварини, і прив'язувати вікно до
	 * кнопки, якої гравець не тиснув, було б брехнею про причину.
	 */
	let anchorX = $state<number | null>(null);

	/**
	 * Словник ВИБОРУ «найняти / зробити самому» — ЛІНИВИЙ (`i18n/reserveCare`).
	 *
	 * Тринадцять його рядків коштували кілобайт у чанку кореневого layout — того,
	 * що везе кожен відвідувач, — заради вікна, яке побачить лише той, хто дійшов
	 * до заповідника й лишився без працівника. Той самий прийом і та сама причина,
	 * що у вікторині (`i18n/quiz`) та в акаунті.
	 *
	 * У стані лежить САМ СЛОВНИК, а перекладач похідний: функція в `$state` не
	 * оновлювала екран — рядки лишалися ключами, хоч словник і приїхав.
	 */
	let care = $state<Record<string, string>>({});
	const careText = $derived((key: string) => care[key] ?? key);

	/** Віха — єдина нагорода, яку гра оголошує сама; логіка у `milestones.svelte.ts`. */
	const watchMilestones = createMilestoneWatch();
	$effect(() => void (watchMilestones(game.state.impact) && toast.success('reserve.milestone')));

	/**
	 * ПОДІЇ ДОБИ — СПОВІЩЕННЯМИ, і саме тут вони перекладаються.
	 *
	 * Скарга автора: «взяв тварину, а наступний день вона зникла, без сповіщення і
	 * без пояснень». Причин зникнення дві — хвороба й браконьєри, — і на екрані
	 * вони виглядали однаково: ніяк.
	 *
	 * Тон вибраний за наслідком, а не за подією: втрата тварини — помилка (сім
	 * секунд), голод і прострочене завдання — попередження (пʼять), одужання й
	 * зупинені браконьєри — успіх. Наліт, що ЩОЙНО почався, теж попередження, і
	 * поруч із ним відкривається вікно рішення: тост тут каже «подивись сюди», а
	 * не заміняє вікно.
	 *
	 * Мапа, а не `switch`: перелік подій закритий (`reserve/events.ts`), і
	 * компілятор перевіряє, що жодну не забуто. `switch` дав би те саме лише з
	 * `default: never`, і забути гілку в ньому легше.
	 */
	const NEWS: Record<ReserveEvent['kind'], () => void> = {
		death: () => toast.error('reserve.news.death'),
		healed: () => toast.success('reserve.news.healed'),
		raid: () => toast.warn('reserve.news.raid'),
		'raid-held': () => toast.success('reserve.news.raidHeld'),
		'raid-lost': () => toast.error('reserve.news.raidLost'),
		'raid-expired': () => toast.error('reserve.news.raidExpired'),
		hunger: () => toast.warn('reserve.news.hunger'),
		/*
		 * ПОТРЕБА ДІЇ — НЕ ТОСТ, а вікно вибору: `game.pending` уже стоїть, і час
		 * спинений. Тост поруч із вікном сказав би те саме двічі, а зникнувши, ще й
		 * забрав би на себе увагу з кнопок.
		 *
		 * Гілка потрібна попри це: мапа закрита за типом, і компілятор вимагає
		 * назвати кожну подію. Забути тут щось — червоне, а не тихе.
		 */
		'needs-care': () => {},
		'contract-offered': () => toast.info('reserve.news.contractOffered'),
		'contract-missed': () => toast.warn('reserve.news.contractMissed'),
		'offer-expired': () => toast.info('reserve.news.offerExpired'),
		collapse: () => toast.error('reserve.news.collapse')
	};

	onMount(() => {
		const release = settings.claimHeader('reserve.title', () => goto(langPath(lang, backTo)));
		/*
		 * Слухач ставиться ДО `start()`: партія може піднятися й одразу прожити добу,
		 * якщо гравець вернувся на сторінку з увімкненою швидкістю.
		 *
		 * Знімається у прибиранні — інакше друга сторінка ділянки додала б другий
		 * слухач до того самого синглтона, і кожна подія показувала б два тости.
		 */
		game.onEvent = (event) => NEWS[event.kind]();
		/*
		 * РЯДКИ ЗАПОВІДНИКА ДОВАНТАЖУЮТЬСЯ ТУТ — і це найбільший виніс у проєкті.
		 *
		 * Їх 14,88 КБ gzip на чотири мови, і доти вони їхали в чанку кореневого
		 * layout кожному відвідувачеві, зокрема тому, хто зайшов у вікторину й до
		 * заповідника не дійде ніколи (`i18n/reserve/index.ts`).
		 *
		 * До приїзду чанку `t()` віддає ключ. Видно це не буває: сцена в цей час
		 * показує власний екран завантаження, а він приходить із того самого чанку
		 * сторінки, що й ця розмітка.
		 */
		void loadReserveText(settings.locale);
		void loadReserveCareText(settings.locale).then((loaded) => (care = loaded));
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
			game.onEvent = null;
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
		const result = game.run(cmd, biome);
		if (!result.ok) toast.error(`reserve.reject.${result.reason}` as const);
	}

	/** Тап по землі в режимі розміщення: ставимо замовлений вольєр і виходимо. */
	function placeAt(cell: { x: number; z: number }) {
		if (!pending) return;
		const result = game.run({ type: 'build', ...pending, cell }, biome);
		if (!result.ok) {
			toast.error(`reserve.reject.${result.reason}` as const);
			return;
		}
		// Вийшло — режим знімається. Ставити десять вольєрів поспіль ніхто не
		// просив, а забутий режим ловив би наступні тапи.
		pending = null;
	}

	/** «Почати заново» після кінця партії: фонд один, тож і новий він один. */
	function startOver() {
		game.reset();
		panel = null;
		pending = null;
	}

	/** Мешканці ЦІЄЇ землі: їх малює сцена й показує список. */
	const here = $derived(residentsAt(game.state, biome));
	/** А ці два — по всьому фонду: показники спільні, отже й лічильники. */
	const inReserve = $derived(residents(game.state).length);
	const wild = $derived(released(game.state));
	const free = $derived(freeEnclosures(game.state, biome));
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
		feed={game.state.feed}
		impact={game.state.impact}
		reputation={game.state.reputation}
		{inReserve}
		inWild={wild.length}
		manySites={populatedSites(game.state) > 1}
		journal={game.state.journal}
		todayNotes={game.state.today}
		dayStart={game.state.dayStart}
		speed={game.speed}
		onSpeed={(value: Speed) => (game.speed = value)}
	/>

	{#if game.state.gameOver}
		<ReserveOutcome impact={game.state.impact} day={game.day} onRestart={startOver} />
	{:else}
		{#if game.state.subsidy}
			<p class="reserve-warning" role="status" data-testid="reserve-subsidy-status">
				{@html formatFont(t('reserve.subsidy'))}
			</p>
		{/if}

		<ReserveStage
			plotHalf={reserveHalf(game.state.reputation)}
			{biome}
			seed={game.state.seed}
			enclosures={game.state.sites[biome].enclosures}
			animals={here}
			selectedId={game.selectedId}
			selectedEnclosureId={game.selectedEnclosureId}
			onSelect={(kind, id) =>
				kind === 'animal' ? game.selectAnimal(id) : game.selectEnclosure(id)}
			placingSize={pending?.size ?? null}
			onGround={placeAt}
			showMinimap={!panel}
		/>

		<!-- Розпірка тримає смугу кнопок унизу, поки карта лежить під усім. -->
		<div class="reserve-fill"></div>

		<ReserveBar
			{panel}
			placing={pending !== null}
			onPanel={(id, x) => {
				anchorX = x;
				panel = panel === id ? null : id;
			}}
			onCampaign={() => command({ type: 'campaign' })}
			onCancel={() => (pending = null)}
		/>

		<!-- Службове меню. У продакшні `dev` — false, і гілки в збірці не лишається. -->
		{#if dev && devPanel.open}
			<DevPanel {game} at={biome} />
		{/if}

		<ReserveRaid {game} {careText} />

		<!--
			ВИБІР, КОЛИ ПРАЦІВНИКА НЕМА. Час уже спинений контролером, тож вікно не
			мусить нічого спиняти саме — воно лише збирає рішення.

			Модальне тло тут те саме, що в нальоту (`RaidModal`): обидва питання
			однакової ваги — доба не йде, поки на них не відповіли.
		-->
		{#if game.pending}
			{@const need = game.pending}
			<div class="care-backdrop" aria-hidden="true"></div>
			<div class="care-window" role="alertdialog" aria-modal="true">
				<CareChoice
					text={careText}
					{need}
					canHire={game.state.budget >= WAGES[need.role]}
					onhire={() => {
						/*
						 * Найм — звичайний хід, тож іде через `command`: він і в журнал
						 * запише, і відмову покаже, якщо грошей не хопило.
						 */
						command({ type: 'hire', role: need.role });
						game.answer('hired');
					}}
					onself={(ok) => {
						command({ type: 'self-care', role: need.role, animalId: need.animalId, ok });
						/*
						 * `say`, а не `success`/`warn` із ключем: ці два рядки живуть у
						 * лінивому словнику, і `TranslationKey` їх не знає за побудовою.
						 */
						toast.say(
							ok ? 'success' : 'warn',
							careText(ok ? 'reserve.care.done' : 'reserve.care.failed')
						);
						game.answer('self');
					}}
					onignore={() => game.answer('ignored')}
				/>
			</div>
		{/if}

		<MapSelection
			{game}
			residents={here}
			enclosures={game.state.sites[biome].enclosures}
			onCommand={command}
		/>

		{#if panel}
			<ReserveSheet
				{panel}
				{anchorX}
				at={biome}
				state={game.state}
				day={game.day}
				residents={here}
				released={wild}
				freeEnclosures={free}
				{occupied}
				selectedId={game.selectedId}
				onSelect={(id: number) => game.selectAnimal(id)}
				onCommand={command}
				{buildSize}
				onBuildFor={(size: number) => {
					buildSize = size;
					panel = 'enclosures';
					anchorX = null;
				}}
				onPlace={(size: number, quality: Quality) => {
					pending = { size, quality };
					panel = null;
					buildSize = undefined;
				}}
				onClose={() => (panel = null)}
			/>
		{/if}
	{/if}
</div>

<style>
	/*
	 * Вікно вибору — та сама форма, що в нальоту: тло, центр, межа й тінь. Дві
	 * копії правил тут навмисно: `RaidModal` тримає ще й перетягування за
	 * заголовок, і зводити їх в один компонент означало б тягнути ту механіку в
	 * вікно, якому вона не потрібна.
	 */
	.care-backdrop {
		position: fixed;
		inset: 0;
		z-index: 40;
		background: rgb(0 0 0 / 60%);
	}

	.care-window {
		position: fixed;
		top: 50%;
		left: 50%;
		z-index: 41;
		/*
		 * 46rem, а не 26: усередину може стати дошка міні-гри, а «Де живем?» показує
		 * дев'ять природних зон у ряд — на 26rem їхні підписи налазять один на одного
		 * (заміряно в браузері). Сам вибір при цьому лишається вузьким стовпчиком:
		 * його обмежує `.care__choice`.
		 */
		width: min(46rem, calc(100% - 2 * var(--space-md)));
		max-height: 85dvh;
		padding: var(--space-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-bg-panel);
		box-shadow: 0 10px 40px rgb(0 0 0 / 55%);
		transform: translate(-50%, -50%);
		overflow-y: auto;
	}

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
		/*
		 * Відступ ЗВЕРХУ теж потрібен: показники прилипали до шапки сайту й читалися
		 * як її продовження. Знизу такий самий — смуга кнопок від нього й виглядає
		 * припасованою до вікна.
		 */
		padding: var(--space-sm);
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
