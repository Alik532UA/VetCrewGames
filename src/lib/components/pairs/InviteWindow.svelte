<script lang="ts">
	import { LogIn } from 'lucide-svelte';
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

<section class="invite fill fill-window" data-testid="room-invite-panel">
	<div class="invite__header">
		<h2 class="invite__title">{@html formatFont(t('pairs.inviteTitle'))}</h2>
		<div class="invite__code-wrap">
			<span class="invite__code-label">{@html formatFont(t('pairs.roomCode'))}:</span>
			<b class="invite__code" data-testid="room-invite-code-value">{code}</b>
		</div>
		<p class="invite__hint">{@html formatFont(t('pairs.inviteHint'))}</p>
	</div>

	<div class="invite__body">
		<div class="invite__card">
			<IdentityRow bind:name bind:country {avatar} {onAvatar} {onRandomName} {taken} />
		</div>

		{#if mineTaken}
			<p class="invite__note" role="status" data-testid="room-invite-avatar-taken-text">
				{@html formatFont(t('pairs.inviteAvatarTaken'))}
			</p>
		{/if}
	</div>

	<div class="invite__actions">
		<button
			type="button"
			class="menu-btn menu-tile btn-accent invite__join"
			onclick={onJoin}
			aria-disabled={busy}
			data-testid="room-invite-join-btn"
		>
			<LogIn class="menu-tile__icon" aria-hidden="true" />
			<span class="invite__join-label">{@html formatFont(t('pairs.inviteJoin'))}</span>
		</button>
		<button
			type="button"
			class="btn-secondary invite__back"
			onclick={onBack}
			data-testid="room-invite-back-btn"
		>
			{@html formatFont(t('pairs.inviteBack'))}
		</button>
	</div>
</section>

<style>
	/*
	 * Розмір — 95% площі екрана на мобільному телефоні зі збереженням балансу.
	 * Без зайвого скролу сторінки: висота віднімає шапку й поля батька.
	 */
	.invite {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: clamp(var(--space-xs), 1.5vh, var(--space-md));
		width: min(calc(100vw - 16px), 36rem);
		height: min(calc(100dvh - var(--fill-u) * 3.25 - 20px), 48rem);
		max-height: calc(100dvh - var(--fill-u) * 3.25 - 20px);
		padding: clamp(var(--space-sm), 3vw, var(--space-lg));
		margin: auto;
		border-radius: var(--radius-md);
		background: var(--color-bg-panel);
		box-shadow: var(--shadow-card);
		box-sizing: border-box;
		overflow-y: auto;
	}

	.invite__header {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: var(--space-xs);
		width: 100%;
		flex-shrink: 0;
	}

	.invite__title {
		margin: 0;
		width: 100%;
		font-size: clamp(1.35rem, 4.5vw, 1.85rem);
		font-weight: var(--font-weight-bold);
		line-height: 1.2;
		color: var(--color-text-on-panel);
		text-align: center;
	}

	.invite__code-wrap {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		padding: var(--space-xs) var(--space-lg);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-bg-card), transparent 15%);
		border: 2px solid var(--color-accent);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.invite__code-label {
		font-size: clamp(0.95rem, 3.2vw, 1.15rem);
		color: var(--color-text-on-panel);
		font-weight: var(--font-weight-medium);
	}

	.invite__code {
		font-size: clamp(1.9rem, 6.5vw, 2.8rem);
		letter-spacing: 0.25em;
		font-variant-numeric: tabular-nums;
		color: var(--color-text);
	}

	.invite__hint {
		margin: 0;
		font-size: clamp(0.85rem, 2.8vw, 1.05rem);
		color: var(--color-text-on-panel);
		opacity: 0.9;
		text-align: center;
		line-height: 1.35;
	}

	.invite__body {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		width: 100%;
		flex-shrink: 0;
	}

	.invite__card {
		padding: clamp(var(--space-sm), 2.5vw, var(--space-md));
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-bg-card), transparent 15%);
		border: 2px solid color-mix(in srgb, var(--color-border), transparent 30%);
		box-shadow: var(--shadow-card);
	}

	.invite__note {
		margin: 0;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-bold);
		color: var(--color-text-on-panel);
		text-align: center;
	}

	/*
	 * ВЕЛИКА КНОПКА «ЗАЙТИ» — патерн меню/хабу (.menu-tile), де іконка над текстом.
	 * Заповнює доступний простір картки без порожнечі (95% заповнення вікна).
	 */
	.invite__actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		width: 100%;
		flex: 1 1 auto;
		justify-content: flex-end;
		min-height: 0;
	}

	.invite__join {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-xs);
		width: 100%;
		max-width: none;
		flex: 1 1 auto;
		min-height: clamp(84px, 14vh, 150px);
		padding: clamp(var(--space-sm), 2vh, var(--space-lg)) var(--space-md);
		border-radius: var(--radius-lg);
		font: inherit;
		cursor: pointer;
	}

	.invite__join :global(.menu-tile__icon) {
		width: min(calc(var(--fill-u) * 4), 8svh, 48px);
		height: min(calc(var(--fill-u) * 4), 8svh, 48px);
		flex-shrink: 0;
	}

	.invite__join-label {
		font-size: clamp(1.35rem, 4.5vw, 1.7rem);
		font-weight: var(--font-weight-bold);
		letter-spacing: 0.02em;
	}

	.invite__back {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		max-width: none;
		min-height: 44px;
		padding: 0 var(--space-md);
		border-radius: var(--radius-md);
		font: inherit;
		font-size: clamp(0.95rem, 3vw, 1.1rem);
		font-weight: var(--font-weight-medium);
		cursor: pointer;
		flex-shrink: 0;
	}
</style>
