<script lang="ts">
	import { Check, X } from 'lucide-svelte';
	import { t, formatFont } from '$lib/i18n';
	import { habitatImage, type HabitatMode } from '$lib/config/habitat-game';
	import type { TranslationKey } from '$lib/i18n/translations/uk';

	/**
	 * Варіанти відповіді у «Де живем?»: континенти або природні зони.
	 *
	 * Правильних може бути кілька, тож це перемикачі, а не радіокнопки — і після
	 * перевірки кожен показує СВІЙ підсумок: влучив, пропустив, помилився.
	 */
	interface Props {
		options: readonly string[];
		mode: HabitatMode;
		selected: readonly string[];
		correct: readonly string[];
		checked: boolean;
		ontoggle: (option: string) => void;
	}

	let { options, mode, selected, correct, checked, ontoggle }: Props = $props();

	const optionKey = (option: string): TranslationKey =>
		(mode === 'continents'
			? `habitat.continent.${option}`
			: `habitat.biome.${option}`) as TranslationKey;
</script>

<div class="options" style:--half={Math.ceil(options.length / 2)}>
	{#each options as option (option)}
		{@const isCorrect = correct.includes(option)}
		{@const isSelected = selected.includes(option)}
		<button
			type="button"
			class="option"
			class:option--selected={!checked && isSelected}
			class:option--hit={checked && isCorrect && isSelected}
			class:option--missed={checked && isCorrect && !isSelected}
			class:option--wrong={checked && !isCorrect && isSelected}
			disabled={checked}
			onclick={() => ontoggle(option)}
			data-testid="habitat-option-btn-{option}"
		>
			{#if checked && isCorrect}
				<Check size={16} aria-hidden="true" />
			{:else if checked && isSelected}
				<X size={16} aria-hidden="true" />
			{/if}
			<img
				src={habitatImage(mode, option)}
				alt=""
				class="option__image"
				loading="lazy"
				width="540"
				height="720"
			/>
			<span class="option__label">{@html formatFont(t(optionKey(option)))}</span>
		</button>
	{/each}
</div>

<style>
	/*
	 * РІВНО дві колонки, а не `auto-fit` за шириною.
	 *
	 * `auto-fit` тут ставав частиною зворотного зв'язку. Сторінку зменшує
	 * `fitToViewport` через `zoom`, а зум РОЗШИРЮЄ її власну систему координат:
	 * при 0.8 вона дістає на чверть більше CSS-пікселів, і `auto-fit` розкладав
	 * варіанти вже не у два стовпці, а в три. Три стовпці — інша висота, інша
	 * висота — інший коефіцієнт, і так по колу: екран блимав між двома
	 * розкладками й не спинявся.
	 *
	 * Двійка стала й тому, що вона й так була відповіддю на вузькому екрані:
	 * `auto-fit` із порогом 130px давав дві колонки скрізь до 700px, просто
	 * недетерміновано. `minmax(0, 1fr)`, а не `1fr`: інакше колонка не звузиться
	 * менше за `min-content` вмісту (FLUID-SIZING-v8 § 1).
	 */
	.options {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-sm);
		width: 100%;
	}

	/*
	 * Зображення ПЕРЕД текстом, рядком, — на будь-якій ширині; міняється лише число колонок.
	 *
	 * РОЗМІРИ — ЧАСТКАМИ ШИРИНИ САМОЇ КНОПКИ (`cqi`), а не пікселями (прохання автора
	 * 2026-09-28: «текст кнопок від 30% до 70% кнопки → від 55% до 95%»). Доти кегль `sm` і
	 * картинка 26px доходили від третини до двох третин кнопки (заміряно 33–68% на 360×640), і
	 * що менший масштаб сторінки, то менше: `zoom` розширює її координати, а пікселі лишаються
	 * тими самими.
	 *
	 * Числа виведені з крайніх назв чотирьох мов, виміряних шрифтом Inglobal: найдовше слово
	 * («Regenwoud», «Антарктида») — 5 em, найкоротша назва («Азія») — 1,76 em. Щоб коротка
	 * сягала 55% кнопки, текст мусить починатися десь із третини, — звідси картинка 32cqi; щоб
	 * довге слово ще стояло в рядку, кегль не більший за 12cqi.
	 *
	 * ДРУГА МЕЖА — ВИСОТА ЕКРАНА (`svh`), і без неї `cqi` тут працює проти масштабу сторінки.
	 * `fitToViewport` зменшує сторінку `zoom`-ом, а зум РОЗШИРЮЄ її координати: при 0.75
	 * кнопка має на третину більше CSS-пікселів, і все, що рахується від її ширини, на екрані
	 * лишається того самого розміру. Тобто варіанти не зменшувалися разом зі сторінкою, і на
	 * 360×640 дев'ять природних зон не вміщалися навіть на дні масштабу. Частка висоти екрана
	 * зменшується разом із зумом, тож на низькому екрані розмір задає вона, а на високому —
	 * ширина кнопки. Варіантам дістається 40% висоти на картинки й 17% на кегль, поділені на
	 * число рядів (`--half`): у дев'яти зон їх п'ять, у семи континентів — чотири.
	 *
	 * Картинка КВАДРАТНА, а не 3:4, як деінде. При 3:4 вона вища за два рядки тексту, тож
	 * задавала висоту кнопки сама — і дев'ять природних зон перестали вміщатися в екран
	 * телефона: 123px на кнопку замість 81, кнопка «Перевірити» на 910px при висоті 844.
	 * Середина зображення лишається, а воно тут — підказка до назви, а не головне.
	 */
	.option {
		display: flex;
		align-items: center;
		/*
		 * Вміст притиснутий ЛІВОРУЧ, а не по центру кнопки.
		 *
		 * Підписи різної довжини — «Гори» й «Ліс помірної зони» — по центру
		 * лишають зображення в різних місцях кожного рядка, і око щоразу шукає
		 * його наново. Спільний лівий край дає стовпчик значків, уздовж якого
		 * погляд просто йде вниз.
		 */
		justify-content: flex-start;
		gap: var(--space-sm);
		/* 44px — власний стандарт проєкту для сенсорних цілей (ACCESSIBILITY § 8). */
		min-height: 44px;
		padding: var(--space-xs) var(--space-sm);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-bg-surface), transparent 25%);
		backdrop-filter: var(--blur-glass);
		color: var(--color-text);
		font: inherit;
		container-type: inline-size;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.option__image {
		width: min(32cqi, calc(40svh / var(--half)));
		aspect-ratio: 1;
		height: auto;
		object-fit: cover;
		border-radius: var(--radius-sm);
		flex-shrink: 0;
	}

	.option__label {
		min-width: 0;
		font-size: clamp(
			var(--font-size-sm),
			min(12cqi, calc(17svh / var(--half))),
			var(--font-size-2xl)
		);
		line-height: 1.2;
		/* Довгий підпис переноситься — і другий рядок теж починається зліва. */
		text-align: left;
		/* Запас на назву, якої ще немає: довше слово переноситься, а не вилазить за кнопку. */
		overflow-wrap: anywhere;
	}

	/*
	 * Від 1000px — ДВА РЯДИ, а не один: 7 варіантів — чотири й три, 9 — п'ять і чотири.
	 *
	 * Доти тут стояв один ряд із зображенням НАД текстом. Кнопка в ньому ~115px завширшки, і
	 * підпис у ній не сягав потрібної частки за жодного кегля: найдовше слово (5 em) мусить
	 * стояти в рядку, тож найкоротша назва (1,76 em) займала третину кнопки — заміряно 28–34%
	 * на 1280×800 і 1920×1080. У двох рядах кнопка вдвічі ширша, і розкладка та сама, що на
	 * телефоні, — картинка перед текстом, — а висота майже та сама: два нижчі ряди замість
	 * одного високого.
	 *
	 * Число колонок приходить із розмітки (`--half` — половина варіантів, округлена вгору: у
	 * двох колонках це число рядів, у двох рядах — число колонок), бо варіантів то 7, то 9, а
	 * `auto-fit` тут заборонений (див. угорі). Сторінка під ці колонки ширшає сама — правило
	 * поруч з її `max-width`, а не тут: ширина контейнера не справа його вмісту.
	 *
	 * Межі висоти тут не потрібні: сторінка має стелю в пікселях (`--measure-habitat-wide`),
	 * тож кнопка зменшується разом із масштабом сама. Стеля кегля — на чверть вища: у чотирьох
	 * колонках кнопка ширша, ніж на телефоні, і з обома телефонними межами «Азія» займала 46%
	 * кнопки на 1280×800. Тепер — 56–92% на 1024×768, 1280×800 і 1920×1080.
	 */
	@media (min-width: 1000px) {
		.options {
			grid-template-columns: repeat(var(--half), minmax(0, 1fr));
		}

		.option__image {
			width: 32cqi;
		}

		.option__label {
			font-size: clamp(var(--font-size-sm), 12cqi, calc(var(--font-size-2xl) * 1.25));
		}
	}

	.option--selected {
		border-color: var(--color-accent);
		background: color-mix(in srgb, var(--color-accent), transparent 75%);
	}

	.option--hit {
		border-color: var(--color-success);
		background: color-mix(in srgb, var(--color-success), transparent 70%);
	}

	/* Пропущену правильну показуємо пунктиром: гравець її не обирав. */
	.option--missed {
		border-style: dashed;
		border-color: var(--color-success);
	}

	.option--wrong {
		border-color: var(--color-error);
		background: color-mix(in srgb, var(--color-error), transparent 75%);
	}

	.option:disabled {
		cursor: default;
	}
</style>
