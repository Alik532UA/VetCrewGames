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
		onRole: (role: Role) => void;
		onStart: () => void;
	}

	let { code, members, online, me, amHost, myRole, onRole, onStart }: Props = $props();

	const players = $derived(members.filter((member) => member.role === 'player'));
</script>

<div class="lobby">
	<p class="lobby__code text-panel">
		{@html formatFont(t('pairs.roomCode'))}:
		<b class="lobby__value" data-testid="pairs-room-code-value">{code}</b>
	</p>

	<ul class="lobby__list text-panel" data-testid="pairs-members-list">
		{#each members as member (member.uid)}
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
