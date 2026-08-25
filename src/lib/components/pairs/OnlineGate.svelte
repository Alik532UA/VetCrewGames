<script lang="ts">
	import { Dices, Zap } from 'lucide-svelte';
	import { t, formatFont } from '$lib/i18n';
	import InputTools from '$lib/components/ui/InputTools.svelte';
	import SegmentedChoice from '$lib/components/ui/SegmentedChoice.svelte';
	import CountryPicker from '$lib/components/ui/CountryPicker.svelte';

	/**
	 * Вхід у спільну партію.
	 *
	 * Компонент нічого не знає ні про базу, ні про кімнату — він збирає поля й
	 * кличе те, що дали. Виніс зі сторінки, коли та перетнула межу розміру файлу:
	 * форма існує рівно до появи матчу й далі не показується жодного разу.
	 *
	 * ## П'ЯТЬ ОКРЕМИХ БЛОКІВ, а не один із розділювачами
	 *
	 *   1. Швидка гра        — кнопка ЗВЕРХУ й БЕЗ власного тла
	 *   2. Хто я             — імʼя, спільне для всіх інших шляхів
	 *   3. Створити кімнату  — вибір «хто може зайти» + кнопка
	 *   4. Зайти за кодом    — поле коду + кнопка
	 *   5. Список кімнат     — те, що передали сніпетом
	 *
	 * Перша редакція була ОДНІЄЮ панеллю з рисками між блоками, і автор сказав про
	 * неї точно: «візуально один блок, просто розділений розділювачем». Риска
	 * всередині спільного тла читається як абзац, а не як інший вибір — а вибори
	 * тут взаємно виключні: створити кімнату АБО зайти в чужу АБО взяти зі списку.
	 * Тому кожен блок тепер має ВЛАСНЕ тло, і між ними видно проміжок сторінки.
	 *
	 * Швидка гра стоїть перша й без панелі свідомо: вона робить те саме, що решта
	 * блоків разом, тільки без вибору, і не є одним із них. Тому вона й не в
	 * контейнері — інакше читалася б як четвертий рівноправний варіант.
	 */
	interface Props {
		/** Імʼя гравця. Двобічне: сторінка його ще й памʼятає у сховищі. */
		name: string;
		/** Код кімнати, який ввели руками. */
		joinCode: string;
		/** Кімнату видно в списку чи вона лише за кодом. Двобічне. */
		isPrivate: boolean;
		/** Прапор гравця. Порожній рядок — без прапора. Двобічне. */
		country: string;
		/** Поки триває вхід, кнопки не приймають повторних натискань. */
		busy: boolean;
		/**
		 * Кубик: підставити інше імʼя.
		 *
		 * Робить це СТОРІНКА, а не компонент, і причина не в шаруванні: словник імен
		 * тепер довантажується окремим чанком (`i18n/crew`), а форма про
		 * завантаження нічого не знає й знати не мусить. Заразом сюда перестав
		 * протікати перелік зайнятих імен — він теж із мережі.
		 */
		onRandomName: () => void;
		onCreate: () => void;
		onJoin: () => void;
		/**
		 * Зайти у вільну кімнату або створити нову. Кнопку малює цей компонент, а
		 * мережу знає сторінка — сюди приходить лише виклик.
		 */
		onQuickGame: () => void;
		/**
		 * Список кімнат — пʼятий блок. Його малює СТОРІНКА: вона знає мережу.
		 *
		 * `roomList`, а не `rooms`: це сніпет, а не дані, і поруч на сторінці живе
		 * стан із назвою `rooms` — сніпет-проп мусив би збігтися з ним імʼям.
		 */
		roomList?: import('svelte').Snippet;
	}

	let {
		name = $bindable(),
		joinCode = $bindable(),
		isPrivate = $bindable(),
		country = $bindable(),
		busy,
		onRandomName,
		onCreate,
		onJoin,
		onQuickGame,
		roomList
	}: Props = $props();

	/**
	 * Код кімнати — ЦИФРИ, і довжина в нього різна.
	 *
	 * Публічна кімната має два розряди (сто варіантів — код тут не секрет, а
	 * зручність), приватна пʼять (там код і є пароль). Розряд публічних росте
	 * сам, коли простір вичерпано, — тому верхня межа тут пʼять, а не «стільки,
	 * скільки зараз генерується»: поле мусить приймати будь-який чинний код.
	 *
	 * Числа названо джерелом правди в `net/rtdbRoom.ts`; тут вони повторюються
	 * навмисно, бо форма про мережу не знає нічого (див. докблок компонента), а
	 * розходження ловить `src/room-code.test.ts`.
	 */
	const CODE_MIN = 2;
	const CODE_MAX = 5;

	let nameInput = $state<HTMLInputElement | null>(null);
	let codeInput = $state<HTMLInputElement | null>(null);

	/**
	 * Код зводиться до ЦИФР одразу, у значенні, а не лише на вигляд.
	 *
	 * Доти тут стояв `toUpperCase()` — код був літерним, і `text-transform`
	 * змінив би лише малюнок: у полі лишався б `abcde`, а мережа отримувала б
	 * `ABCDE`, тобто два різні значення того самого поля.
	 *
	 * Тепер причина та сама, а дія інша: усе, крім цифр, ВИКИДАЄТЬСЯ. Це
	 * закриває найчастіший спосіб принести сміття — вставку з мессенджера, де
	 * код приїжджає разом із пробілами, дефісами й «код: ». Кнопка «зайти»
	 * дивиться на довжину, тож саме такий рядок робив її сірою на правильному
	 * коді.
	 *
	 * Провідні нулі зберігаються: «07» — чинний двоцифровий код, і числом цей
	 * рядок не стає ніде.
	 */
	const normaliseCode = (raw: string) => raw.replace(/\D/g, '').slice(0, CODE_MAX);
</script>

<!--
	ОБГОРТКА ІСНУЄ ЗАРАДИ ОДНОГО РЯДКА CSS — `container-type` на ній.

	Три стовпці залежать від того, скільки місця ДАЛИ формі, а не від того, який
	у людини екран. Медіазапит цієї різниці не бачить: та сама форма у вузькій
	колонці на широкому екрані отримала б розкладку «як на десктопі» й
	розсипалася б (FLUID-SIZING-v8, `FS-CONTAINER`).

	Контейнером не може бути сама `.gate`: запит дивиться на предка, а ширина
	`.gate` — це рівно те, що ми міняємо. Звідси зайвий на вигляд `<div>`: він не
	малює нічого, він лише оголошує, що місце міряється тут.
-->
<div class="gate-shell">
	<div class="gate">
		<!--
		── 1. ШВИДКА ГРА ─────────────────────────────────────────────────────────

		Без панелі, як просив автор. Підпис-пояснення теж не в панелі — його тут
		немає взагалі, і це не втрата: текст поза панеллю ліг би просто на
		фотографію тла (`src/backdrop.test.ts` таке й не пустить), а сама кнопка з
		блискавкою й назвою зрозуміла без абзацу. Подробиця лишилася в `title` —
		для того, хто її шукає.
	-->
		<button
			type="button"
			class="gate__quick"
			onclick={onQuickGame}
			aria-disabled={busy}
			title={t('pairs.quickGameHint')}
			data-testid="pairs-quick-btn"
		>
			<Zap size={20} aria-hidden="true" />
			{@html formatFont(t('pairs.quickGame'))}
		</button>

		<!-- ── 2. Хто я ─────────────────────────────────────────────────────────── -->
		<section class="gate__panel gate__panel--name">
			<label class="gate__label" for="pairs-name">
				<span>{@html formatFont(t('pairs.yourName'))}</span>
			</label>
			<!--
			КНОПКИ — ЧАСТИНА ПОЛЯ, а не сусіди праворуч від нього.

			Рамку й тло малює ОБГОРТКА, а не сам `input`, тож кнопки стоять усередині
			тієї самої рамки — саме той вигляд, що в `teatralo4ka`, на який показав
			автор. Там це зроблено накладанням (`position: absolute` плюс
			зарезервований `padding-right`), бо рамку там малює саме поле; тут обгортку
			пишемо ми, і ряд flex дає те саме без жодного магічного відступу — кнопки
			з'являються й зникають, а поле просто перетікає.

			`:focus-within` на обгортці ОБОВʼЯЗКОВИЙ: рамка більше не на полі, тож без
			цього рядка фокус клавіатурою став би невидимим.
		-->
			<div class="gate__row">
				<!--
				ПРАПОР — ПЕРЕД НІКОМ, а не окремим рядком.
				
				Окремий рядок із підписом «Прапор» читався як ще одне налаштування
				кімнати, хоч це частина того самого підпису гравця: прапор і імʼя — одна
				річ, яку бачать інші. Тепер вони й стоять як одна.
			-->
				<CountryPicker bind:value={country} scope="pairs-country" compact />
				<div class="gate__field has-input-tools">
					<input
						id="pairs-name"
						type="text"
						bind:this={nameInput}
						bind:value={name}
						maxlength="48"
						placeholder={t('pairs.nickname')}
						data-testid="pairs-name-input"
					/>
					<InputTools
						bind:value={name}
						input={nameInput}
						tools={['paste', 'clear']}
						scope="pairs-name"
						fieldLabel={t('pairs.yourName')}
					/>
				</div>
				<!--
				КУБИК — ПОЗА ПОЛЕМ, праворуч від нього, і це вибір автора.

				Я був поставив його всередину заодно з «вставити» й «очистити», бо одна
				кнопка зовні поруч із двома всередині здалася недоробленою. Автор
				повернув назовні, і в цьому є своя логіка: «вставити» й «очистити» діють
				на ТЕКСТ, який уже в полі, а кубик пише туди НОВЕ значення. Різна природа
				— різне місце.

				44px, а не 32: поза полем місце є, а власний стандарт сенсорної цілі
				(ACCESSIBILITY-v8 § 8) виняток вимагає лише там, де його нема куди
				подіти.

				Імʼя й далі підставляється саме, тож вигадувати його не мусять; кубик
				існує для того, кому підставлене не сподобалося, і віддає ГАРАНТОВАНО
				інше — інакше один кидок із вісімдесяти шести виглядав би як зламана
				кнопка.

				ЗАЙНЯТІ ІМЕНА ТЕЖ ВИКЛЮЧАЮТЬСЯ, але вирішує це сторінка: перелік тих,
				хто вже онлайн, приходить із мережі. Кидок, що віддав уже видане імʼя,
				технічно правильний і практично шкідливий — два однакових рядки в
				списку роблять неможливим вибір «до кого зайти».
			-->
				<button
					type="button"
					class="gate__dice"
					onclick={onRandomName}
					aria-label={t('pairs.otherName')}
					data-testid="pairs-name-random-btn"
				>
					<Dices size={18} aria-hidden="true" />
				</button>
			</div>

			<!--
			ПРАПОР — У ТОМУ САМОМУ БЛОЦІ, що імʼя.
		
			Це одна відповідь на одне питання — «як мене видно іншим», — і саме
			тому вони поруч, а не в окремій панелі. Окремий блок читався б як ще
			один спосіб зайти в кімнату, а це не спосіб зайти, а підпис.
		-->
		</section>

		<!-- ── 3. Створити кімнату ──────────────────────────────────────────────── -->
		<section class="gate__panel gate__panel--create">
			<!--
			ДВА НАЗВАНІ СТАНИ, а не прапорець. Стоять ПЕРЕД кнопкою, і це не смак:
			вибір міняє те, що кнопка зробить, тож прочитати його треба до натиску.

			Прапорець «закрита кімната» був гірший двома речами. По-перше, він називав
			лише один стан із двох: що означає ЗНЯТИЙ прапорець, доводилося
			домислювати. По-друге, слово «закрита» описує механіку, а не намір — а
			намір у людини рівно один із двох, і саме його тепер видно обома написами.

			«ЛИШЕ ДРУЗІ» — це кімната поза списком, у яку заходять за кодом, що ви
			комусь надішлете. Тут немає й не може бути справжнього переліку друзів:
			акаунтів у проєкті немає взагалі (`net/firebase.ts` — `signInAnonymously`),
			тож «друзі» означає рівно «ті, кому ви дали код». Підказка нижче каже це
			прямо, щоб напис на кнопці не обіцяв більше, ніж робить.

			Типовий стан — «для всіх». Кімната поза списком потребує, щоб код комусь
			передали; кімната в списку не потребує нічого, і саме вона робить корисними
			і список, і швидку гру.
		-->
			<SegmentedChoice
				legend={t('pairs.visibility')}
				scope="pairs-visibility"
				value={isPrivate ? 'friends' : 'everyone'}
				onchange={(id) => (isPrivate = id === 'friends')}
				options={[
					{ id: 'friends', label: t('pairs.friendsOnly') },
					{ id: 'everyone', label: t('pairs.everyone') }
				]}
			/>
			<p class="gate__hint">{@html formatFont(t('pairs.visibilityHint'))}</p>

			<button
				type="button"
				class="btn-primary"
				onclick={onCreate}
				aria-disabled={busy}
				data-testid="pairs-create-btn"
			>
				{@html formatFont(t('pairs.createRoom'))}
			</button>
		</section>

		<!-- ── 4. Зайти за кодом ────────────────────────────────────────────────── -->
		<section class="gate__panel gate__panel--join">
			<label class="gate__label" for="pairs-code">
				<span>{@html formatFont(t('pairs.roomCode'))}</span>
			</label>
			<!--
			`inputmode="numeric"` — цифрова клавіатура на телефоні.

			Не `type="number"`: той дає стрілки збільшення, ковтає провідні нулі («07»
			стало б «7») і на частині браузерів приймає `e` та знак мінус. Код — це
			рядок цифр, а не число, і саме тому `type` лишається `text`.
		-->
			<div class="gate__field has-input-tools">
				<input
					id="pairs-code"
					type="text"
					bind:this={codeInput}
					bind:value={joinCode}
					oninput={() => (joinCode = normaliseCode(joinCode))}
					maxlength={CODE_MAX}
					class="gate__code"
					inputmode="numeric"
					pattern="[0-9]*"
					autocomplete="off"
					spellcheck="false"
					data-testid="pairs-code-input"
				/>
				<InputTools
					bind:value={joinCode}
					input={codeInput}
					scope="pairs-code"
					fieldLabel={t('pairs.roomCode')}
					onchange={(raw) => (joinCode = normaliseCode(raw))}
				/>
			</div>

			<button
				type="button"
				class="btn-primary"
				onclick={onJoin}
				aria-disabled={busy || joinCode.trim().length < CODE_MIN}
				data-testid="pairs-join-btn"
			>
				{@html formatFont(t('pairs.joinRoom'))}
			</button>
		</section>

		<!-- ── 5. Список кімнат ─────────────────────────────────────────────────── -->
		{#if roomList}
			<section class="gate__panel gate__panel--rooms">
				{@render roomList()}
			</section>
		{/if}
	</div>
</div>

<style>
	/*
	 * Сама форма БІЛЬШЕ НЕ ПАНЕЛЬ — вона лише стовпчик із проміжками.
	 *
	 * Тло переїхало на кожен блок окремо, і саме це відрізняє «різні контейнери»
	 * від «один блок із рисками»: між панелями видно сторінку.
	 */
	.gate {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		width: 100%;
		max-width: 22rem;
	}

	/*
	 * ТРИ СТОВПЦІ НА ШИРОКОМУ ЕКРАНІ — і саме такі, як просив автор.
	 *
	 * Скарга була про пусте: «в один стовпчик, а праворуч і ліворуч купа вільного
	 * місця». Так і було — 22rem посеред тисячі пікселів, а нижче списку кімнат
	 * доводилося скролити до того, що з ним роблять.
	 *
	 * Розкладка названа автором дослівно: лівий стовпець — «Код кімнати» плюс «Хто
	 * може зайти», середина — «Швидка гра» плюс «Як вас звати?», правий — «Кімнати».
	 * Тобто ліворуч ДІЇ (зайти або створити), у центрі — хто я і найкоротший шлях у
	 * гру, праворуч — вибір із того, що вже є.
	 *
	 * ЧОМУ `grid-template-areas`, А НЕ ТРИ `div`-СТОВПЦІ. Обгортки змінили б і
	 * мобільний порядок: блоки стали б групуватися по стовпцях, і «Швидка гра»
	 * поїхала б із першого місця в середину сторінки. Сітка розставляє ті самі
	 * вузли, не торкаючись розмітки, тож вузький екран лишається таким, як був —
	 * швидка гра, імʼя, створити, зайти, кімнати.
	 *
	 * Межа 64rem — не смак: три стовпці по 20rem плюс два проміжки вимагають
	 * приблизно стільки, а нижче вони почали б тиснути поле коду й кнопки.
	 *
	 * `@container`, а не `@media`: тут ідеться про місце, яке дали формі, а не про
	 * екран. Різницю видно там, де форму вставляють у вужчий стовпець — тоді
	 * медіазапит однаково побачив би широкий екран і дав три колонки в колонку на
	 * 30rem. Це перший погашений рядок боргу з `src/container-queries.test.ts`.
	 * `align-items: start` обовʼязковий: без нього панелі в рядку тягнуться до
	 * висоти найвищої, і «Швидка гра» стала б кнопкою на пів екрана.
	 */
	/*
	 * Контейнер оголошений на обгортці, а не на самій формі: запит дивиться на
	 * ПРЕДКА, а ширина `.gate` — це те, що він і вирішує.
	 */
	.gate-shell {
		container-type: inline-size;
		width: 100%;
	}

	@container (min-width: 64rem) {
		.gate {
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			grid-template-areas:
				'join quick rooms'
				'create name rooms';
			align-items: start;
			max-width: none;
		}

		/*
		 * Місце кожному блоку — по порядку розмітки: швидка гра, імʼя, створити,
		 * зайти, кімнати. Селектори за класом, а не `:nth-child`, саме тому, що
		 * порядок у розмітці й порядок на екрані тут РІЗНІ.
		 */
		.gate__quick {
			grid-area: quick;
		}

		.gate__panel--name {
			grid-area: name;
		}

		.gate__panel--create {
			grid-area: create;
		}

		.gate__panel--join {
			grid-area: join;
		}

		.gate__panel--rooms {
			grid-area: rooms;
		}
	}

	.gate__panel {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: var(--space-md);
		border-radius: var(--radius-md);
		background: var(--color-bg-panel);
		box-shadow: var(--shadow-card);
	}

	/*
	 * Швидка гра — акцентом і без панелі.
	 *
	 * Власне тло в неї є (акцент), тож текст на фотографії не лежить; але це тло
	 * САМОЇ КНОПКИ, а не контейнера навколо неї — рівно те, що просив автор.
	 */
	.gate__quick {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		min-height: 48px;
		border: none;
		border-radius: var(--radius-md);
		background: var(--color-accent);
		color: var(--color-text-on-accent);
		font: inherit;
		font-weight: var(--font-weight-bold);
		font-size: var(--font-size-lg);
		box-shadow: var(--shadow-card);
		cursor: pointer;
	}

	@media (hover: hover) {
		.gate__quick:hover {
			background: var(--color-accent-hover);
		}
	}

	.gate__label {
		font-size: var(--font-size-sm);
		color: var(--color-text-on-panel);
	}

	/* Поле й кубик поруч: розтягується поле, кубик лишається свого розміру. */
	.gate__row {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
	}

	.gate__row .gate__field {
		flex: 1;
		min-width: 0;
	}

	.gate__dice {
		width: 44px;
		height: 44px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-text), transparent 92%);
		color: var(--color-text);
		cursor: pointer;
		padding: 0;
	}

	@media (hover: hover) {
		.gate__dice:hover {
			background: color-mix(in srgb, var(--color-text), transparent 82%);
		}
	}

	/*
	 * ОБГОРТКА ПОЛЯ несе рамку, тло й фокус; сам `input` — прозорий і без рамки.
	 *
	 * Саме це й робить кнопки частиною поля: вони стоять у тому самому ряду, у
	 * межах тієї самої рамки.
	 */
	.gate__field {
		display: flex;
		align-items: center;
		gap: 2px;
		/* 4px праворуч — щоб кнопки не торкалися рамки зсередини. */
		padding-right: 4px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
	}

	/* Фокус видно на ОБГОРТЦІ: рамки на полі більше немає. */
	.gate__field:focus-within {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	.gate__field input {
		flex: 1;
		/* `min-width: 0` — щоб поле стискалося замість розпирати ряд кнопками. */
		min-width: 0;
		min-height: 44px;
		padding: 0 var(--space-sm);
		border: none;
		background: none;
		color: var(--color-text);
		font: inherit;
	}

	/* Рамку тепер малює обгортка, і друга рамка від фокусу поля була б подвійною. */
	.gate__field input:focus {
		outline: none;
	}

	/*
	 * Підказка приглушена КЕГЛЕМ, а не прозорістю.
	 *
	 * `opacity: 0.75` тут давало 3.75:1 при потрібних 4.5, і жодне значення
	 * прозорості пари не рятує: панель `#93bf4c` / `#80b3ff` сама світлий півтон.
	 * Заміряно `tests/contrast-runtime.spec.ts`.
	 */
	.gate__hint {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-on-panel);
	}

	/* Код диктують уголос і вводять великими: так його й показуємо. */
	.gate__code {
		text-transform: uppercase;
		letter-spacing: 0.25em;
	}
</style>
