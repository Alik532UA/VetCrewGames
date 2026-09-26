<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import type { ReloadReason } from '$lib/controllers/reloadAdvice.svelte';

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
	 * `reload` — СТОРІНКУ ТРЕБА ОНОВИТИ (`RoomSession.reload`): правила бази новіші
	 * за неї (звʼязок є, а ходи не проходять) або на сервері вже інша збірка (зайти
	 * в кімнату з цієї вкладки не вийде). Це важливіше за обрив і показується
	 * одразу, разом із кнопкою: оновлена сторінка повертається в ту саму кімнату за
	 * адресою.
	 *
	 * `stranded` — ВЕСТИ КІМНАТУ НІКОМУ (`RoomSession.stranded`, шостий аудит, S1):
	 * господаря немає, а з присутніх ведення не візьме ніхто. Дві дороги — нова кімната
	 * й вихід; найслабше з трьох повідомлень, бо обрив і застаріла сторінка пояснюють
	 * те саме «ніхто не веде» точніше.
	 */
	let {
		lost,
		reload = null,
		stranded = false,
		onLeave,
		onNewRoom
	}: {
		lost: boolean;
		reload?: ReloadReason | null;
		stranded?: boolean;
		onLeave?: () => void;
		onNewRoom?: () => void;
	} = $props();

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

	/**
	 * ЩО САМЕ КАЖЕ СМУГА — один стан, і порядок у ньому один: застаріла сторінка, тоді
	 * обрив, тоді «вести нікому». Доти текст і кнопки мали кожен свій ланцюжок умов, і
	 * пріоритет між ними тримався збігом (шостий аудит).
	 */
	const banner = $derived(reload ?? (shown ? 'offline' : stranded ? 'noLead' : null));
</script>

<div class="net-lost" class:text-panel={banner !== null}>
	<p class="net-lost__text" role="status" data-testid="net-lost-text">
		{#if banner === 'rules'}{@html formatFont(
				t('pairs.rulesChanged')
			)}{:else if banner === 'build'}{@html formatFont(
				t('pairs.newBuild')
			)}{:else if banner === 'offline'}{@html formatFont(
				t('pairs.offline')
			)}{:else if banner === 'noLead'}{@html formatFont(t('pairs.noLead'))}{/if}
	</p>
	{#if banner === 'rules' || banner === 'build'}
		<button
			type="button"
			class="btn-primary net-lost__reload"
			onclick={() => location.reload()}
			data-testid="room-reload-btn"
		>
			{@html formatFont(t('pairs.reload'))}
		</button>
	{:else if banner === 'noLead'}
		<div class="net-lost__actions">
			<button
				type="button"
				class="btn-primary"
				onclick={onNewRoom}
				data-testid="room-no-lead-new-btn"
			>
				{@html formatFont(t('pairs.createRoom'))}
			</button>
			<button
				type="button"
				class="net-lost__leave"
				onclick={onLeave}
				data-testid="room-no-lead-leave-btn"
			>
				{@html formatFont(t('pairs.leaveRoom'))}
			</button>
		</div>
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

	.net-lost__actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-sm);
	}

	/* Друга дорога — тихіша за першу: той самий вигляд, що в «іншої гри» над підсумком. */
	.net-lost__leave {
		min-height: 44px;
		padding: 0 var(--space-md);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
</style>
