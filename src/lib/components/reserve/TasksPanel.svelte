<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import ContractsBlock from './ContractsBlock.svelte';
	import type { ReserveCommand, ReserveState } from '$lib/reserve/types';
	import { RESERVE_BIOMES } from '$lib/reserve/species';

	/**
	 * Навчальні цілі — те, що веде новачка за руку перших кілька днів.
	 *
	 * Виводяться ЗІ СТАНУ, а не зберігаються окремим списком: «побудовано
	 * вольєр» — це `enclosures.length > 0`, і другий, паралельний прапорець
	 * рано чи пізно розійшовся б із дійсністю. Заразом це означає, що цілі
	 * переживають будь-який сейв без жодної міграції.
	 *
	 * Контракти зі спонсорами — другий розділ тієї ж панелі, і стоять вони ВИЩЕ:
	 * у них є дедлайн, а в цілей немає. Те, що згорить, має бути видно першим.
	 */
	interface Props {
		state: ReserveState;
		day: number;
		onCommand: (command: ReserveCommand) => void;
	}

	let { state, day, onCommand }: Props = $props();

	/**
	 * Кроки зараховуються по ВСЬОМУ фонду.
	 *
	 * Це список «чого ти ще не робив у цій грі», а не «на цій землі»: побудувавши
	 * перший вольєр у лісі, гравець уже знає, як будувати, і повторювати підказку в
	 * савані означало б вважати його забудькуватим.
	 */
	const sites = $derived(RESERVE_BIOMES.map((biome) => state.sites[biome]));
	const herd = $derived(sites.flatMap((site) => site.animals));

	const goals = $derived([
		{
			id: 'build',
			key: 'reserve.goal.build' as const,
			done: sites.some((site) => site.enclosures.length > 0)
		},
		{
			id: 'vet',
			key: 'reserve.goal.vet' as const,
			done: sites.some((site) => site.staff.vet > 0)
		},
		{
			id: 'keeper',
			key: 'reserve.goal.keeper' as const,
			done: sites.some((site) => site.staff.keeper > 0)
		},
		{ id: 'take', key: 'reserve.goal.take' as const, done: herd.length > 0 },
		{
			id: 'heal',
			key: 'reserve.goal.heal' as const,
			done: herd.some((a) => a.stage !== 'recovering')
		},
		{
			id: 'release',
			key: 'reserve.goal.release' as const,
			done: herd.some((a) => a.stage === 'released')
		}
	]);

	const left = $derived(goals.filter((goal) => !goal.done));
</script>

<ContractsBlock {state} {day} {onCommand} />

<h4 class="section">{@html formatFont(t('reserve.goals'))}</h4>

{#if left.length === 0}
	<p class="done-all" data-testid="reserve-no-tasks-text">
		{@html formatFont(t('reserve.noTasks'))}
	</p>
{/if}

<ul class="goals">
	{#each goals as goal (goal.id)}
		<li class="goal" class:goal--done={goal.done} data-testid="reserve-goal-{goal.id}-item">
			<span class="goal__mark" aria-hidden="true">{goal.done ? '✓' : '○'}</span>
			<span>{@html formatFont(t(goal.key))}</span>
			{#if goal.done}
				<span class="goal__done">{@html formatFont(t('reserve.taskDone'))}</span>
			{/if}
		</li>
	{/each}
</ul>

<style>
	.goals {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.goal {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
		min-height: 44px;
		padding: var(--space-sm);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
	}

	/* Виконане не зникає: список має показувати ПРОЙДЕНИЙ шлях, а не лише борг. */
	.goal--done {
		opacity: 0.6;
	}

	.goal__mark {
		font-weight: var(--font-weight-bold);
	}

	.goal__done {
		margin-left: auto;
		font-size: var(--font-size-sm);
		color: var(--color-success);
	}

	.section {
		margin: var(--space-md) 0 var(--space-sm);
		font-size: var(--font-size-sm);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		opacity: 0.7;
	}

	.done-all {
		margin: 0 0 var(--space-md);
	}
</style>
