<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { t } from '$lib/i18n';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { toast } from '$lib/controllers/toast.svelte';
	import { ReserveController, type Speed } from '$lib/controllers/reserve.svelte';
	import type { ReserveCommand } from '$lib/reserve/types';
	import ReserveHud from '$lib/components/reserve/ReserveHud.svelte';
	import ReserveActions from '$lib/components/reserve/ReserveActions.svelte';
	import AnimalList from '$lib/components/reserve/AnimalList.svelte';
	import AnimalCard from '$lib/components/reserve/AnimalCard.svelte';

	/**
	 * Заповідник: єдина гра проєкту, що триває, а не складається з раундів.
	 *
	 * Правила — у `$lib/reserve/`, час — у контролері, тут лише показ і введення
	 * (SVELTE-CORE-v8 § 3.1). Сторінка не викликає `tick()` напряму й не рахує
	 * гроші: інакше та сама арифметика жила б у двох місцях, і мультиплеєр
	 * довелося б писати проти обох.
	 */
	const game = new ReserveController();
	const lang = $derived(languageFromParam(page.params.lang));

	/**
	 * Сцена приходить `import()`-ом, і саме тому вона не в цьому файлі.
	 *
	 * `three` важить більше, ніж увесь інший JS сайту разом. Статичний імпорт
	 * поклав би його в чанк маршруту, а звідти — у граф, який рахує `check-build`
	 * як вагу сторінки. Динамічний лишає його окремим файлом, який завантажує
	 * лише той, хто в заповідник справді зайшов.
	 *
	 * Тип — `typeof ReserveScene` через `import type`: він зникає при збірці й
	 * розділення чанків не зачіпає, зате `svelte-check` бачить пропси.
	 */
	let Scene = $state<typeof import('$lib/components/reserve/ReserveScene.svelte').default | null>(
		null
	);

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

		// Сцена не блокує гру: якщо рушій не завантажиться, лишається список
		// мешканців, і заповідником усе одно можна керувати.
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
	 * у мінусі не розширитися.
	 */
	function command(cmd: ReserveCommand) {
		const result = game.run(cmd);
		if (!result.ok) toast.error(`reserve.reject.${result.reason}` as const);
	}

	function setSpeed(speed: Speed) {
		game.speed = speed;
	}

	function startOver() {
		game.reset();
		game.speed = 1;
	}
</script>

<!--
	Власного `<title>` тут немає навмисно. Заголовок вкладки належить кореневому
	layout, і жодна з дванадцяти інших сторінок його не перевизначає. Один
	виняток гірший за будь-яке з двох послідовних рішень: або заголовки має
	КОЖНА сторінка (і це окрема робота — з hreflang, sitemap і чотирма мовами),
	або жодна.

	Сторінка НЕ масштабується `fitToViewport`, на відміну від ігор-раундів. Там
	зменшення рятує від прокрутки, бо весь раунд мусить бути видний одночасно.
	Тут вміст росте з партією — двадцять мешканців на екран не влізуть за жодного
	масштабу, — і стиснуте до нечитабельного число бюджету було б гіршим за
	звичайну вертикальну прокрутку.
-->
<div class="reserve-page" data-testid="reserve-page-container">
	<ReserveHud
		day={game.day}
		budget={game.state.budget}
		impact={game.state.impact}
		speed={game.speed}
		onSpeed={setSpeed}
	/>

	{#if game.state.gameOver}
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

		{#if Scene}
			<Scene
				animals={game.state.animals}
				selectedId={game.selectedId}
				onSelect={(id) => (game.selectedId = id)}
			/>
		{/if}

		<ReserveActions staff={game.state.staff} subsidy={game.state.subsidy} onCommand={command} />

		<AnimalList
			animals={game.state.animals}
			selectedId={game.selectedId}
			onSelect={(id) => (game.selectedId = id)}
		/>

		{#if game.selected}
			<AnimalCard
				animal={game.selected}
				onCommand={command}
				onClose={() => (game.selectedId = null)}
			/>
		{/if}
	{/if}
</div>

<style>
	.reserve-page {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: var(--space-md);
		width: 95%;
		max-width: 900px;
		margin: 0 auto;
		padding-bottom: var(--space-md);
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
</style>
