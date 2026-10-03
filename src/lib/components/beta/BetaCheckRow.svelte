<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import type { TranslationKey } from '$lib/i18n/translations/uk';
	import type { BetaCheck, Vote } from '$lib/config/betaChecks';
	import { betaProgress } from '$lib/services/betaProgress.svelte';

	/**
	 * Один пункт чеклиста з чотирма кнопками відповіді.
	 *
	 * Чотири, а не «галочка»: середній стан «працює, але дивно» ловить те, що
	 * бінарне «так/ні» округляє до «так», — а саме там і живуть дефекти, які потім
	 * знаходить користувач.
	 */
	interface Props {
		check: BetaCheck;
		/** Номер у списку. Малюється звідси, а не з тексту: розійтися нема чому. */
		index: number;
		/** Українська чи англійська: de та nl показують англійський текст. */
		uk: boolean;
	}

	let { check, index, uk }: Props = $props();

	// Ключ перекладу — ЯВНО, а не складений із назви стану: `t()` типізований
	// повним переліком ключів, і склеєний рядок цю перевірку обходить.
	const VOTES: { vote: Vote; key: 'ok' | 'fail' | 'unclear' | 'skip'; label: TranslationKey }[] = [
		{ vote: 'ok', key: 'ok', label: 'beta.vote.ok' },
		{ vote: 'fail', key: 'fail', label: 'beta.vote.fail' },
		{ vote: 'unclear', key: 'unclear', label: 'beta.vote.unclear' },
		{ vote: 'skip', key: 'skip', label: 'beta.vote.skip' }
	];

	let mine = $derived(betaProgress.voteOf(check.id));
	let stale = $derived(betaProgress.isStale(check.id));
	let text = $derived(uk ? check.text.uk : check.text.en);
	let category = $derived(uk ? check.category.uk : check.category.en);

	/**
	 * Повторне натискання того самого стану знімає позначку — але рахує це
	 * сервіс, а не рядок (§ 3.3, `BETA-VOTE-UNDO`).
	 *
	 * Доти тут стояло `mine === vote ? 'none' : vote`, і `mine` приходив із
	 * `voteOf()`, який версії не дивиться. На позначці З ІНШОЇ ЗБІРКИ це
	 * означало стирання замість перепостановки: підтвердження торішнього
	 * «працює» втрачало його.
	 */
	const press = (vote: Vote) => betaProgress.vote(check.id, vote);

	/**
	 * ДИСКРИМІНАТОР ЛОКАТОРА — з `check.id`, а не з номера в списку.
	 *
	 * **Це вибір ЗА правилом, а не відхилення від нього.** Донедавна
	 * BETA-CHECKLIST радив сталі назви (`beta-check-item`, `beta-vote-ok-btn`), і
	 * тут стояв запис про свідоме відхилення. Канон 9.3 § 5.6
	 * (`BETA-LOCATOR-PER-CHECK`, HIGH) визнав ту пораду помилковою й вимагає саме
	 * того, що зроблено тут; сусідній проєкт, який поради послухався, мусив завести
	 * allowlist «законних дублікатів» із шести імен, аби гейт не червонів.
	 *
	 * Причина початкова й далі чинна: рядок малюється по разу на пункт, тобто на
	 * цій сторінці по 24 рази під однією назвою. Знайшов це рантайм-інваріант
	 * `tests/testid.spec.ts` (§ 1.9.2 канону TESTID-AND-NAMING) — статична
	 * перевірка такого не бачить за визначенням: у ФАЙЛІ кожен локатор
	 * унікальний, а скільки разів компонент відрендерено, джерела не знають.
	 *
	 * І це не теорія: `e2e`-перевірка доступності вже мусила писати `.first()`
	 * із коментарем «`beta-checks-list` тут ТРИ», інакше Playwright падав зі
	 * `strict mode violation` — тобто дублікати вже одного разу вкусили.
	 *
	 * `_` → `-`, бо § 1.2 вимагає kebab-case: id пункту в даних — `common_1`, а
	 * в локаторі стає `common-1`. Заміна повна й однозначна в обидва боки.
	 *
	 * Значення, а не порядковий номер, — прямо за § 1.6: `common-1` переживає
	 * зміну порядку пунктів, а `beta-check-7-item` при вставці нового пункту
	 * починає означати інший рядок.
	 */
	const tid = $derived(check.id.replace(/_/g, '-'));
</script>

<li
	class="row"
	class:row--marked={mine !== 'none'}
	class:row--ok={mine === 'ok'}
	class:row--fail={mine === 'fail'}
	class:row--unclear={mine === 'unclear'}
	class:row--skip={mine === 'skip'}
	data-testid="beta-check-{tid}-item"
>
	<p class="category" data-testid="beta-check-{tid}-category-text">
		{index}. {@html formatFont(category)}
	</p>
	<p class="text" data-testid="beta-check-{tid}-text">{@html formatFont(text)}</p>

	<!--
		Голоси — СМУГОЮ, як кожен вибір у застосунку (`.seg-track` у `global.css`), а
		вибраний голос — кольором свого стану, а не акцентом (див. `.vote--active`).
	-->
	<div class="seg-track" role="group" aria-label={t('beta.progress')}>
		{#each VOTES as option (option.vote)}
			<button
				type="button"
				class="seg-item vote--{option.key}"
				class:vote--active={mine === option.vote}
				aria-pressed={mine === option.vote}
				onclick={() => press(option.vote)}
				data-testid="beta-vote-{tid}-{option.key}-btn"
			>
				{@html formatFont(t(option.label))}
			</button>
		{/each}
	</div>

	{#if stale}
		<!-- Теж із `id` пункта (§ 5.6): підказка малюється по разу на кожен пункт,
		     у якого позначка з іншої версії, тобто стала назва тут повторюється
		     рівно так само, як і на самому рядку. -->
		<p class="stale" data-testid="beta-check-{tid}-stale-hint">
			{@html formatFont(t('beta.stale'))}
		</p>
	{/if}
</li>

<style>
	.row {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px 12px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background-color: var(--color-bg-surface);
	}

	.row.row--ok {
		border-color: var(--color-success, #22c55e);
		border-width: 2px;
	}
	.row.row--fail {
		border-color: var(--color-error, #ef4444);
		border-width: 2px;
	}
	.row.row--unclear {
		border-color: var(--color-warning, #eab308);
		border-width: 2px;
	}
	.row.row--skip {
		border-color: var(--color-info, #3b82f6);
		border-width: 2px;
	}

	/* Позначений пункт видно з відстані: людина шукає, де вона зупинилася. */
	.row--marked {
		border-color: var(--color-accent);
	}

	.category {
		margin: 0;
		font-size: 0.8rem;
		opacity: 0.75;
	}

	.text {
		margin: 0;
		line-height: 1.4;
	}

	/*
	 * Сегмент — з `global.css` (`.seg-item`): висота 44px, тло, наведення, курсор.
	 * 44px тут — не мінімум WCAG «щоб пройшло», а власний стандарт проєкту для
	 * дотику: половину цих перевірок роблять із телефона в руках.
	 */
	.seg-item {
		--vote-ok: var(--color-success, #22c55e);
		--vote-fail: var(--color-error, #ef4444);
		--vote-unclear: var(--color-warning, #eab308);
		--vote-skip: var(--color-info, #3b82f6);
	}

	.vote--ok {
		background-color: color-mix(in srgb, var(--vote-ok) 8%, transparent);
	}
	.vote--fail {
		background-color: color-mix(in srgb, var(--vote-fail) 8%, transparent);
	}
	.vote--unclear {
		background-color: color-mix(in srgb, var(--vote-unclear) 8%, transparent);
	}
	.vote--skip {
		background-color: color-mix(in srgb, var(--vote-skip) 8%, transparent);
	}

	.vote--active {
		font-weight: 700;
	}

	.vote--ok.vote--active {
		box-shadow: inset 0 0 0 4px var(--vote-ok);
		background-color: color-mix(in srgb, var(--vote-ok) 18%, transparent);
		color: var(--vote-ok);
	}

	.vote--fail.vote--active {
		box-shadow: inset 0 0 0 4px var(--vote-fail);
		background-color: color-mix(in srgb, var(--vote-fail) 18%, transparent);
		color: var(--vote-fail);
	}

	.vote--unclear.vote--active {
		box-shadow: inset 0 0 0 4px var(--vote-unclear);
		background-color: color-mix(in srgb, var(--vote-unclear) 18%, transparent);
		color: var(--vote-unclear);
	}

	.vote--skip.vote--active {
		box-shadow: inset 0 0 0 4px var(--vote-skip);
		background-color: color-mix(in srgb, var(--vote-skip) 18%, transparent);
		color: var(--vote-skip);
	}

	.stale {
		margin: 0;
		font-size: 0.8rem;
		opacity: 0.7;
	}
</style>
