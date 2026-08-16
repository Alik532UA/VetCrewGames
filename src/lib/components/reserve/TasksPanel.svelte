<script lang="ts">
	import { t } from '$lib/i18n';
	import ContractsBlock from './ContractsBlock.svelte';
	import type { ReserveCommand, ReserveState } from '$lib/reserve/types';

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

	const goals = $derived([
		{ id: 'build', key: 'reserve.goal.build' as const, done: state.enclosures.length > 0 },
		{ id: 'vet', key: 'reserve.goal.vet' as const, done: state.staff.vet > 0 },
		{ id: 'keeper', key: 'reserve.goal.keeper' as const, done: state.staff.keeper > 0 },
		{ id: 'take', key: 'reserve.goal.take' as const, done: state.animals.length > 0 },
		{
			id: 'heal',
			key: 'reserve.goal.heal' as const,
			done: state.animals.some((a) => a.stage !== 'recovering')
		},
		{
			id: 'release',
			key: 'reserve.goal.release' as const,
			done: state.animals.some((a) => a.stage === 'released')
		}
	]);

	const left = $derived(goals.filter((goal) => !goal.done));
</script>

<ContractsBlock {state} {day} {onCommand} />

<h4 class="section">{t('reserve.goals')}</h4>

{#if left.length === 0}
	<p class="done-all" data-testid="reserve-no-tasks-text">{t('reserve.noTasks')}</p>
{/if}

<ul class="goals">
	{#each goals as goal (goal.id)}
		<li class="goal" class:goal--done={goal.done} data-testid="reserve-goal-{goal.id}-item">
			<span class="goal__mark" aria-hidden="true">{goal.done ? '✓' : '○'}</span>
			<span>{t(goal.key)}</span>
			{#if goal.done}
				<span class="goal__done">{t('reserve.taskDone')}</span>
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
