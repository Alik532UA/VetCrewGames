<script lang="ts">
	import { t, formatFont } from '$lib/i18n';

	/**
	 * Смужка поступу над картою, поки заповідник будується.
	 *
	 * Потрібна тому, що будівництво справді довге: шістсот сімдесят фігур рельєфу —
	 * це секунди роботи навіть на настільному екрані. Доти вони йшли одною задачею,
	 * браузер не малював нічого, і сторінка виглядала завислою. Тепер сцена
	 * виростає порціями, а тут видно, скільком фігурам уже дано місце.
	 *
	 * Смужка ЧЕСНА: її довжина — це справжня частка поставленого рельєфу, а не
	 * анімація «щось відбувається». Підроблений поступ, який доїжджає до кінця й
	 * чекає, гірший за його відсутність: він каже, що все готове, коли не готове.
	 */
	interface Props {
		/** 0 → 1. Одиниця означає «сцена стоїть уся», і смужка зникає. */
		done: number;
	}

	let { done }: Props = $props();

	const percent = $derived(Math.round(Math.min(1, Math.max(0, done)) * 100));
</script>

<div class="load" data-testid="reserve-loading-panel">
	<span class="load__label">{@html formatFont(t('reserve.loading'))} {percent}%</span>

	<!--
		`role="progressbar"` із межами: читалка мусить називати число, а не мовчати
		про смугу, яка комусь просто «щось малює».
	-->
	<div
		class="load__track"
		role="progressbar"
		aria-valuemin="0"
		aria-valuemax="100"
		aria-valuenow={percent}
		aria-label={t('reserve.loading')}
		data-testid="reserve-loading-progress"
	>
		<div class="load__fill" style="width: {percent}%"></div>
	</div>
</div>

<style>
	.load {
		/*
		 * По центру карти, поверх неї. Не на всю ширину: смужка на 1900px читається
		 * як індикатор завантаження сайту, а не як «готуємо цей заповідник».
		 */
		position: absolute;
		top: 50%;
		left: 50%;
		z-index: 3;
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		width: min(20rem, calc(100% - 2 * var(--space-lg)));
		padding: var(--space-md);
		border-radius: var(--radius-md);
		background: var(--color-bg-panel);
		box-shadow: 0 8px 32px rgb(0 0 0 / 45%);
		transform: translate(-50%, -50%);
		/* Смужка нічого не ловить: під нею вже жива карта, і тапи належать їй. */
		pointer-events: none;
	}

	.load__label {
		font-size: var(--font-size-sm);
		font-variant-numeric: tabular-nums;
	}

	.load__track {
		height: 8px;
		border-radius: 4px;
		background: var(--color-bg-card);
		overflow: hidden;
	}

	.load__fill {
		height: 100%;
		background: var(--color-accent);
		/*
		 * Перехід короткий: смужка рухається порціями по кілька відсотків, і без
		 * згладжування вона стрибала б. Довший перехід відставав би від правди.
		 */
		transition: width 120ms linear;
	}
</style>
