<script lang="ts">
	import { t, td, formatFont } from '$lib/i18n';
	import { STRESS_BLOCKS_RELEASE } from '$lib/reserve/constants';
	import { speciesById } from '$lib/reserve/species';
	import { unmetNeeds } from '$lib/reserve/modules';
	import type { Animal, Enclosure, ReserveCommand } from '$lib/reserve/types';
	import MapCard from './MapCard.svelte';

	/**
	 * Картка мешканця: хто це, звідки він, як одужує, чи можна випустити.
	 *
	 * У заголовку тепер ВИД, а не походження. Доти там стояло «Забрати з біди», і
	 * картка не відповідала на перше питання, яке виникає в гравця: кого я тицьнув.
	 * Відколи на карті стоять силуети, а не однакові капсули, назва виду — єдиний
	 * спосіб звірити те, що видно, з тим, що написано.
	 *
	 * Кнопка випуску не ховається, коли випустити не можна. Заборона — це і є
	 * урок гри: народжену в неволі не повернути, і людина має ПОБАЧИТИ, що така
	 * тварина лишиться назавжди, а не просто не знайти кнопки.
	 */
	interface Props {
		animal: Animal;
		/** Вольєр, у якому він живе; `null` — уже на волі. Звідси видно потреби. */
		home: Enclosure | null;
		onCommand: (command: ReserveCommand) => void;
		/** Перейти до картки вольєра, у якому він живе. */
		onEnclosure: (enclosureId: number) => void;
		onClose: () => void;
	}

	let { animal, home, onCommand, onEnclosure, onClose }: Props = $props();

	const percent = (value: number) => `${Math.round(value * 100)}%`;
	const blocked = $derived(
		animal.stage !== 'healthy' || !animal.releasable || animal.stress > STRESS_BLOCKS_RELEASE
	);
	/** Назва виду зі спільного словника: другий список імен розійшовся б із першим. */
	const species = $derived(speciesById(animal.speciesId));
	const name = $derived(species?.nameKey);

	/**
	 * Чого цій тварині бракує в її вольєрі.
	 *
	 * Стоїть у КАРТЦІ ТВАРИНИ, а не лише в картці вольєра, і це не дублювання:
	 * гравець дивиться сюди, щоб зрозуміти, чому стрес не спадає. Відповідь «бо в
	 * лисиці немає нори» мусить бути там, де питання, — інакше її шукають у
	 * налаштуваннях доглядачів.
	 */
	const unmet = $derived(species && home ? unmetNeeds(species.needs, home) : []);
</script>

<MapCard
	title={name ? td(name) : t('reserve.animals')}
	id="card:animal"
	testid="reserve-animal-card"
	{onClose}
>
	<p class="card__from" data-testid="reserve-card-origin-text">
		{@html formatFont(t(`reserve.origin.${animal.origin}` as const))}
	</p>

	<p class="card__stage" data-testid="reserve-card-stage">
		{@html formatFont(t(`reserve.stage.${animal.stage}` as const))}
	</p>

	<dl class="card__bars">
		<dt>{@html formatFont(t('reserve.health'))}</dt>
		<dd>
			<progress value={animal.health} max="1" data-testid="reserve-card-health"></progress>
			<span>{percent(animal.health)}</span>
		</dd>
		<dt>{@html formatFont(t('reserve.stress'))}</dt>
		<dd>
			<progress value={animal.stress} max="1" data-testid="reserve-card-stress"></progress>
			<span>{percent(animal.stress)}</span>
		</dd>
	</dl>

	{#if unmet.length > 0}
		<p class="card__note" data-testid="reserve-card-unmet-text">
			{@html formatFont(t('reserve.needsHere'))}:
			{#each unmet as need, index (need)}{index > 0 ? ', ' : ''}{@html formatFont(
					t(`reserve.module.${need}` as const)
				)}{/each}
		</p>
	{/if}

	{#if !animal.releasable}
		<p class="card__note" data-testid="reserve-card-captive">
			{@html formatFont(t('reserve.captiveBorn'))}
		</p>
	{/if}

	{#if animal.stage !== 'released'}
		<!--
			Шлях до сусідньої картки — в один тап. Вибір один на двох вікон, тож без
			цієї кнопки дорога до міцності вольєра йшла б через тап по паркану, і ще
			треба здогадатися, що він клікабельний.
		-->
		<button
			type="button"
			class="chip"
			onclick={() => onEnclosure(animal.enclosureId)}
			data-testid="reserve-card-enclosure-btn"
		>
			{@html formatFont(t('reserve.enclosure'))}
			{animal.enclosureId}
		</button>

		<button
			type="button"
			class="btn-primary card__release"
			class:card__release--off={blocked}
			aria-disabled={blocked}
			onclick={() => onCommand({ type: 'release', animalId: animal.id })}
			data-testid="reserve-release-btn"
		>
			{@html formatFont(t('reserve.release'))}
		</button>
	{/if}
</MapCard>

<style>
	.card__from,
	.card__stage {
		margin: 0;
		opacity: 0.8;
	}

	.card__from {
		font-size: var(--font-size-sm);
	}

	.card__bars {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 4px var(--space-sm);
		align-items: center;
		margin: 0;
	}

	.card__bars dt {
		font-size: var(--font-size-sm);
		opacity: 0.75;
	}

	.card__bars dd {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
		margin: 0;
	}

	.card__bars progress {
		flex: 1;
		min-width: 0;
	}

	.card__note {
		margin: 0;
		color: var(--color-error);
		font-size: var(--font-size-sm);
	}

	.chip {
		min-height: 44px;
		padding: 0 var(--space-md);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.card__release {
		max-width: none;
	}

	/*
	 * Кнопка лишається КЛІКАБЕЛЬНОЮ: відмова пояснює причину тостом, а `disabled`
	 * тут лише `aria-disabled`. Саме тому підпис читається звичайним
	 * `--color-text`, а не приглушеним `--color-disabled-text`: звільнення
	 * WCAG 1.4.3 стосується НЕАКТИВНИХ елементів керування, і на цю кнопку воно
	 * не діє. Приглушена пара давала 1.77:1 у світлих темах і 2.20:1 у темній.
	 *
	 * «Недоступність» лишається видною сірим тлом і відсутністю тіні — тобто тим,
	 * що не коштує читності підпису.
	 */
	.card__release--off {
		background: var(--color-disabled);
		color: var(--color-text);
		box-shadow: none;
	}
</style>
