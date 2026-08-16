<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { t } from '$lib/i18n';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { toast } from '$lib/controllers/toast.svelte';
	import { ReserveController, type Speed } from '$lib/controllers/reserve.svelte';
	import { effectiveQuality, freeEnclosures, released, residents } from '$lib/reserve/simulation';
	import type { ReserveCommand } from '$lib/reserve/types';
	import type { ReserveBiome } from '$lib/reserve/species';
	import ReserveHud from '$lib/components/reserve/ReserveHud.svelte';
	import AnimalsPanel from '$lib/components/reserve/AnimalsPanel.svelte';
	import EnclosurePanel from '$lib/components/reserve/EnclosurePanel.svelte';
	import StaffPanel from '$lib/components/reserve/StaffPanel.svelte';
	import AnimalCard from '$lib/components/reserve/AnimalCard.svelte';
	import BottomSheet from '$lib/components/reserve/BottomSheet.svelte';
	import BiomePicker from '$lib/components/reserve/BiomePicker.svelte';
	import TasksPanel from '$lib/components/reserve/TasksPanel.svelte';

	/**
	 * Заповідник: єдина гра проєкту, що триває, а не складається з раундів.
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
	const game = new ReserveController();
	const lang = $derived(languageFromParam(page.params.lang));

	/**
	 * Сцена приходить `import()`-ом, і саме тому вона не в цьому файлі.
	 *
	 * `three` важить більше, ніж увесь інший JS сайту разом. Статичний імпорт
	 * поклав би його в чанк маршруту; динамічний лишає окремим файлом, який
	 * завантажує лише той, хто в заповідник справді зайшов.
	 */
	let Scene = $state<typeof import('$lib/components/reserve/ReserveScene.svelte').default | null>(
		null
	);

	type Panel = 'animals' | 'enclosures' | 'staff' | 'tasks';
	let panel = $state<Panel | null>(null);

	/** Партія ще не почалася: спершу треба обрати біом. */
	let choosing = $state(false);

	onMount(() => {
		const release = settings.claimHeader('reserve.title', () => goto(langPath(lang, '')));
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
		// Порожній заповідник без жодного ходу — це перший запуск: питаємо біом.
		choosing = game.isFresh;

		import('$lib/components/reserve/ReserveScene.svelte').then((module) => {
			Scene = module.default;
		});

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

	function pickBiome(biome: ReserveBiome) {
		game.reset(undefined, biome);
		choosing = false;
	}

	function startOver() {
		choosing = true;
		panel = null;
	}

	const here = $derived(residents(game.state));
	const wild = $derived(released(game.state));
	const free = $derived(freeEnclosures(game.state));
	const occupied = $derived(new Set(here.map((animal) => animal.enclosureId)));

	const BUTTONS: Array<{
		id: Panel;
		key: 'reserve.animals' | 'reserve.enclosures' | 'reserve.staff' | 'reserve.tasks';
	}> = [
		{ id: 'animals', key: 'reserve.animals' },
		{ id: 'enclosures', key: 'reserve.enclosures' },
		{ id: 'staff', key: 'reserve.staff' },
		{ id: 'tasks', key: 'reserve.tasks' }
	];

	const PANEL_TITLE: Record<
		Panel,
		'reserve.animals' | 'reserve.enclosures' | 'reserve.staff' | 'reserve.tasks'
	> = {
		animals: 'reserve.animals',
		enclosures: 'reserve.enclosures',
		staff: 'reserve.staff',
		tasks: 'reserve.tasks'
	};
</script>

<!--
	Власного `<title>` тут немає навмисно: заголовок вкладки належить кореневому
	layout, і жодна з решти сторінок його не перевизначає. Один виняток гірший за
	будь-яке з двох послідовних рішень.
-->
<div class="reserve-page" data-testid="reserve-page-container">
	{#if choosing}
		<BiomePicker onPick={pickBiome} />
	{:else}
		<ReserveHud
			day={game.day}
			budget={game.state.budget}
			impact={game.state.impact}
			reputation={game.state.reputation}
			inReserve={here.length}
			inWild={wild.length}
			speed={game.speed}
			onSpeed={(value: Speed) => (game.speed = value)}
		/>

		{#if game.state.victory}
			<section class="reserve-over" data-testid="reserve-victory-section">
				<p>{t('reserve.victory')}</p>
				<p class="reserve-over__score">
					{t('reserve.impact')}: {game.state.impact} · {t('reserve.day')}: {game.day}
				</p>
				<button
					type="button"
					class="btn-primary"
					onclick={startOver}
					data-testid="reserve-victory-restart-btn">{t('reserve.newGame')}</button
				>
			</section>
		{:else if game.state.gameOver}
			<section class="reserve-over" data-testid="reserve-game-over-section">
				<p>{t('reserve.gameOver')}</p>
				<button
					type="button"
					class="btn-primary"
					onclick={startOver}
					data-testid="reserve-restart-btn">{t('reserve.newGame')}</button
				>
			</section>
		{:else}
			{#if game.state.subsidy}
				<p class="reserve-warning" role="status" data-testid="reserve-subsidy-status">
					{t('reserve.subsidy')}
				</p>
			{/if}

			<!-- Карта займає все, що лишилося: вона і є гра. -->
			<div class="reserve-map">
				{#if Scene}
					<Scene
						biome={game.state.biome}
						seed={game.state.seed}
						enclosures={game.state.enclosures}
						animals={here}
						selectedId={game.selectedId}
						onSelect={(id: number) => (game.selectedId = id)}
					/>
				{/if}
			</div>

			<nav class="reserve-bar" aria-label={t('reserve.title')}>
				{#each BUTTONS as item (item.id)}
					<button
						type="button"
						class="reserve-bar__btn"
						class:reserve-bar__btn--on={panel === item.id}
						aria-pressed={panel === item.id}
						onclick={() => (panel = panel === item.id ? null : item.id)}
						data-testid="reserve-panel-{item.id}-btn"
					>
						{t(item.key)}
					</button>
				{/each}
				<!--
					Кампанія — окрема кнопка просто на смузі, бо це ХІД, а не список:
					ховати її в панель означало б два кліки на дію, яку роблять щодня.
				-->
				<button
					type="button"
					class="reserve-bar__btn"
					title={t('reserve.campaignHint')}
					onclick={() => command({ type: 'campaign' })}
					data-testid="reserve-campaign-btn"
				>
					{t('reserve.campaign')}
				</button>
				<button
					type="button"
					class="reserve-bar__btn"
					onclick={startOver}
					data-testid="reserve-startover-btn"
				>
					{t('reserve.restart')}
				</button>
			</nav>

			{#if game.selected}
				<AnimalCard
					animal={game.selected}
					onCommand={command}
					onClose={() => (game.selectedId = null)}
				/>
			{/if}

			{#if panel}
				<BottomSheet title={t(PANEL_TITLE[panel])} onClose={() => (panel = null)}>
					{#if panel === 'animals'}
						<AnimalsPanel
							biome={game.state.biome}
							residents={here}
							released={wild}
							freeEnclosures={free}
							hasVet={game.state.staff.vet > 0}
							selectedId={game.selectedId}
							onSelect={(id: number) => (game.selectedId = id)}
							onCommand={command}
						/>
					{:else if panel === 'enclosures'}
						<EnclosurePanel
							enclosures={game.state.enclosures}
							{occupied}
							effectiveQualityOf={effectiveQuality}
							onCommand={command}
						/>
					{:else if panel === 'staff'}
						<StaffPanel staff={game.state.staff} subsidy={game.state.subsidy} onCommand={command} />
					{:else}
						<TasksPanel state={game.state} />
					{/if}
				</BottomSheet>
			{/if}
		{/if}
	{/if}
</div>

<style>
	.reserve-page {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: var(--space-sm);
		width: 97%;
		max-width: 1100px;
		margin: 0 auto;
		padding-bottom: var(--space-sm);
	}

	/*
	 * Карта росте на все, що лишилося після шапки й смуги кнопок. `min-height`
	 * тут не для краси: без нього flex-дитина з полотном усередині стискається
	 * в нуль, і сцена зникає, не сказавши ні слова.
	 */
	.reserve-map {
		flex: 1;
		min-height: 220px;
	}

	.reserve-bar {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
	}

	.reserve-bar__btn {
		flex: 1 1 6rem;
		min-height: 44px;
		padding: 0 var(--space-sm);
		border-radius: var(--radius-sm);
		background: var(--color-bg-panel);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.reserve-bar__btn--on {
		background: var(--color-accent);
		color: var(--color-text-on-accent);
	}

	.reserve-warning {
		margin: 0;
		padding: var(--space-sm);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-error), transparent 85%);
	}

	.reserve-over {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		align-items: center;
		padding: var(--space-lg) var(--space-md);
		border-radius: var(--radius-md);
		background: var(--color-bg-panel);
		text-align: center;
	}

	.reserve-over p {
		margin: 0;
	}

	.reserve-over__score {
		font-variant-numeric: tabular-nums;
		opacity: 0.8;
	}
</style>
