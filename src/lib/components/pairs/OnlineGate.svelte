<script lang="ts">
	import { Dices, Zap } from 'lucide-svelte';
	import { t, td, formatFont } from '$lib/i18n';
	import { randomCrewName } from '$lib/config/crewNames';
	import InputTools from '$lib/components/ui/InputTools.svelte';
	import SegmentedChoice from '$lib/components/ui/SegmentedChoice.svelte';

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
		/** Поки триває вхід, кнопки не приймають повторних натискань. */
		busy: boolean;
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
		busy,
		onCreate,
		onJoin,
		onQuickGame,
		roomList
	}: Props = $props();

	/** Код кімнати — рівно пʼять літер; коротший вводити ще не закінчили. */
	const CODE_LENGTH = 5;

	let nameInput = $state<HTMLInputElement | null>(null);
	let codeInput = $state<HTMLInputElement | null>(null);

	/**
	 * Код зводиться до великих літер ОДРАЗУ, у значенні, а не лише на вигляд.
	 *
	 * `text-transform: uppercase` міняє малюнок, але не рядок: у поле лишався б
	 * `abcde`, а `joinRoom` отримував би вже `ABCDE` після `toUpperCase()` на
	 * сторінці — два різні значення того самого поля. Головне ж, що кнопка «зайти»
	 * дивиться на ДОВЖИНУ: вставлений код із пробілом по краях («ABCDE ») давав
	 * шість символів, `maxlength` різав останню літеру, і кнопка лишалася сірою на
	 * правильному коді.
	 */
	const normaliseCode = (raw: string) => raw.trim().toUpperCase().slice(0, CODE_LENGTH);
</script>

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
	<section class="gate__panel">
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
		<div class="gate__field">
			<input
				id="pairs-name"
				type="text"
				bind:this={nameInput}
				bind:value={name}
				maxlength="24"
				placeholder={t('memory.you')}
				data-testid="pairs-name-input"
			/>
			<!--
				Кубик — теж усередині поля, хоч автор називав лише «вставити, копіювати,
				очистити». Одна кнопка зовні поруч із двома всередині виглядала б як
				недороблена: прохання було про те, щоб кнопки належали полю.

				Імʼя й далі підставляється саме, тож вигадувати його не мусять; кубик
				існує для того, кому підставлене не сподобалося, і віддає ГАРАНТОВАНО
				інше — інакше один кидок із шістнадцяти виглядав би як зламана кнопка.
			-->
			<button
				type="button"
				class="gate__field-btn"
				onclick={() => (name = randomCrewName(td, Math.random, name.trim()))}
				aria-label={t('pairs.otherName')}
				data-testid="pairs-name-random-btn"
			>
				<Dices size={16} aria-hidden="true" />
			</button>
			<InputTools
				bind:value={name}
				input={nameInput}
				tools={['paste', 'clear']}
				scope="pairs-name"
				fieldLabel={t('pairs.yourName')}
			/>
		</div>
	</section>

	<!-- ── 3. Створити кімнату ──────────────────────────────────────────────── -->
	<section class="gate__panel">
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
	<section class="gate__panel">
		<label class="gate__label" for="pairs-code">
			<span>{@html formatFont(t('pairs.roomCode'))}</span>
		</label>
		<div class="gate__field">
			<input
				id="pairs-code"
				type="text"
				bind:this={codeInput}
				bind:value={joinCode}
				oninput={() => (joinCode = normaliseCode(joinCode))}
				maxlength={CODE_LENGTH}
				class="gate__code"
				autocapitalize="characters"
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
			aria-disabled={busy || joinCode.trim().length < CODE_LENGTH}
			data-testid="pairs-join-btn"
		>
			{@html formatFont(t('pairs.joinRoom'))}
		</button>
	</section>

	<!-- ── 5. Список кімнат ─────────────────────────────────────────────────── -->
	{#if roomList}
		<section class="gate__panel">
			{@render roomList()}
		</section>
	{/if}
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
	 * Кнопка всередині поля — 32px.
	 *
	 * Менше за власний стандарт сенсорної цілі (44px), і це той самий свідомий
	 * виняток, що в `InputTools`: WCAG 2.5.8 (AA, 24×24) виконано з запасом, а
	 * 2.5.5 (AAA, 44×44) — ні, бо кнопка на 44px усередині поля на 44px не лишає
	 * місця самому тексту. Дія при цьому досяжна й інакше: імʼя можна просто
	 * ввести з клавіатури.
	 */
	.gate__field-btn {
		width: 32px;
		height: 32px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-text), transparent 92%);
		color: var(--color-text);
		cursor: pointer;
		padding: 0;
	}

	@media (hover: hover) {
		.gate__field-btn:hover {
			background: color-mix(in srgb, var(--color-text), transparent 82%);
		}
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
