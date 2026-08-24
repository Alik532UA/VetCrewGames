<script lang="ts">
	import { formatFont } from '$lib/i18n';
	import type { Privacy } from '$lib/net/privacy';

	/**
	 * ТРИ ПЕРЕМИКАЧІ ПРИВАТНОСТІ — і жоден із них не фільтр на екрані.
	 *
	 * Кожен тримає правило бази (`net/privacy.ts`): «не в пошуку» означає
	 * відсутність у гілці `find`, «не підписуватися» — відмову базою в записі
	 * підписки, «не в таблиці» — відмову в записі рядка. Тому цей компонент лише
	 * показує стан і віддає новий; жодної логіки приховування тут немає й бути не
	 * може.
	 *
	 * ## Чому кнопка з `aria-pressed`, а не `<input type="checkbox">`
	 *
	 * Той самий взірець, що в шапці (`HeaderControls`): у проєкті немає жодного
	 * чекбокса, а є кнопки-перемикачі, і скрінрідер читає їхній стан так само.
	 * Заводити другу породу перемикачів заради трьох рядків означало б два різні
	 * вигляди того самого жесту на сусідніх екранах.
	 *
	 * ## Чому окремий компонент
	 *
	 * Сторінка акаунта вже впирається в межу розміру (400 SLOC у гейті
	 * `src/structure.test.ts`), а тут — панель із власним переліком і власними
	 * підписами. Це рівно той випадок, коли компонент не подрібнює, а розділяє.
	 */
	interface Props {
		privacy: Privacy;
		/** Перекладач сторінки: рядки акаунта лежать у лінивому чанку. */
		text: (key: string) => string;
		busy: boolean;
		onchange: (next: Privacy) => void;
	}

	let { privacy, text, busy, onchange }: Props = $props();

	/** Порядок тут той самий, що в житті: знайти → підписатися → змагатися. */
	const SWITCHES: readonly (keyof Privacy)[] = ['search', 'follow', 'board'];
</script>

<section class="privacy text-panel" data-testid="account-privacy-panel">
	<h2 class="privacy__title">{@html formatFont(text('account.privacyTitle'))}</h2>
	<p class="privacy__hint">{@html formatFont(text('account.privacyHint'))}</p>

	<!--
		Локатор — ШАБЛОНОМ у розмітці, а не полем переліку.

		`data-testid={item.testid}` дало б у джерелі рівно рядок `item.testid`, і
		гейт чеклиста (`src/lib/config/betaChecks.test.ts`) не побачив би жодного
		локатора: він читає саме розмітку, бо пункт, який просить натиснути кнопку,
		мусить називати кнопку, що існує.
	-->
	{#each SWITCHES as id (id)}
		<button
			type="button"
			class="privacy__row"
			class:privacy__row--on={privacy[id]}
			aria-pressed={privacy[id]}
			aria-disabled={busy}
			data-testid="account-privacy-{id}-btn"
			onclick={() => onchange({ ...privacy, [id]: !privacy[id] })}
		>
			<span class="privacy__label">{@html formatFont(text(`account.privacy.${id}`))}</span>
			<span class="privacy__state">
				{@html formatFont(text(privacy[id] ? 'account.privacyOn' : 'account.privacyOff'))}
			</span>
		</button>
	{/each}
</section>

<style>
	.privacy {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		width: 100%;
	}

	.privacy__title {
		margin: 0 0 var(--space-xs);
		font-size: var(--font-size-md);
	}

	/*
	 * Підказка — КЕГЛЕМ, а не прозорістю: `opacity` на тексті цієї панелі опускає
	 * пару під 4.5:1, і жодне значення прозорості її не рятує. Те саме міркування
	 * записане на самій сторінці акаунта й у `RoomList`.
	 */
	.privacy__hint {
		margin: 0 0 var(--space-xs);
		font-size: var(--font-size-xs);
		color: var(--color-text-on-panel);
	}

	.privacy__row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-sm);
		/* 44px — власний стандарт сенсорної цілі (ACCESSIBILITY-v8 § 8). */
		min-height: 44px;
		padding: var(--space-xs) var(--space-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: var(--color-text);
		font: inherit;
		font-size: var(--font-size-sm);
		text-align: left;
		cursor: pointer;
	}

	.privacy__row--on {
		border-color: var(--color-accent);
	}

	.privacy__label {
		flex: 1;
		min-width: 0;
	}

	/*
	 * Стан названий СЛОВОМ, а не лише рамкою: колір не буває єдиним носієм
	 * значення (WCAG 1.4.1), і `aria-pressed` читає лише скрінрідер. Той самий
	 * висновок, що в `YouTag`.
	 */
	.privacy__state {
		flex-shrink: 0;
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-bold);
	}

	.privacy__row--on .privacy__state {
		color: var(--color-accent);
	}
</style>
