<script lang="ts">
	import HabitatRound from '$lib/components/HabitatRound.svelte';
</script>

<!--
	Окрема адреса, а не стан усередині однієї: підрежим тепер можна надіслати
	посиланням, і пошуковик бачить дві сторінки з різним вмістом замість однієї.
	Уся гра — у `HabitatRound`; тут лишається сам факт «це континенти».
-->
<HabitatRound mode="continents" />
