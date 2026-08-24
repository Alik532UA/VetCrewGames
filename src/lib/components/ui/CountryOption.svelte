<script lang="ts">
	import { formatFont } from '$lib/i18n';
	import Flag from './Flag.svelte';

	/**
	 * ОДИН ПУНКТ панелі вибору країни: прапор, назва й три стани.
	 *
	 * ## Чому окремий файл, а не розмітка в `CountryMenu`
	 *
	 * Шов виявила межа розміру (`structure.test.ts` § 7: 321 SLOC при стелі 300),
	 * але він не вигаданий під неї. Пункт має власну відповідальність — вигляд і
	 * стани, — і власні сто тридцять рядків стилів: наведення, вибране, активне
	 * (клавіатура) і плитка режиму прапорів. Панель же відповідає за пошук,
	 * клавіатуру й розкладку, і жодне з правил нижче її не стосується.
	 *
	 * Розмітка при цьому НЕ змінилася: компонент малює той самий `button` із
	 * `role="option"`, тобто в дереві доступності `listbox` як був, так і лишився.
	 * Обгортки тут не буває й бути не може — у `role="listbox"` за ARIA не
	 * існує нічого, крім `option` і `group`.
	 *
	 * ## Назва завжди в `aria-label`
	 *
	 * У режимі прапорів видимої назви немає, і без `aria-label` пункт лишився б
	 * без доступного імені: прапор — `<img>` усередині `aria-hidden`. Тобто
	 * скрінрідер читав би «кнопка» 262 рази. Тому назва йде атрибутом ЗАВЖДИ, а
	 * `flagsOnly` міняє лише те, що намальовано.
	 */
	interface Props {
		/** Код країни. Порожній рядок — пункт «без прапора». */
		code: string;
		/** Назва мовою інтерфейсу. Вона ж — доступне ім'я пункту. */
		name: string;
		/** `id` для `aria-activedescendant` панелі. */
		id: string;
		/** Основа `data-testid`, та сама, що в кнопки й панелі. */
		testId: string;
		/** Вибраний зараз. */
		chosen: boolean;
		/** На ньому стоїть клавіатура (`aria-activedescendant`). */
		active: boolean;
		/** Малювати лише прапор, без назви. */
		flagsOnly?: boolean;
		onpick: (code: string) => void;
	}

	let {
		code,
		name,
		id,
		testId,
		chosen,
		active,
		flagsOnly = false,
		onpick
	}: Props = $props();
</script>

<!--
	ПУНКТ — це `button` із роллю `option`, а не `div` з `onclick`.

	Причина не в чистоті: `div` з обробником кліку дає попередження компілятора
	`a11y_click_events_have_key_events`, а `svelte/valid-compile` тут стоїть у
	`error`. Заглушений обробник клавіш поруч із живим на полі пошуку був би
	кодом, який нічого не робить і виглядає, ніби робить.

	`tabindex="-1"` обовʼязковий: без нього Tab ішов би по 262 кнопках, а
	керування списком лежить на полі пошуку через `aria-activedescendant`.
-->
<button
	type="button"
	{id}
	class="menu__option"
	class:menu__option--flag={flagsOnly}
	class:menu__option--chosen={chosen}
	class:menu__option--active={active}
	role="option"
	aria-selected={chosen}
	aria-label={name}
	tabindex="-1"
	onclick={() => onpick(code)}
	data-testid={testId}
>
	<span class="menu__mark" aria-hidden="true">
		{#if code}
			<Flag {code} height={14} />
		{/if}
	</span>
	{#if !flagsOnly}
		<span class="menu__name">{@html formatFont(name)}</span>
	{/if}
</button>

<style>
	.menu__option {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		width: 100%;
		/* 44px — власний стандарт сенсорної цілі (ACCESSIBILITY-v8 § 8). */
		min-height: 44px;
		padding: 0 var(--space-sm);
		border: none;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--color-text);
		font: inherit;
		font-size: var(--font-size-sm);
		text-align: left;
		cursor: pointer;
		/*
		 * ПУНКТ ЗА МЕЖАМИ ПРОКРУТКИ НЕ МАЛЮЄТЬСЯ Й НЕ ТЯГНЕ СВІЙ ПРАПОР.
		 *
		 * Заміряно на dev-сервері: без цього рядка при відкритті панелі браузер
		 * брав 111 прапорів із 262 — `loading="lazy"` рахує відстань від ВІКНА, а
		 * не від коробки прокрутки, тож «поза екраном» для нього починається
		 * значно нижче. `content-visibility` міряє саме коробку.
		 *
		 * `contain-intrinsic-size` обовʼязковий: без нього пропущений пункт має
		 * нульову висоту, повзунок бреше й `scrollIntoView` цілиться не туди.
		 */
		content-visibility: auto;
		contain-intrinsic-size: auto 44px;
	}

	/*
	 * ПУНКТ У РЕЖИМІ ПРАПОРІВ — плитка, а не рядок.
	 *
	 * Ширина дорівнює висоті (44px — власний стандарт сенсорної цілі,
	 * ACCESSIBILITY-v8 § 8), тобто прапор 21×14 стоїть у центрі квадрата, і палець
	 * попадає в нього без прицілювання. `width` тут `auto` не годиться: без
	 * фіксованої ширини flex стиснув би плитку до самого прапора, і сусідні
	 * прапори злиплися б у смугу.
	 */
	.menu__option--flag {
		width: 44px;
		padding: 0;
		justify-content: center;
	}

	/*
	 * Прапор і його місце в пункті «без прапора».
	 *
	 * Фіксована ширина ОБОВʼЯЗКОВА: без неї пункт без прапора зсував би назву
	 * влівo, і рівний стовпчик назв розсипався б на цьому рядку.
	 */
	.menu__mark {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		width: 21px;
	}

	/*
	 * НАЗВА ПЕРЕНОСИТЬСЯ, А НЕ ОБРІЗАЄТЬСЯ, і в колонці на 180px це вже питання.
	 *
	 * Обрізати трьома точками було б рівніше на вигляд, але тут треба ВПІЗНАТИ
	 * свою країну, а «Центральноафриканська Р…» упізнати не дає. Заміряно, скільки
	 * це коштує: у колонці 180px у два рядки переходять 19 назв із 263 і жодна з
	 * них не стає вищою за 44px (рядок тексту 21px, тобто два вкладаються в
	 * сенсорну висоту), і рівно одна — «Південна Джорджія та Південні Сандвічеві
	 * Острови» — займає три рядки й 63px. Один вищий рядок із 263 дешевший за 19
	 * обрізаних назв.
	 *
	 * `min-width: 0` і `overflow-wrap` — пара, і поодинці не працює ні той, ні той.
	 * Без нуля flex не дає елементу стати вужчим за найдовше СЛОВО, тож
	 * «Центральноафриканська» вилазила в сусідню колонку (заміряно: єдиний пункт із
	 * 263, у якого `scrollWidth` більший за `clientWidth`). Без `overflow-wrap`
	 * саме воно й лишилося б нерозривним і просто обрізалося б коробкою.
	 */
	.menu__name {
		min-width: 0;
		overflow-wrap: break-word;
	}

	/*
	 * НАВЕДЕННЯ — ДОМІШКА КОЛЬОРУ ТЕКСТУ, А НЕ АКЦЕНТУ З ПРОЗОРІСТЮ.
	 *
	 * Перенесено з `HeaderMenu.svelte` разом із причиною, яку там заміряли:
	 * прозорий акцент (жовтий у трьох темах із чотирьох) поверх будь-якого тла
	 * дає бруд, а не крок світліше або темніше. 10% кольору ТЕКСТУ — притінення
	 * у світлих темах і підсвітка в темних, тобто крок у потрібний бік
	 * перевертається сам.
	 */
	@media (hover: hover) {
		.menu__option:hover {
			background: color-mix(in srgb, var(--color-text), transparent 90%);
		}
	}

	/*
	 * ВИБРАНЕ — акцент ЦІЛКОМ, із призначеним для нього кольором тексту.
	 *
	 * `--color-text-on-accent` підібраний під акцент у кожній темі окремо
	 * (7.38–7.79:1 — заміряно в `HeaderMenu.svelte`), тож пара тримається в усіх
	 * чотирьох без окремих правил.
	 */
	.menu__option--chosen {
		background: var(--color-accent);
		color: var(--color-text-on-accent);
		font-weight: var(--font-weight-bold);
	}

	@media (hover: hover) {
		.menu__option--chosen:hover {
			background: var(--color-accent-hover);
		}
	}

	/*
	 * АКТИВНИЙ ПУНКТ — РАМКА, а не заливка, і це не смак.
	 *
	 * «Активний» тут означає `aria-activedescendant`: клавіатура стоїть на цьому
	 * пункті, але фокус — у полі пошуку, тобто справжнього `:focus-visible`
	 * браузер тут не намалює. Заливкою його показати не можна: вона зіткнулася б
	 * і з наведенням, і з вибраним, і на вибраному пункті стан «клавіатура тут»
	 * зник би зовсім. Рамка складається з будь-яким тлом.
	 */
	.menu__option--active {
		outline: 2px solid var(--color-accent);
		outline-offset: -2px;
	}
</style>
