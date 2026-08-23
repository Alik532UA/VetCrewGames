<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import type { Member, Role } from '$lib/net/roomTypes';

	/**
	 * Лобі кімнати: код, склад, роль і кнопка «почати».
	 *
	 * Роль вибирається ДО початку партії й після нього вже не міняється: склад
	 * гравців входить у роздачу колоди, тож перехід із глядача в гравці посеред
	 * партії означав би нову роздачу — і стер би все, що всі запамʼятали.
	 */
	interface Props {
		code: string;
		members: Member[];
		online: string[];
		me: string;
		amHost: boolean;
		myRole: Role;
		/**
		 * Скільки секунд до автоматичного старту; `null` — відліку немає.
		 *
		 * Число приходить готовим, а не рахується тут: воно виводиться з СЕРВЕРНОЇ
		 * позначки в кімнаті, і саме тому в обох учасників однакове. Компонент його
		 * лише малює.
		 */
		countdownLeft: number | null;
		onRole: (role: Role) => void;
		onStart: () => void;
		/** Скасувати відлік. Є лише в господаря — правило бази інших і не пустить. */
		onCancelCountdown: () => void;
	}

	let {
		code,
		members,
		online,
		me,
		amHost,
		myRole,
		countdownLeft,
		onRole,
		onStart,
		onCancelCountdown
	}: Props = $props();

	const players = $derived(members.filter((member) => member.role === 'player'));
	/*
	 * Порядок у списку — за входом, а не за тим, як його віддала база (за алфавітом
	 * ключів). Черга ходів іде саме за входом, і список мусить показувати те саме,
	 * інакше «хто перший» читається з екрана неправильно.
	 */
	const shown = $derived([...members].sort((a, b) => a.order - b.order));
</script>

<div class="lobby">
	<p class="lobby__code text-panel">
		{@html formatFont(t('pairs.roomCode'))}:
		<b class="lobby__value" data-testid="pairs-room-code-value">{code}</b>
	</p>

	<ul class="lobby__list text-panel" data-testid="pairs-members-list">
		{#each shown as member (member.uid)}
			<li
				class="lobby__member"
				class:lobby__member--away={!online.includes(member.uid)}
				data-testid="pairs-member-{member.uid}-item"
			>
				{member.name}{member.uid === me ? ' •' : ''}
				<span class="lobby__role">
					{@html formatFont(
						t(member.role === 'player' ? 'pairs.rolePlayer' : 'pairs.roleSpectator')
					)}
				</span>
			</li>
		{/each}
	</ul>

	<div class="lobby__roles" role="group" aria-label={t('pairs.rolePlayer')}>
		{#each ['player', 'spectator'] as const as role (role)}
			<button
				type="button"
				class="chip"
				class:chip--on={myRole === role}
				aria-pressed={myRole === role}
				onclick={() => onRole(role)}
				data-testid="pairs-role-{role}-btn"
			>
				{@html formatFont(t(role === 'player' ? 'pairs.rolePlayer' : 'pairs.roleSpectator'))}
			</button>
		{/each}
	</div>

	<!--
		ВІДЛІК БАЧАТЬ ОБОЄ, і це головне в ньому.

		Той, хто зайшов другим, кнопки «Почати» не має зовсім, тож без цього рядка
		партія починалася б для нього раптово. Число тут те саме, що в господаря:
		воно виводиться з серверної позначки, а не з місцевого таймера.

		Скасувати може господар кнопкою; гість — перейшовши в глядачі, бо тоді
		гравців стає менше двох і відлік гасне сам. Тобто вихід є в обох, і жоден із
		них не потребує окремого права в базі.
	-->
	{#if countdownLeft !== null}
		<p class="lobby__countdown text-panel" data-testid="pairs-countdown-text">
			{@html formatFont(t('pairs.startingIn'))}
			<b class="lobby__seconds">{countdownLeft}{@html formatFont(t('pairs.seconds'))}</b>
		</p>
		{#if amHost}
			<button
				type="button"
				class="chip"
				onclick={onCancelCountdown}
				data-testid="pairs-cancel-countdown-btn"
			>
				{@html formatFont(t('pairs.cancelStart'))}
			</button>
		{/if}
	{/if}

	{#if amHost}
		<!--
			Починає лише господар, і кнопка не ховається, коли гравців бракує:
			заборона з причиною вчить, а зникла кнопка читається як поломка.
		-->
		<button
			type="button"
			class="btn-primary"
			onclick={onStart}
			data-testid="pairs-start-btn"
			aria-disabled={players.length < 2}
		>
			{@html formatFont(t('pairs.start'))}
		</button>
		{#if players.length < 2}
			<p class="lobby__hint text-panel" data-testid="pairs-need-players-text">
				{@html formatFont(t('pairs.needPlayers'))}
			</p>
		{/if}
	{:else}
		<p class="lobby__hint text-panel" data-testid="pairs-waiting-host-text">
			{@html formatFont(t('pairs.waitingHost'))}
		</p>
	{/if}
</div>

<style>
	.lobby {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-md);
		width: 100%;
		max-width: 26rem;
	}

	.lobby__code {
		margin: 0;
		font-size: var(--font-size-md);
	}

	.lobby__countdown {
		margin: 0;
		font-size: var(--font-size-md);
		color: var(--color-text);
	}

	/*
	 * Число рівної ширини: без `tabular-nums` рядок сіпається на кожній секунді,
	 * бо «5» і «1» у пропорційному шрифті різної ширини — а сіпається він рівно
	 * тоді, коли на нього дивляться.
	 */
	.lobby__seconds {
		font-variant-numeric: tabular-nums;
		color: var(--color-accent);
	}

	/* Код диктують уголос, тож він великий і з проміжками між літерами. */
	.lobby__value {
		font-size: var(--font-size-xl);
		letter-spacing: 0.25em;
	}

	.lobby__list {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		width: 100%;
		margin: 0;
		padding: var(--space-md);
		list-style: none;
	}

	.lobby__member {
		display: flex;
		gap: var(--space-sm);
		justify-content: space-between;
	}

	/* Звʼязок обірвався — не «вийшов»: людина могла заїхати в тунель. */
	.lobby__member--away {
		opacity: 0.5;
	}

	.lobby__role {
		font-size: var(--font-size-sm);
		opacity: 0.7;
	}

	.lobby__roles {
		display: flex;
		gap: var(--space-sm);
	}

	.chip {
		min-height: 44px;
		padding: 0 var(--space-md);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.chip--on {
		background: var(--color-accent);
		color: var(--color-text-on-accent);
	}

	.lobby__hint {
		margin: 0;
		font-size: var(--font-size-sm);
		opacity: 0.75;
		text-align: center;
	}
</style>
