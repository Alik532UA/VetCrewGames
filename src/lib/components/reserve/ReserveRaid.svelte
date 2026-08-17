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
		const raid = game.state.raid;
		if (!raid) return;
		const rangers = game.state.sites[raid.biome].staff.ranger;

		// Хід адресується тій ділянці, на яку прийшли, а не тій, де стоїть гравець.
		const result = game.run({ type: 'raid', tactic }, raid.biome);
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
	}
</script>

{#if game.state.raid}
	<RaidModal
		target={game.state.sites[game.state.raid.biome].animals.find(
			(a) => a.id === game.state.raid?.animalId
		) ?? null}
		hasRanger={game.state.sites[game.state.raid.biome].staff.ranger > 0}
		budget={game.state.budget}
		onTactic={answer}
	/>
{/if}
