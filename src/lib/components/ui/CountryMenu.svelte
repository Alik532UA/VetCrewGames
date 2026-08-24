<script lang="ts">
	import { untrack } from 'svelte';
	import { t, formatFont } from '$lib/i18n';
	import { loadAccountText } from '$lib/i18n/account';
	import { countriesByRegion, filterRegions, type RegionGroup } from '$lib/config/regions';
	import { settings } from '$lib/services/settings.svelte';
	import Flag from './Flag.svelte';

	/**
	 * ПАНЕЛЬ вибору країни: поле пошуку й 262 пункти, розбиті на регіони.
	 *
	 * ## Чому окремий файл від `CountryPicker.svelte`
	 *
	 * Шов тут не вигаданий під межу розміру, хоч вона його й виявила (391 SLOC
	 * при межі 300 у `structure.test.ts` § 7): кнопка знає, ЩО вибрано, а панель
	 * — ЯК вибирають. Розділені, вони не мають спільного стану взагалі: панель
	 * отримує поточне значення, віддає нове й гасне. Усе, що стосується
	 * клавіатури, прокрутки й пошуку, живе тут і не існує, поки панель закрита.
	 *
	 * ## Коробку задає БАТЬКО
	 *
	 * `position: absolute` тут, а `position: relative` — на `.country` у
	 * `CountryPicker.svelte`. Це єдина зв'язка між файлами, і вона названа: без
	 * неї панель відносилася б до першого позиційованого предка вище, тобто
	 * поїхала б у кут панелі-господаря.
	 */
	interface Props {
		/** Обраний код. Порожній рядок — «без прапора». Лише читається. */
		value: string;
		/** Основа `data-testid`, та сама, що в кнопки. */
		scope: string;
		/**
		 * Із чого починається пошук.
		 *
		 * Не завжди порожній: літера, натиснута на закритій кнопці, відкриває
		 * панель уже з нею — це те, що нативний `select` робив сам.
		 */
		seed?: string;
		onpick: (code: string) => void;
		onclose: () => void;
	}

	let { value, scope, seed = '', onpick, onclose }: Props = $props();

	/**
	 * РЯДКИ ПАНЕЛІ — З ЛІНИВОГО ЧАНКА, і словник тримається тут, а не приходить
	 * пропом.
	 *
	 * Чому чанк: головний словник стоїть рівно на межі бюджету (120 КБ gzip зі
	 * стелі 120), тож дев'ять нових ключів × чотири мови впали б на
	 * `npm run check:build`. Ключі живуть у `i18n/account/`, і `t()` про них не
	 * знає в принципі — він типізований по головному словнику.
	 *
	 * Чому НЕ проп, як у `auth/AuthForm.svelte`. Там перекладач передає сторінка,
	 * бо вона його вже має. Тут інакше: цей примітив стоїть на ДВОХ незв'язаних
	 * сторінках, і пропом його довелося б протягувати через `CountryPicker` та
	 * `OnlineGate` — тобто сторінка «Знайди пару» мусила б завантажувати словник
	 * акаунта заздалегідь і знати, що він їй для цього потрібен.
	 *
	 * ЗАСТЕРЕЖЕННЯ З ТОГО Ж ДОКБЛОКА ВИКОНАНО: у стані лежить СЛОВНИК, а
	 * перекладач похідний. Функція в `$state` не перемальовує — це вже коштувало
	 * екрана з ключами замість тексту.
	 */
	let dict = $state<Record<string, string>>({});
	const text = $derived((key: string) => dict[key] ?? key);

	$effect(() => {
		const wanted = settings.locale;
		void loadAccountText(wanted).then((loaded) => {
			// Мову могли перемкнути, поки чанк їхав: без перевірки пізніший запит
			// перетер би свіжіший результат.
			if (settings.locale === wanted) dict = loaded;
		});
	});

	/**
	 * ПОЧАТКОВІ ЗНАЧЕННЯ БЕРУТЬСЯ З ПРОПІВ РІВНО РАЗ — через `untrack`.
	 *
	 * Прямий `$state(seed)` компілятор не пускає (`state_referenced_locally`), і
	 * має рацію: так читається лише перше значення, а виглядає це як звʼязок.
	 * Тут одноразовість — саме те, що потрібно: панель існує від відкриття до
	 * закриття (`{#if open}` у `CountryPicker.svelte`), тобто кожне відкриття —
	 * новий екземпляр із новим початковим станом. `untrack` каже це вголос.
	 */
	let query = $state(untrack(() => seed));
	/**
	 * Куди клавіатуру поставили ОСТАННІМ натиском. Не те саме, що `active`.
	 *
	 * Порожній рядок означає пункт «без прапора» — те саме значення, що й у
	 * `value`.
	 */
	let cursor = $state(untrack(() => value));
	let panel = $state<HTMLElement | null>(null);
	let search = $state<HTMLInputElement | null>(null);

	/*
	 * Групи рахуються на вимогу мови, а не тримаються готовими: сортування назв
	 * колатором залежить від мови, а мову перемикають на цій самій сторінці.
	 * Заміряно: побудова всього переліку — 0,1–0,7 мс, тож кешувати нічого.
	 */
	const groups = $derived<RegionGroup[]>(countriesByRegion(settings.locale, t, text));
	const shown = $derived(filterRegions(groups, query, settings.locale));

	/**
	 * «Без прапора» видно, лише поки нічого не набрано.
	 *
	 * Це не країна, а свідома відповідь «не показувати», і під запит вона не
	 * підходить ніяк: рядок, який лишається на місці, що б ти не набрав,
	 * читається як збій фільтра. Заразом це дає «нічого не знайдено» право
	 * з'явитися — інакше в панелі завжди був би хоч один пункт.
	 */
	const withNone = $derived(query.trim() === '');

	/** Порядок, у якому по пунктах ходять стрілки. Той самий, що на екрані. */
	const order = $derived([
		...(withNone ? [''] : []),
		...shown.flatMap((group) => group.countries.map((country) => country.code))
	]);

	/**
	 * АКТИВНИЙ ПУНКТ ЗАВЖДИ ІСНУЄ, поки в списку є хоч один рядок.
	 *
	 * Це не дрібниця, а ВИПРАВЛЕНИЙ ДЕФЕКТ, знайдений заміром клавіатури:
	 * `cursor` починався з поточної країни, а після набору фільтр її викидав —
	 * тобто `aria-activedescendant` ставав нічим, і `Enter` після набору не
	 * вибирав НІЧОГО. Треба було спершу натиснути стрілку.
	 *
	 * Тепер клавіші пишуть у `cursor`, а на екран іде `active`: `cursor`, якщо він
	 * ще в списку, інакше перший рядок. Тобто набрав «нім» → Enter → Німеччина.
	 */
	const active = $derived(order.includes(cursor) ? cursor : (order[0] ?? ''));

	const optionId = (code: string) => `${scope}-opt-${code === '' ? 'none' : code}`;

	/** Пункт, на який стрілка перейде з поточного. Список закільцьований. */
	function step(by: number) {
		if (order.length === 0) return;
		const at = order.indexOf(active);
		cursor = order[(at + by + order.length) % order.length] ?? order[0];
	}

	/**
	 * Клавіатура на ПОЛІ ПОШУКУ — воно ж і є контролом, поки панель відкрита.
	 *
	 * `Tab` і `Shift+Tab` затримуються навмисно: поки панель відкрита, фокус із
	 * неї не виходить. Ціна названа: вихід лишається один — `Escape`, і саме
	 * тому він оголошений на полі через `aria-keyshortcuts`.
	 */
	function onKeydown(event: KeyboardEvent) {
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				step(1);
				break;
			case 'ArrowUp':
				event.preventDefault();
				step(-1);
				break;
			case 'Home':
				event.preventDefault();
				cursor = order[0] ?? '';
				break;
			case 'End':
				event.preventDefault();
				cursor = order.at(-1) ?? '';
				break;
			case 'Enter':
				event.preventDefault();
				if (order.includes(active)) onpick(active);
				break;
			case 'Escape':
				event.preventDefault();
				// Без цього Escape закрив би заразом і те, що стоїть вище в дереві.
				event.stopPropagation();
				onclose();
				break;
			case 'Tab':
				event.preventDefault();
				break;
		}
	}

	/**
	 * Активний пункт видно, а не «десь у прокрутці».
	 *
	 * `block: 'nearest'` — щоб крок стрілкою не смикав список на середину:
	 * прокрутка рухається рівно настільки, щоб пункт з'явився.
	 */
	$effect(() => {
		panel?.querySelector(`#${CSS.escape(optionId(active))}`)?.scrollIntoView({ block: 'nearest' });
	});

	/** Фокус заходить у поле пошуку, щойно панель з'явилася: стрілкам треба звідки почати. */
	function focusSearch(node: HTMLInputElement) {
		node.focus();
	}

	/**
	 * ФОКУС НЕ ВИХОДИТЬ ІЗ ПОЛЯ ПОШУКУ, ЩО Б У ПАНЕЛІ НЕ НАТИСНУЛИ.
	 *
	 * Один обробник на всю панель замість 262 на кожній кнопці, і він потрібен
	 * саме тому, що натискають не лише по пунктах: клік по заголовку регіону або
	 * по відступу панелі теж знімає фокус із поля — Chrome при `mousedown` на
	 * нефокусований елемент віддає фокус `body`. Після цього `Escape` і стрілки
	 * не діяли б, тобто панель, відкрита мишею, лишалася б без клавіатури.
	 *
	 * Поле пошуку — єдиний виняток: у ньому `mousedown` ставить каретку.
	 *
	 * `preventDefault` на `mousedown` НЕ скасовує наступний `click`, тож вибір
	 * пункту мишею працює як звичайно.
	 */
	function keepFocus(event: MouseEvent) {
		const target = event.target as Node | null;
		if (search && target && (target === search || search.contains(target))) return;
		event.preventDefault();
	}
</script>

<!--
	`onmousedown` тут не «клік по панелі», а ТРИМАЧ ФОКУСА — див. `keepFocus`.

	Тому й глушимо правило: воно вимагає ролі від елемента з обробником мишки, а
	роль тут була б неправдою — панель нічого не робить у відповідь на натиск,
	вона його СКАСОВУЄ. Клавіатурного дубля цьому обробнику не треба й не може
	бути: з клавіатури фокус із поля не виходить зовсім, бо `Tab` затримано.
-->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="menu" bind:this={panel} onmousedown={keepFocus} data-testid="{scope}-menu">
	<input
		type="text"
		class="menu__search"
		bind:this={search}
		bind:value={query}
		onkeydown={onKeydown}
		role="combobox"
		aria-expanded="true"
		aria-controls="{scope}-list"
		aria-activedescendant={order.includes(active) ? optionId(active) : undefined}
		aria-autocomplete="list"
		aria-label={text('account.countrySearch')}
		aria-keyshortcuts="Escape"
		placeholder={text('account.countrySearch')}
		autocomplete="off"
		spellcheck="false"
		data-testid="{scope}-search-input"
		{@attach focusSearch}
	/>

	<div class="menu__list" id="{scope}-list" role="listbox" aria-labelledby="{scope}-label">
		{#if withNone}
			<!--
				«Без прапора» — ПЕРШИЙ пункт, і він не порожній рядок на вигляд.

				Порожній пункт читається як «ще не вибрано», а це інше: тут це свідома
				відповідь «не показувати». Людина, яка не хоче називати країну, мусить
				бачити цей варіант названим, а не вгадувати.
			-->
			<button
				type="button"
				id={optionId('')}
				class="menu__option"
				class:menu__option--chosen={value === ''}
				class:menu__option--active={active === ''}
				role="option"
				aria-selected={value === ''}
				tabindex="-1"
				onclick={() => onpick('')}
				data-testid="{scope}-none-option"
			>
				<span class="menu__mark"></span>
				<span>{@html formatFont(t('pairs.countryNone'))}</span>
			</button>
		{/if}

		<!--
			НАЗВА ГРУПИ — в `aria-label`, а видимий заголовок `aria-hidden`.

			Не `aria-labelledby` на нього: `role="listbox"` за ARIA володіє лише
			`option` і `group`, тож заголовок усередині групи лишався б стороннім
			вузлом у дереві доступності — саме те, на що axe дає
			`aria-required-children`. Так назву чути один раз, а не двічі.
		-->
		{#each shown as group (group.id)}
			<div role="group" aria-label={group.name}>
				<div class="menu__region" aria-hidden="true">{@html formatFont(group.name)}</div>
				{#each group.countries as country (country.code)}
					<!--
						ПУНКТ — це `button` із роллю `option`, а не `div` з `onclick`.

						Причина не в чистоті: `div` з обробником кліку дає попередження
						компілятора `a11y_click_events_have_key_events`, а
						`svelte/valid-compile` тут стоїть у `error`. Заглушений обробник
						клавіш поруч із живим на полі пошуку був би кодом, який нічого не
						робить і виглядає, ніби робить.

						`tabindex="-1"` обов'язковий: без нього Tab ішов би по 262 кнопках,
						а керування списком лежить на полі пошуку через
						`aria-activedescendant`.
					-->
					<button
						type="button"
						id={optionId(country.code)}
						class="menu__option"
						class:menu__option--chosen={value === country.code}
						class:menu__option--active={active === country.code}
						role="option"
						aria-selected={value === country.code}
						tabindex="-1"
						onclick={() => onpick(country.code)}
						data-testid="{scope}-{country.code}-option"
					>
						<span class="menu__mark" aria-hidden="true">
							<Flag code={country.code} height={14} />
						</span>
						<span>{@html formatFont(country.name)}</span>
					</button>
				{/each}
			</div>
		{/each}
	</div>

	<!--
		«Нічого не знайдено» — ПОЗА списком, а не порожнім рядком у ньому.

		Причина та сама, що вище: у `role="listbox"` не буває вмісту, крім `option`
		і `group`. Абзац усередині нього — порушення `aria-required-children`,
		тобто читалка обіцяла б список, у якому один пункт, і він не пункт.
	-->
	{#if shown.length === 0}
		<p class="menu__empty" data-testid="{scope}-empty-text">
			{@html formatFont(text('account.countryNotFound'))}
		</p>
	{/if}
</div>

<style>
	/*
	 * ПАНЕЛЬ — над сторінкою, і саме тут теми знову щось означають: тло, рамка й
	 * колір тексту тепер НАШІ, тобто їх видно в `getComputedStyle` і їх міряє
	 * замір контрасту. Нативний випадний список не давав ні того, ні того.
	 *
	 * `z-index` вище за власну смугу прокрутки (`PageScrollbar` — 8000) і нижче
	 * за меню шапки (`HeaderMenu` — 9501): панель мусить накривати смугу, бо на
	 * сторінці акаунта дотягується майже до правого краю, і не мусить накривати
	 * меню, яке відкривають поверх усього.
	 *
	 * Ширина `max(100%, 16rem)`: у компактному режимі 100% — це 44px кнопки, тож
	 * панель бере свої 256px; у звичайному режимі вона рівна кнопці.
	 */
	.menu {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		z-index: 9500;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		width: max(100%, 16rem);
		max-width: min(88vw, 24rem);
		padding: var(--space-xs);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-bg-surface);
		box-shadow: var(--shadow-card-hover);
	}

	.menu__search {
		min-height: 44px;
		padding: 0 var(--space-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: var(--color-text);
		font: inherit;
		font-size: var(--font-size-sm);
	}

	.menu__search:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	/*
	 * ПІДКАЗКА В ПОЛІ — ПОВНИМ КОЛЬОРОМ ТЕКСТУ, і це не забудькуватість.
	 *
	 * Типова підказка браузера — `rgb(117, 117, 117)`, тобто той самий клас
	 * дефекту, від якого ми тут ідемо: колір, який не знає теми. Заміряно на
	 * `--color-bg-card`: 1.70:1 у `dark`, 1.53:1 у решти трьох при потрібних 4,5.
	 *
	 * Приглушити її НЕМА ЧИМ. Той самий замір по кандидатах:
	 *
	 * |               | dark | light-green | winter | orange-purple |
	 * | ------------- | ---- | ----------- | ------ | ------------- |
	 * | текст, 100%   | 6.23 | 5.04        | 4.67   | 5.86          |
	 * | текст, 90%    | 5.40 | 4.34        | 4.02   | 5.09          |
	 * | `--…-muted`   | 3.00 | 2.48        | 2.31   | 2.96          |
	 *
	 * Тобто вже на 90% `winter` і `light-green` падають нижче планки: у цієї теми
	 * пара «текст на картці» має всього 4,67 запасу. Тому колір повний, а «це
	 * підказка, а не введене» показує НАХИЛ — він контрасту не коштує нічого.
	 *
	 * `opacity: 1` обовʼязковий: Firefox приглушує підказку власною прозорістю
	 * поверх кольору, і без цього рядка число вище було б іншим саме там.
	 */
	.menu__search::placeholder {
		color: var(--color-text);
		opacity: 1;
		font-style: italic;
	}

	/*
	 * Висота списку — межа, а не вміст: 262 пункти по 44px це 11 500px.
	 *
	 * `60vh` лишає видимими і кнопку, і поле пошуку навіть на телефоні в
	 * горизонтальній орієнтації; `overscroll-behavior` не дає прокрутці
	 * «протекти» на сторінку, коли список дійшов до кінця.
	 */
	.menu__list {
		max-height: min(60vh, 22rem);
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	/*
	 * ЗАГОЛОВОК РЕГІОНУ ЛИПНЕ ДО ВЕРХУ СПИСКУ.
	 *
	 * У 262 пунктах головне питання — «де я зараз», і липкий заголовок
	 * відповідає на нього без жодної дії. Тло тут ОБОВʼЯЗКОВЕ й непрозоре:
	 * напівпрозоре давало б текст поверх назв країн, що проїжджають під ним.
	 */
	.menu__region {
		position: sticky;
		top: 0;
		z-index: 1;
		padding: var(--space-xs) var(--space-sm);
		background: var(--color-bg-surface);
		color: var(--color-text-muted);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-bold);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

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

	.menu__empty {
		margin: 0;
		padding: var(--space-sm);
		color: var(--color-text);
		font-size: var(--font-size-sm);
	}
</style>
