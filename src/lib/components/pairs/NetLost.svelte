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
	 *
	 * `stale` — ПРАВИЛА БАЗИ НОВІШІ ЗА СТОРІНКУ (`RoomSession.rulesStale`): звʼязок
	 * є, а ходи не проходять. Це важливіше за обрив і показується одразу, разом із
	 * кнопкою: оновлена сторінка повертається в ту саму кімнату за адресою.
	 */
	let { lost, stale = false }: { lost: boolean; stale?: boolean } = $props();

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

<div class="net-lost" class:text-panel={shown || stale}>
	<p class="net-lost__text" role="status" data-testid="net-lost-text">
		{#if stale}{@html formatFont(t('pairs.rulesChanged'))}{:else if shown}{@html formatFont(
				t('pairs.offline')
			)}{/if}
	</p>
	{#if stale}
		<button
			type="button"
			class="btn-primary net-lost__reload"
			onclick={() => location.reload()}
			data-testid="room-reload-btn"
		>
			{@html formatFont(t('pairs.reload'))}
		</button>
	{/if}
</div>

<style>
	.net-lost {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-sm);
	}

	.net-lost__text {
		margin: 0;
		font-weight: var(--font-weight-bold);
		text-align: center;
	}

	/* Головна дія цього стану — інших на дошці однаково не буде. */
	.net-lost__reload {
		font-size: var(--font-size-md);
	}
</style>
