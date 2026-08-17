<script lang="ts">
	import { toast } from '$lib/controllers/toast.svelte';
	import type { ReserveController } from '$lib/controllers/reserve.svelte';
	import type { RaidTactic } from '$lib/reserve/types';
	import RaidModal from './RaidModal.svelte';

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
		game: ReserveController;
	}

	let { game }: Props = $props();

	function answer(tactic: RaidTactic) {
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
</script>

{#if game.state.raid}
	<RaidModal
		target={game.state.animals.find((a) => a.id === game.state.raid?.animalId) ?? null}
		hasRanger={game.state.staff.ranger > 0}
		budget={game.state.budget}
		onTactic={answer}
	/>
{/if}
