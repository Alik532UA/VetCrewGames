<script lang="ts">
	import { t, formatFont, formatPlain } from '$lib/i18n';
	import { countriesByName } from '$lib/config/countries';
	import { settings } from '$lib/services/settings.svelte';
	import Flag from './Flag.svelte';

	/**
	 * Вибір країни — з прапором поруч і з можливістю не мати жодного.
	 *
	 * ## Чому нативний `<select>`, а не власний список
	 *
	 * Двісті шістдесят пʼять пунктів. Власний випадний список тут означав би
	 * прокрутку, пошук, керування клавіатурою, віртуалізацію й фокус-пастку — і
	 * все це вже є в нативному елементі, разом із тим, чого не зробити взагалі:
	 * на телефоні браузер відкриває власний вибірник із набором на всю висоту,
	 * а введення літери в ньому працює як пошук.
	 *
	 * Ціна названа: у `<option>` не буває картинки, тож прапор стоїть ПОРУЧ із
	 * полем, а не в кожному рядку. Це не втрата: у списку людина шукає НАЗВУ (вона
	 * знає, як зветься її країна), а прапор потрібен для підтвердження вибору — і
	 * саме там він і стоїть.
	 *
	 * ## Чому `formatPlain`, а не `formatFont`
	 *
	 * `formatFont` обгортає літеру в `<span>`, а `<option>` розмітки НЕ приймає:
	 * браузер її просто викине, і в списку лишиться сирий текст без потрібного
	 * шрифту. Тому тут єдиний у проєкті випадок, де правильна відповідь —
	 * `formatPlain`, який міняє символ у самому значенні.
	 *
	 * Ціна названа: у DOM опції стоїть латинська «i» замість кириличної, тобто
	 * пошук по сторінці цим словом не знайде його. Для випадного списку це
	 * дешевше, ніж неправильний шрифт: список шукають його ж власним пошуком
	 * (введенням літери), а не браузерним.
	 *
	 * ## Назви країн
	 *
	 * Мовою інтерфейсу, з `Intl.DisplayNames` — тобто з даних ICU в браузері, а не
	 * зі словника проєкту. Двісті шістдесят пʼять назв × чотири мови не потрапляють
	 * ні в репозиторій, ні в бандл; подробиці — у `config/countries.ts`.
	 */
	interface Props {
		/** Код країни. Порожній рядок — «без прапора». Двобічне. */
		value: string;
		/** Основа `data-testid`: `pairs-country` дає `pairs-country-select`. */
		scope: string;
		/**
		 * КОМПАКТНИЙ РЕЖИМ: видно лише прапор, і він сам є контролом.
		 *
		 * Потрібен там, де прапор стоїть ПЕРЕД ніком, а не окремим рядком: підпис
		 * «Прапор» над полем на п'ятсот пікселів ширини читався як ще одне
		 * налаштування, хоч це частина того самого підпису гравця.
		 *
		 * Нативний `select` при цьому НЕ зникає — він лежить поверх прапора
		 * прозорим. Це не хитрість, а єдиний спосіб зберегти те, за що він тут і
		 * вибраний (див. докблок вище): на телефоні браузер відкриває власний
		 * вибірник на всю висоту, а введення літери в ньому працює як пошук. Кнопка
		 * з власним списком на 264 пункти все це втратила б.
		 */
		compact?: boolean;
	}

	let { value = $bindable(), scope, compact = false }: Props = $props();

	/*
	 * Список рахується на вимогу мови, а не тримається готовим: сортування
	 * двохсот шістдесяти пʼяти назв колатором залежить від мови, а мову
	 * перемикають на цій самій сторінці.
	 */
	const countries = $derived(countriesByName(settings.locale, t));
</script>

<div class="country" class:country--compact={compact}>
	<label class="country__label" for="{scope}-select">
		<span>{@html formatFont(t('pairs.country'))}</span>
	</label>
	<div class="country__row">
		<Flag code={value} height={18} />
		<select
			id="{scope}-select"
			class="country__select"
			bind:value
			data-testid="{scope}-select"
			title={compact ? t('pairs.country') : undefined}
		>
			<!--
				«Без прапора» — ПЕРШИЙ пункт, і він не порожній рядок на вигляд.

				Порожній `<option>` читається як «ще не вибрано», а це інше: тут це
				свідома відповідь «не показувати». Людина, яка не хоче називати країну,
				мусить бачити цей варіант названим, а не вгадувати, що список можна
				лишити невибраним.
			-->
			<option value="">{formatPlain(t('pairs.countryNone'))}</option>
			{#each countries as country (country.code)}
				<option value={country.code}>{formatPlain(country.name)}</option>
			{/each}
		</select>
	</div>
</div>

<style>
	.country {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.country__label {
		font-size: var(--font-size-sm);
		color: var(--color-text-on-panel);
	}

	.country__row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	/*
	 * `flex: 1` на самому полі, а не на обгортці: назви країн різної довжини
	 * («Чад» і «Центральноафриканська Республіка»), і поле, що міряється вмістом,
	 * стрибало б на кожному виборі.
	 */
	.country__select {
		flex: 1;
		min-width: 0;
		/* 44px — власний стандарт сенсорної цілі (ACCESSIBILITY-v8 § 8). */
		min-height: 44px;
		padding: 0 var(--space-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: var(--color-text);
		font: inherit;
		font-size: var(--font-size-sm);
	}
	/*
	 * КОМПАКТНИЙ РЕЖИМ: прапор — контрол, `select` лежить поверх прозорим.
	 *
	 * Підпис прибирається з очей, але лишається в DOM: `for`/`id` — єдине, що
	 * називає цей контрол для скрінрідера, і `title` на самому `select` його не
	 * заміняє (браузери читають `title` не завжди й не першим).
	 *
	 * `opacity: 0` замість `visibility: hidden` чи `appearance: none`: прихований
	 * інакше `select` перестає приймати кліки, а весь сенс тут — щоб натиснули
	 * саме по прапору й відкрився НАТИВНИЙ список.
	 *
	 * 44px — власний стандарт сенсорної цілі. Прапор усередині 18px, решта —
	 * область натискання, тобто цілі 44px без роздування рядка.
	 */
	.country--compact {
		flex-direction: row;
	}

	.country--compact .country__label {
		/* Не `display: none`: підпис мусить лишитися для скрінрідера. */
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.country--compact .country__row {
		position: relative;
		width: 44px;
		height: 44px;
		justify-content: center;
		gap: 0;
		border-radius: var(--radius-sm);
		cursor: pointer;
	}

	.country--compact .country__select {
		position: absolute;
		inset: 0;
		width: 100%;
		min-height: 0;
		padding: 0;
		border: none;
		background: none;
		opacity: 0;
		cursor: pointer;
	}

	/*
	 * Фокус клавіатурою мусить бути видимий, а сам `select` прозорий — тож рамку
	 * малює обгортка. Без цього рядка прапор у фокусі не відрізнявся б ніяк.
	 */
	.country--compact .country__row:focus-within {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}

	@media (hover: hover) {
		.country--compact .country__row:hover {
			background: color-mix(in srgb, var(--color-text), transparent 90%);
		}
	}
</style>
