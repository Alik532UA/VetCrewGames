<script lang="ts">
	import { formatFont } from '$lib/i18n';
	import type { Member } from '$lib/net/roomTypes';
	import Flag from '$lib/components/ui/Flag.svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import GameDialog from '$lib/components/ui/GameDialog.svelte';

	/**
	 * ВІКНО ОЧІКУВАННЯ: кого чекаємо, скільки ще, і рішення грати далі.
	 *
	 * ## Що воно тепер таке
	 *
	 * ОДИН РЯДОК і одна кнопка. Доти тут стояли заголовок «Немає звʼязку», список
	 * зниклих, питання й кнопка — чотири блоки про одне, і автор назвав це «багато
	 * шумної дублюючої інформації». Прапор з аватаркою вже кажуть, що йдеться про
	 * людину; слово «чекаємо» — що саме з нею.
	 *
	 * ## Партія СТОЇТЬ, поки це вікно висить
	 *
	 * Це змінилося проти першої редакції, і змінилося на вимогу автора. Доти вікно
	 * було повідомленням: раунд закінчувався, коли відповіли ПРИСУТНІ, а зниклого
	 * ніхто не чекав. Тепер раунд стоїть, а рішення «грати далі» ухвалює БІЛЬШІСТЬ
	 * присутніх — причина в житті: гравець перезавантажує комп'ютер, і 15 секунд на
	 * це не хватає нікому.
	 *
	 * Пауза при цьому не місцева: її тривалість дописує в журнал кожен гравець, а
	 * перепрогін бере найбільше, тож дедлайн однаковий в усіх — включно з тим, хто
	 * повернувся, і з тим, хто сам щойно був ведучим (`QuizMatch.setHold`).
	 *
	 * ## Відлік НЕ обриває чекання — він відкриває кнопку
	 *
	 * За його межею партія й далі стоїть, але зʼявляється рішення. Пільга при цьому
	 * НАКОПИЧУВАЛЬНА: гравець, який уже зникав, наступного разу отримує лише решту
	 * (`utils/awayWait`) — інакше зникати на чотирнадцять секунд можна було
	 * безкінечно.
	 *
	 * КНОПКА «ВИКЛЮЧИТИ» ЛИШЕ ПІСЛЯ ВІДЛІКУ, і це не обережність: обрив звʼязку на
	 * пару секунд трапляється в кожного, а прибраний опиняється на формі входу
	 * (`roomPolicies`, «мене прибрали»). Зайти знову він може — і тоді його відповіді
	 * з журналу рахуються знову: журнал ходів не забуває, а виключення тут не
	 * покарання, а спосіб не чекати зниклого. (Доти тут стояло «вертається вже без
	 * свого рахунку» — перепрогін такого не робив ніколи, аудит 2026-09-24.)
	 *
	 * Правило бази дозволяє господареві саме ВИДАЛЕННЯ чужого рядка складу, а не
	 * зміну: переписати чуже імʼя, прапор чи роль він не може. СЕБЕ в цьому вікні
	 * не видно зовсім (`QuizMatch.awayOthers`): власну відсутність показує смуга
	 * «немає звʼязку», а кнопка «прибрати себе» лишала господаря без права ходу.
	 */
	interface Props {
		/**
		 * Перекладач вікторини: її рядки лежать у ЛІНИВОМУ чанку
		 * (`i18n/quiz`), бо головний словник вантажать усі відвідувачі.
		 */
		text: (key: string) => string;
		/** Кого немає онлайн. Порожньо — вікна немає зовсім. */
		away: Member[];
		/** Скільки секунд лишилося з пільгового часу. `0` — вичерпано. */
		secondsLeft: number;
		/**
		 * ЧИ ЧЕКАЄ ПАРТІЯ САМЕ ЗАРАЗ. Від цього залежить, чи вікно ІСНУЄ.
		 *
		 * Не «як воно виглядає»: вікно існує, щоб ЗАПИТАТИ. Щойно відповідь є (голоси
		 * зібрані, зниклий відповів або повернувся), запитувати нема чого — і вікно
		 * зникає ЦІЛКОМ. Хто саме офлайн, і далі видно, але іншим засобом: притишеним
		 * рядком у переліку гравців. Він показує СТАН, а не питає.
		 */
		waiting: boolean;
		/** Скільки присутніх уже проголосували «граємо далі». */
		voted: number;
		/** Скільки голосів потрібно — більшість присутніх. */
		needed: number;
		/** Чи мій голос уже врахований. */
		iVoted: boolean;
		/**
		 * Мій голос «грати далі» — від будь-кого присутнього ГРАВЦЯ, не лише лідера.
		 * `undefined` — я глядач, і кнопки немає: мого голосу перепрогін не рахує.
		 */
		onGoOn?: () => void;
		/**
		 * ХТО ПОСТАВИВ ПАУЗУ — і `null`, якщо це просто зникнення.
		 *
		 * Вікно те саме навмисно: стан однаковий («партія стоїть, і ось чому»), і
		 * тримати два майже однакові вікна означало б розійтися в них першою ж
		 * правкою. Різниця в одному рядку тексту й у тому, чия кнопка.
		 */
		pausedBy?: Member | null;
		/**
		 * Зняти СВОЮ паузу. `undefined` — паузу ставив не я.
		 *
		 * Автор паузи знімає її ОДРАЗУ, не чекаючи відліку: він її й ставив. Решта
		 * чекає, поки відлік відкриє «грати далі» — і це та сама асиметрія, яку
		 * просив автор.
		 */
		onResume?: () => void;
		/**
		 * Прибрати гравця з кімнати. `undefined` — я не лідер, і кнопки немає.
		 *
		 * Не `disabled`: кнопка, якої натиснути не можна, у гостя лише питала б, чому
		 * вона там стоїть.
		 */
		onkick?: (uid: string) => void;
		/**
		 * ВІКНО «ЗАДОВГО ДУМАЄ» замість «Чекаємо» (`QuizIdle`, `utils/idleWait`): ті, кого
		 * перелічено, на звʼязку, але думають довше за подвійну приховану межу «Не
		 * обмежений». Відліку немає — межа вже минула, — тож «Продовжити» одразу, а
		 * прибирати тут нікого. Питання й слова — як просив автор 2026-09-28: хто задовго
		 * думає, і чи продовжити гру без цієї відповіді.
		 */
		idle?: boolean;
		/**
		 * «Чекати ще хвилину» — лише у вікні «Задовго думає»: згорнути його для себе, щоб
		 * дочитати відповідь (`QuizIdle` тримає хвилину й смугу знизу).
		 */
		onSnooze?: () => void;
	}

	let {
		text,
		away,
		secondsLeft,
		waiting,
		voted,
		needed,
		iVoted,
		onGoOn,
		onkick,
		pausedBy = null,
		onResume,
		idle = false,
		onSnooze
	}: Props = $props();

	/** Один чи кілька: від цього залежить форма дієслова й питання (імен без родів). */
	const many = $derived(away.length > 1);

	/** Про що рядок над іменами: хто задовго думає, хто поставив паузу чи кого чекаємо. */
	const label = $derived(
		idle ? (many ? 'quiz.idleMany' : 'quiz.idleOne') : pausedBy ? 'quiz.pauseBy' : 'quiz.awayWait'
	);

	/** Напис на кнопці: чи мій голос уже врахований — і, у «Задовго думає», «Продовжити». */
	const goOnLabel = $derived(
		idle && !iVoted ? 'quiz.idleGoOn' : iVoted ? 'quiz.awayVoted' : 'quiz.awayGoOn'
	);

	/** Кого показує рядок: автора паузи або тих, кого немає. */
	const listed = $derived(pausedBy ? [pausedBy] : away);
</script>

{#if waiting && listed.length > 0}
	<!--
		ВІКНО ІСНУЄ, ЛИШЕ ПОКИ ПАРТІЯ ЧЕКАЄ — і тому підкладка тут беззастережна.

		Доти тут було два стани: по центру з підкладкою — поки чекаємо, і смуга над дошкою —
		коли «граємо далі без нього». Другий стан і був помилкою: панель висіла над грою вже
		після того, як рішення ухвалили, і питала те, на що відповіли. Тепер відповідь
		означає зникнення вікна, а не зміну його вигляду.
	-->
	<GameDialog testId="quiz-away-backdrop">
		<!--
			ВІКНО НА ПІВ ЕКРАНА, А НЕ ПІГУЛКА (прохання автора 2026-09-27: «чому у нас 95%
			порожнє, а ми мілким елементом пишемо інформацію?»). Доти тут був один рядок
			кеглем `sm` — 207×37 px на ноутбуці, 0,8% екрана, — а все довкола розмите. Тепер
			`.fill .fill-window`: вікно бере понад 30% екрана, кегель росте з ним, а людина,
			яку чекаємо, — велика аватарка з іменем, і відлік — число, яке видно з кімнати.

			Слів лишилося стільки ж: «Чекаємо:», хто, скільки. Доти тут стояли заголовок
			«Немає звʼязку», список зниклих, питання й кнопка — автор назвав це «багато
			шумної дублюючої інформації». Більшим стало те, що є, а не додалося нове.

			ІМЕНА, А НЕ ЗАЙМЕННИКИ. «Чекаємо на нього» брехало щоразу, коли зникала жінка:
			імена в проєкті випадкові з обох родів. Без прийменника — «Чекаємо: Могутній
			Бізон» — і граматика ціла, і рід ні до чого.
		-->
		<section class="away text-panel fill fill-window" role="status" data-testid="quiz-away-panel">
			<p class="away__label">
				{@html formatFont(text(label))}
			</p>

			<ul class="away__people">
				{#each listed as member (member.uid)}
					<li class="away__who" data-testid="quiz-away-{member.uid}-item">
						<Avatar avatar={member.avatar} size={56} showDefault />
						<span class="away__name">
							<Flag code={member.country} height={19} />
							{member.name}
						</span>
					</li>
				{/each}
			</ul>

			{#if idle}
				<!--
					ПИТАННЯ СЛОВАМИ (прохання автора 2026-09-28): «задовго думає над відповіддю,
					продовжити гру без їх відповіді?». «Без цієї відповіді», а не «без його» чи «без
					її»: імена тут випадкові з обох родів, а займенник угадував би.
				-->
				<p class="away__ask" data-testid="quiz-idle-ask-text">
					{@html formatFont(text(many ? 'quiz.idleAskMany' : 'quiz.idleAskOne'))}
				</p>
			{/if}

			{#if secondsLeft > 0}
				<!--
					Число окремим елементом: воно змінюється щосекунди, і читалка мусить
					оголосити зміну, а не перечитувати весь рядок.
				-->
				<b class="away__count away__count--timer" data-testid="quiz-away-timer-value">
					{secondsLeft}
				</b>
			{/if}

			{#if onResume}
				<!--
					КНОПКА АВТОРА ПАУЗИ — без відліку. Він її ставив, він і знімає; чекати
					власного дозволу було б безглуздо.
				-->
				<button
					type="button"
					class="away__goon"
					onclick={onResume}
					data-testid="quiz-pause-resume-btn"
				>
					{@html formatFont(text('quiz.pauseResume'))}
				</button>
			{/if}

			{#if secondsLeft === 0 && onGoOn}
				<!--
					ВІДЛІК ВИЧЕРПАНО — і саме тут з'являється рішення, а не автоматичний
					перехід. Кнопка одна на всіх присутніх; лічильник поруч показує, чого
					вона чекає, бо кнопка без числа виглядала б як «натиснув і не працює».

					НА КНОПЦІ НЕМА ІМЕН НАВМИСНО. «Продовжити без них» неправильне для
					одного, «без нього» вертає рід, а імʼя в кнопці повторює рядок вище —
					тобто той самий шум, від якого ми щойно пішли. «Грати далі» коротке,
					гендерно чисте й не залежить від кількості зниклих.
				-->
				<div class="away__actions">
					<button
						type="button"
						class="away__goon"
						disabled={iVoted}
						onclick={onGoOn}
						data-testid="quiz-away-goon-btn"
					>
						{@html formatFont(text(goOnLabel))}
						<b class="away__count" data-testid="quiz-away-goon-count">{voted}/{needed}</b>
					</button>

					{#if idle && onSnooze}
						<!--
							«ЧЕКАТИ ЩЕ ХВИЛИНУ» — рішення лише для себе: вікно згортається в смугу, і
							відповідь можна дочитати (автор: «вікно закривається і можна далі читати
							результати»). Голосом це не є, тож лічильника тут немає.
						-->
						<button
							type="button"
							class="away__snooze btn-secondary"
							onclick={onSnooze}
							data-testid="quiz-idle-snooze-btn"
						>
							{@html formatFont(text('quiz.idleSnooze'))}
						</button>
					{/if}
				</div>

				{#if onkick && !pausedBy && !idle}
					<!-- Лідер може прибрати зниклого назовсім — це інша дія, ніж «грати далі». -->
					<div class="away__kicks">
						{#each away as member (member.uid)}
							<button
								type="button"
								class="away__kick btn-secondary"
								onclick={() => onkick(member.uid)}
								data-testid="quiz-away-{member.uid}-btn"
							>
								{@html formatFont(text('quiz.awayKick'))}: {member.name}
							</button>
						{/each}
					</div>
				{/if}
			{/if}
		</section>
	</GameDialog>
{/if}

<style>
	/* Підкладка — `ui/GameDialog`: вона одна на всі вікна поверх гри. */

	/*
	 * Розмір вікна — `.fill-window` (global.css): щонайменше 60% ширини й 52% висоти, тобто
	 * понад 30% екрана; кегель — `.fill`. Імʼя не обрізається нічим: колись його різав
	 * `max-width: 12ch`, і «Могутній Бізон» ставав «Могутній Бі…» — рівно те, заради чого
	 * вікно існує. Довге імʼя переноситься, а не ховається.
	 */
	.away {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-lg);
		overflow-y: auto;
		text-align: center;
	}

	.away__label {
		margin: 0;
		font-size: var(--font-size-2xl);
		font-weight: var(--font-weight-bold);
	}

	.away__people {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-lg);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/*
	 * Аватарка й прапор ростуть з одиницею: 56 і 19 у розмітці — це телефонна одиниця, а
	 * змінна `--avatar-box` і висота прапора в CSS перебивають їх на більшому екрані.
	 */
	.away__who {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-sm);
		--avatar-box: calc(var(--fill-u) * 3.5);
	}

	.away__who :global(.flag) {
		width: auto;
		height: calc(var(--fill-u) * 1.2);
	}

	.away__name {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: var(--space-xs);
		font-size: var(--font-size-xl);
		font-weight: var(--font-weight-bold);
		overflow-wrap: anywhere;
	}

	/* Відлік — число, яке видно з іншого кінця кімнати: воно й відповідає «скільки ще». */
	.away__count--timer {
		font-size: calc(var(--fill-u) * 4);
		line-height: 1;
	}

	/*
	 * Кнопка рішення — акцентна, бо це єдина дія у вікні, яка щось міняє.
	 * `disabled` після свого голосу: повторний натиск нічого не додає (журнал
	 * рахує один голос на гравця), і кнопка мусить це показувати, а не мовчати.
	 */
	.away__goon {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		/* 44px — дно сенсорної цілі (ACCESSIBILITY-v8 § 8); далі росте з кеглем вікна. */
		min-height: max(44px, calc(var(--fill-u) * 2.75));
		padding: 0 var(--space-lg);
		border: 1px solid var(--color-accent);
		border-radius: var(--radius-sm);
		background: var(--color-accent);
		color: var(--color-text-on-accent);
		font: inherit;
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-bold);
		cursor: pointer;
	}

	.away__goon:disabled {
		border-color: color-mix(in srgb, var(--color-text-on-panel), transparent 82%);
		background: transparent;
		color: var(--color-text-on-panel);
		cursor: default;
	}

	/*
	 * ЛІЧИЛЬНИК НА КНОПЦІ — кольором самої кнопки. Доти він лишався акцентним, тобто на
	 * акцентній кнопці його не було видно зовсім: «Грати далі» стояла з порожнім місцем
	 * праворуч (знімок автора 2026-09-28), а кнопка без числа виглядає як «натиснув і не
	 * працює» — рівно те, від чого число й поставили.
	 */
	.away__goon .away__count {
		color: inherit;
	}

	/* Питання — під іменами: на нього й відповідають кнопки нижче. */
	.away__ask {
		margin: 0;
		font-size: var(--font-size-lg);
	}

	/* Дві дії поруч, а на вузькому екрані — одна під одною. */
	.away__actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-sm);
	}

	/* «Чекати ще хвилину» — другорядна: вона нічого не вирішує за інших. */
	.away__snooze {
		min-height: max(44px, calc(var(--fill-u) * 2.75));
		padding: 0 var(--space-lg);
		border-radius: var(--radius-sm);
		font: inherit;
		font-size: var(--font-size-lg);
	}

	.away__kicks {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-xs);
	}

	/*
	 * Кнопка другорядна (`.btn-secondary`), а не акцентна: дія незворотна, але не та, по
	 * яку тут дивляться, — акцентна поруч з іменем читалася б як пропозиція. І все ж
	 * кнопкою, а не плиткою панелі (прохання автора 2026-09-27). 44px — дно сенсорної цілі
	 * (доти тут було 32px).
	 */
	.away__kick {
		min-height: 44px;
		padding: 0 var(--space-md);
		border-radius: var(--radius-sm);
		font: inherit;
		font-size: var(--font-size-sm);
	}

	.away__count {
		font-variant-numeric: tabular-nums;
		color: var(--color-accent);
	}
</style>
