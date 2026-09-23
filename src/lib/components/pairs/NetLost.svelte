<script lang="ts">
	import { t, formatFont } from '$lib/i18n';

	/**
	 * СМУГА «НЕМАЄ ЗВʼЯЗКУ» — поки база не відповідає.
	 *
	 * Доти обрив мережі не показувався НІЯК (аудит 2026-09-23): тап без звʼязку
	 * виглядав звичайним, хід лягав у чергу SDK і міг доїхати тоді, коли він уже
	 * нічого не означав, а людина не знала, чому дошка стоїть. Тепер стан звʼязку
	 * приходить із самої бази (`.info/connected`, `net/presence.watchConnected`).
	 *
	 * НЕ З ПЕРШОЇ МИТІ: Firebase каже «немає звʼязку» й тоді, коли звʼязок лише
	 * встановлюється, і на кожен секундний збій смуга блимала б. Показується вона,
	 * коли стан ТРИМАЄТЬСЯ `DELAY_MS`.
	 *
	 * ЖИВА ОБЛАСТЬ ІСНУЄ ЗАВЖДИ, міняється лише текст: скрінрідер надійно оголошує
	 * зміну вмісту наявного `role="status"`, а не появу нового елемента.
	 */
	let { lost }: { lost: boolean } = $props();

	const DELAY_MS = 1500;

	let shown = $state(false);

	$effect(() => {
		if (!lost) {
			shown = false;
			return;
		}
		const timer = setTimeout(() => (shown = true), DELAY_MS);
		return () => clearTimeout(timer);
	});
</script>

<p class="net-lost" class:text-panel={shown} role="status" data-testid="net-lost-text">
	{#if shown}{@html formatFont(t('pairs.offline'))}{/if}
</p>

<style>
	.net-lost {
		margin: 0;
		font-weight: var(--font-weight-bold);
		text-align: center;
	}
</style>
