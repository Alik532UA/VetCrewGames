<script lang="ts">
	import { toast } from '$lib/controllers/toast.svelte';
	import type { ReserveController } from '$lib/controllers/reserve.svelte';
	import type { RaidTactic } from '$lib/reserve/types';
	import RaidModal from './RaidModal.svelte';
	import ReserveTrial from './ReserveTrial.svelte';

	/**
	 * Наліт браконьєрів: вікно з трьома рішеннями — і звіт про наслідок.
	 *
	 * Разом, бо це одна річ: тактика — це намір, а повідомляти треба ФАКТ. Наслідок
	 * читається зі стану ПІСЛЯ ходу, а не з натиснутої кнопки, і саме тому обидві
	 * половини мусять стояти поруч. Без звіту тактика виглядала б однаково при
	 * будь-якому результаті: вікно закрилося, а що сталося з твариною й патрулем —
	 * шукай очима.
	 */
	interface Props {
		/** Перекладач лінивого словника вибору — див. `RaidModal`. */
		careText: (key: string) => string;
		game: ReserveController;
	}

	let { game, careText }: Props = $props();

	/**
	 * ЧИ ЙДЕ ПЕРЕВІРКА «ВИЙТИ САМОМУ».
	 *
	 * Тактика `self` не має власної ймовірності: замість кидка справу вирішують
	 * пʼять раундів міні-гри з порогом 70% очок. Тому вона не подає хід одразу — вона
	 * заміняє вікно тактик перевіркою, а хід іде вже з її результатом.
	 */
	let trial = $state(false);

	function answer(tactic: RaidTactic, ok?: boolean) {
		const raid = game.state.raid;
		if (!raid) return;
		if (tactic === 'self' && ok === undefined) {
			trial = true;
			return;
		}
		const rangers = game.state.sites[raid.biome].staff.ranger;

		// Хід адресується тій ділянці, на яку прийшли, а не тій, де стоїть гравець.
		const result = game.run({ type: 'raid', tactic, ok }, raid.biome);
		if (!result.ok) {
			toast.error(`reserve.reject.${result.reason}` as const);
			return;
		}

		const site = game.state.sites[raid.biome];
		if (site.animals.some((animal) => animal.id === raid.animalId)) {
			toast.success('reserve.raid.saved');
		} else {
			toast.error('reserve.raid.lost');
		}
		if (site.staff.ranger < rangers) toast.warn('reserve.raid.injured');
		trial = false;
	}
</script>

{#if game.state.raid && trial}
	<!--
		ПЕРЕВІРКА ЗАМІСТЬ ВІКНА ТАКТИК, а не поверх нього: питання вже поставлене й
		відповідь вибрана, тож тримати список тактик під грою означало б показувати
		вибір, який уже зроблено.

		Відмова від перевірки вертає до тактик, а не втрачає тварину: людина могла
		натиснути «вийти самому», побачити гру й вирішити заплатити за дрон.
	-->
	<div class="raid-backdrop" aria-hidden="true"></div>
	<div class="raid-trial" role="alertdialog" aria-modal="true">
		<ReserveTrial ondone={(ok) => answer('self', ok)} oncancel={() => (trial = false)} />
	</div>
{:else if game.state.raid}
	<RaidModal
		target={game.state.sites[game.state.raid.biome].animals.find(
			(a) => a.id === game.state.raid?.animalId
		) ?? null}
		hasRanger={game.state.sites[game.state.raid.biome].staff.ranger > 0}
		budget={game.state.budget}
		{careText}
		onTactic={answer}
	/>
{/if}

<style>
	/* Те саме тло й та сама форма вікна, що в `RaidModal`: питання однієї ваги. */
	.raid-backdrop {
		position: fixed;
		inset: 0;
		z-index: 40;
		background: rgb(0 0 0 / 60%);
	}

	.raid-trial {
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
		border: 1px solid var(--color-error);
		border-radius: var(--radius-md);
		background: var(--color-bg-panel);
		box-shadow: 0 10px 40px rgb(0 0 0 / 55%);
		transform: translate(-50%, -50%);
		overflow-y: auto;
	}
</style>
