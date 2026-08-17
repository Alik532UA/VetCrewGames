<script lang="ts">
	import { formatFont } from '$lib/i18n';
	import { devPanel } from '$lib/services/devPanel.svelte';
	import { TICKS_PER_DAY } from '$lib/reserve/constants';
	import { dayOf } from '$lib/reserve/simulation';
	import { speciesOfBiome, type ReserveBiome } from '$lib/reserve/species';
	import type { ReserveController } from '$lib/controllers/reserve.svelte';

	/**
	 * Службове меню розробника: підкрутити показники, не граючи двадцять днів.
	 *
	 * Свідомо ОБХОДИТЬ `execute()` — і це єдине місце в проєкті, якому таке
	 * дозволено. Перевірити крах на тридцятий день, перемогу на десяти тисячах
	 * користі або наліт браконьєрів інакше означає прожити партію по-справжньому.
	 * Ціна названа прямо: тут можна зібрати стан, якого жодна команда не створила
	 * б, — наприклад мінусовий бюджет із порожнім заповідником. Саме тому меню
	 * існує тільки в `dev` і зникає зі збірки разом із прапорцем.
	 *
	 * Підписи НЕ перекладені: словник — це те, що бачить гравець, а цього меню
	 * гравець не побачить ніколи. Через `formatFont` вони все одно проходять, бо
	 * шрифт не має кириличної «і» незалежно від того, кому текст призначений.
	 */
	interface Props {
		game: ReserveController;
		/** Ділянка, чий штат і мешканців правимо: показники ж фондові. */
		at: ReserveBiome;
	}

	let { game, at }: Props = $props();

	const site = $derived(game.state.sites[at]);

	/**
	 * Показники як поля: читання зі стану, запис — прямо в нього.
	 *
	 * День рахується в тіках, тож поле переводить одне в одне: у меню зручно
	 * писати «12», а симуляція знає лише лічильник.
	 */
	const fields: Array<{
		id: string;
		label: string;
		get: () => number;
		set: (value: number) => void;
	}> = [
		{
			id: 'day',
			label: 'День',
			get: () => dayOf(game.state),
			set: (value) => (game.state.ticks = Math.max(0, value - 1) * TICKS_PER_DAY)
		},
		{
			id: 'budget',
			label: 'Бюджет',
			get: () => game.state.budget,
			set: (v) => (game.state.budget = v)
		},
		{
			id: 'impact',
			label: 'Користь планеті',
			get: () => game.state.impact,
			set: (v) => (game.state.impact = v)
		},
		{
			id: 'reputation',
			label: 'Репутація',
			get: () => game.state.reputation,
			set: (v) => (game.state.reputation = Math.min(100, Math.max(0, v)))
		},
		{
			id: 'vet',
			label: 'Ветеринари',
			get: () => site.staff.vet,
			set: (v) => (site.staff.vet = Math.max(0, v))
		},
		{
			id: 'keeper',
			label: 'Доглядачі',
			get: () => site.staff.keeper,
			set: (v) => (site.staff.keeper = Math.max(0, v))
		},
		{
			id: 'ranger',
			label: 'Рейнджери',
			get: () => site.staff.ranger,
			set: (v) => (site.staff.ranger = Math.max(0, v))
		}
	];

	function apply(set: (value: number) => void, raw: string) {
		const value = Number(raw);
		if (!Number.isFinite(value)) return;
		set(value);
		// Зберігаємо одразу: підкручений стан має пережити перезавантаження, інакше
		// половина сценаріїв, які тут перевіряються, зникає при F5.
		game.save();
	}

	/**
	 * Мешканці — не число, а список, тож замість поля тут дії.
	 *
	 * «У заповіднику» й «На волі» виводяться з тварин; вписати в них двійку
	 * означало б вигадати двох тварин без виду, вольєра й історії.
	 */
	function addResident() {
		const species = speciesOfBiome(at)[0];
		const free = site.enclosures.find(
			(e) => !site.animals.some((a) => a.enclosureId === e.id && a.stage !== 'released')
		);
		if (!species || !free) return;

		site.animals.push({
			id: game.state.nextAnimalId++,
			speciesId: species.id,
			origin: 'rescue',
			stage: 'recovering',
			enclosureId: free.id,
			recovery: 0,
			stress: 0,
			releasable: true,
			releasedOnDay: null
		});
		game.save();
	}

	function healAll() {
		for (const animal of site.animals) {
			if (animal.stage === 'recovering') {
				animal.stage = 'healthy';
				animal.recovery = 1;
				animal.stress = 0;
			}
		}
		game.save();
	}

	function callRaid() {
		const victim = site.animals.find((a) => a.stage !== 'released');
		if (!victim) return;
		game.state.raid = { animalId: victim.id, biome: at, day: dayOf(game.state) };
		game.save();
	}
</script>

<section class="dev" data-testid="reserve-dev-panel">
	<header class="dev__head">
		<b>{@html formatFont('Службове меню')}</b>
		<button type="button" onclick={() => devPanel.close()} data-testid="reserve-dev-close-btn"
			>×</button
		>
	</header>

	<div class="dev__grid">
		{#each fields as field (field.id)}
			<label class="dev__field">
				<span>{@html formatFont(field.label)}</span>
				<input
					type="number"
					value={field.get()}
					oninput={(event) => apply(field.set, event.currentTarget.value)}
					data-testid="reserve-dev-{field.id}-input"
				/>
			</label>
		{/each}
	</div>

	<div class="dev__row">
		<button type="button" onclick={addResident} data-testid="reserve-dev-add-animal-btn">
			{@html formatFont('+ мешканець')}
		</button>
		<button type="button" onclick={healAll} data-testid="reserve-dev-heal-btn">
			{@html formatFont('вилікувати всіх')}
		</button>
		<button type="button" onclick={callRaid} data-testid="reserve-dev-raid-btn">
			{@html formatFont('наліт')}
		</button>
	</div>

	<p class="dev__note">
		{@html formatFont('Записує стан напряму, обходячи правила. Тільки для розробки.')}
	</p>
</section>

<style>
	.dev {
		/*
		 * Ліворуч знизу: праворуч мінікарта, унизу смуга кнопок, а зверху показники.
		 * Меню розробника не має закривати саме те, що ним перевіряють.
		 */
		position: fixed;
		bottom: var(--space-sm);
		left: var(--space-sm);
		z-index: 50;
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		width: min(22rem, calc(100% - 2 * var(--space-sm)));
		max-height: 70dvh;
		padding: var(--space-sm);
		border: 1px dashed var(--color-accent);
		border-radius: var(--radius-sm);
		background: var(--color-bg-panel);
		box-shadow: 0 8px 32px rgb(0 0 0 / 45%);
		overflow-y: auto;
	}

	.dev__head {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
		justify-content: space-between;
	}

	.dev__grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: 4px var(--space-sm);
	}

	.dev__field {
		display: flex;
		gap: 4px;
		align-items: center;
		justify-content: space-between;
		font-size: var(--font-size-sm);
	}

	.dev__field input {
		width: 5.5rem;
		min-height: 32px;
		padding: 0 4px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: inherit;
		font: inherit;
		font-variant-numeric: tabular-nums;
	}

	.dev__row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
	}

	.dev__row button,
	.dev__head button {
		min-height: 32px;
		padding: 0 var(--space-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.dev__note {
		margin: 0;
		font-size: var(--font-size-sm);
		opacity: 0.6;
	}
</style>
