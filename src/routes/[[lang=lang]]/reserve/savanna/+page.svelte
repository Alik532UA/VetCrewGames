<script lang="ts">
	import ReserveGame from '$lib/components/reserve/ReserveGame.svelte';

	/**
	 * Ділянка в біомі «savanna» — окрема адреса й окреме збереження.
	 *
	 * Чотири такі обгортки замість одного маршруту з параметром: параметр дав би
	 * один route id на чотири адреси, і `routeRestFromId` перестав би їх
	 * відрізняти — а разом із ним canonical, hreflang і sitemap. Той самий
	 * висновок уже застосований до підрежимів «Де живем?».
	 */
</script>

<ReserveGame biome="savanna" backTo="reserve" />
