<script lang="ts">
	import { asset } from '$app/paths';
	import { countryName, isCountry } from '$lib/config/countries';
	import { settings } from '$lib/services/settings.svelte';

	/**
	 * Прапор країни гравця.
	 *
	 * ## Чому `<img>`, а не емодзі

	 * Автор заміряв причину сам: на Windows замість прапора стоять дві літери.
	 * Це не збій шрифту, а рішення Microsoft — у системних шрифтах немає глифів
	 * для пар regional-indicator, тож браузер малює самі літери. Отже емодзі-прапор
	 * недоступний більшості наших відвідувачів, і жоден шрифт це не лікує, крім
	 * власного, вагою в мегабайти.
	 *
	 * SVG зі `static/flags/` натомість однаковий усюди, покривається `img-src
	 * 'self'` без правки CSP і кешується браузером окремо — другий гравець із тієї
	 * самої країни не завантажує нічого. Набір і причини копії — у
	 * `scripts/sync-flags.mjs`.
	 *
	 * ## Доступність
	 *
	 * `alt` — НАЗВА КРАЇНИ мовою інтерфейсу, а не «прапор». Прапор тут не оздоба:
	 * він несе єдину інформацію, якої немає в тексті поруч, тож для скрінрідера
	 * він мусить бути тим самим фактом, а не словом «зображення».
	 *
	 * Невідомий код НЕ малюється взагалі. `<img>` на неіснуючий файл дає порожню
	 * рамку й запис у консолі — дефект, який видно лише розробнику.
	 */
	interface Props {
		/** Код країни, дві літери. Порожній рядок або `null` — прапора немає. */
		code: string | null | undefined;
		/** Висота в пікселях. Ширина рахується з пропорції 3:2. */
		height?: number;
	}

	let { code, height = 14 }: Props = $props();

	const known = $derived(isCountry(code) ? String(code).toLowerCase() : null);
	const label = $derived(known === null ? '' : countryName(known, settings.locale));
</script>

<!--
	`height={height}`, а не скорочення `{height}`.

	Скорочення дає той самий атрибут у DOM, але `src/media.test.ts` шукає в джерелі
	саме `height=` — і має рацію: обидва розміри мусять читатися з тегу очима,
	інакше наступна правка легко лишить `<img>` без одного з них, а це стрибок
	розмітки (CLS) на кожному прапорі в списку.
-->
{#if known !== null}
	<img
		class="flag"
		src={asset(`/flags/${known}.svg`)}
		alt={label}
		title={label}
		width={Math.round(height * 1.5)}
		height={height}
		loading="lazy"
		decoding="async"
	/>
{/if}

<style>
	/*
	 * Тонка рамка ОБОВʼЯЗКОВА, і не для краси.
	 *
	 * Прапори з білою смугою по краю (Польща, Японія, Фінляндія) на світлій темі
	 * зливаються з панеллю, і замість прапора видно половину. Рамка з кольору
	 * тексту в 78% прозорості дає межу в усіх чотирьох темах, не сперечаючись із
	 * жодним кольором самого прапора.
	 */
	.flag {
		flex-shrink: 0;
		border-radius: 2px;
		border: 1px solid color-mix(in srgb, var(--color-text), transparent 78%);
		vertical-align: text-bottom;
	}
</style>
