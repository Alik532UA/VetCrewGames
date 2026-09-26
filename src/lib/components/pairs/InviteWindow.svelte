<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import IdentityRow from './IdentityRow.svelte';

	/**
	 * ВАС ЗАПРОСИЛИ — коротке вікно перед кімнатою для того, хто відкрив посилання чи
	 * QR-код (рішення автора 2026-09-26). Логіка — «кого показувати, кого пускати
	 * самого» — у `controllers/roomInvite.svelte.ts`; тут лише підпис гравця й дві дороги.
	 *
	 * Той самий рядок «Хто я», що в формі входу (`IdentityRow`), — з однією різницею:
	 * кімната вже є, тож пари аватарок, які в ній тримають інші, тут не вибрати. Якщо
	 * саме вашу вже взяли, про це каже рядок під ним: зайти можна й так — тоді дістанеться
	 * вільна (`utils/roomAvatars`), — але людина має право знати це до входу.
	 */
	interface Props {
		code: string;
		/** Імʼя гравця. Двобічне. */
		name: string;
		/** Прапор гравця. Двобічне. */
		country: string;
		/** Аватарка; порожньо — не вибирав. */
		avatar: string;
		/** Пари, які вже тримають у кімнаті (пара → імʼя). */
		taken: ReadonlyMap<string, string>;
		/** Поки триває вхід, «Зайти» не приймає повторних натискань. */
		busy: boolean;
		onAvatar: (avatar: string) => void;
		onRandomName: () => void;
		onJoin: () => void;
		onBack: () => void;
	}

	let {
		code,
		name = $bindable(),
		country = $bindable(),
		avatar,
		taken,
		busy,
		onAvatar,
		onRandomName,
		onJoin,
		onBack
	}: Props = $props();

	const mineTaken = $derived(avatar !== '' && taken.has(avatar));
</script>

<section class="invite" data-testid="room-invite-panel">
	<h2 class="invite__title">
		{@html formatFont(t('pairs.inviteTitle'))}
		<b class="invite__code" data-testid="room-invite-code-value">{code}</b>
	</h2>
	<p class="invite__hint">{@html formatFont(t('pairs.inviteHint'))}</p>

	<IdentityRow bind:name bind:country {avatar} {onAvatar} {onRandomName} {taken} />

	{#if mineTaken}
		<p class="invite__note" role="status" data-testid="room-invite-avatar-taken-text">
			{@html formatFont(t('pairs.inviteAvatarTaken'))}
		</p>
	{/if}

	<button
		type="button"
		class="btn-primary invite__join"
		onclick={onJoin}
		aria-disabled={busy}
		data-testid="room-invite-join-btn"
	>
		{@html formatFont(t('pairs.inviteJoin'))}
	</button>
	<button type="button" class="invite__back" onclick={onBack} data-testid="room-invite-back-btn">
		{@html formatFont(t('pairs.inviteBack'))}
	</button>
</section>

<style>
	/* Та сама панель, що в блоків форми входу (`.gate__panel`), — одна ширина на телефон. */
	.invite {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		width: min(26rem, 100%);
		padding: var(--space-md);
		border-radius: var(--radius-md);
		background: var(--color-bg-panel);
		box-shadow: var(--shadow-card);
		box-sizing: border-box;
	}

	.invite__title {
		margin: 0;
		font-size: var(--font-size-lg);
		color: var(--color-text-on-panel);
	}

	.invite__code {
		letter-spacing: 0.1em;
	}

	/* Підказка приглушена КЕГЛЕМ, а не прозорістю — та сама причина, що `.gate__hint`. */
	.invite__hint,
	.invite__note {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-on-panel);
	}

	.invite__note {
		font-weight: var(--font-weight-bold);
	}

	.invite__join {
		align-self: center;
	}

	/*
	 * Друга дорога — тихіша за першу: рамка без заливки. 44px — власний стандарт
	 * сенсорної цілі (ACCESSIBILITY-v8 § 8).
	 */
	.invite__back {
		align-self: center;
		min-height: 44px;
		padding: 0 var(--space-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: none;
		color: var(--color-text-on-panel);
		font: inherit;
		cursor: pointer;
	}

	@media (hover: hover) {
		.invite__back:hover {
			background: color-mix(in srgb, var(--color-text), transparent 90%);
		}
	}
</style>
