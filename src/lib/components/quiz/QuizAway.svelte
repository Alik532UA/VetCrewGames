<script lang="ts">
	import { formatFont } from '$lib/i18n';
	import type { Member } from '$lib/net/roomTypes';
	import Flag from '$lib/components/ui/Flag.svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';

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
	 * Пауза при цьому не місцева: її тривалість дописує в журнал господар, тож
	 * дедлайн однаковий в усіх — включно з тим, хто повернувся (`QuizMatch.setHold`).
	 *
	 * ## Відлік НЕ обриває чекання — він відкриває кнопку
	 *
	 * За його межею партія й далі стоїть, але зʼявляється рішення. Пільга при цьому
	 * НАКОПИЧУВАЛЬНА: гравець, який уже зникав, наступного разу отримує лише решту
	 * (`utils/awayWait`) — інакше зникати на чотирнадцять секунд можна було
	 * безкінечно.
	 *
	 * КНОПКА «ВИКЛЮЧИТИ» ЛИШЕ ПІСЛЯ ВІДЛІКУ, і це не обережність: обрив звʼязку на
	 * пару секунд трапляється в кожного, а виключення незворотне — той, кого
	 * прибрали, вертається в кімнату вже без свого рахунку в цій партії. Правило бази
	 * дозволяє господареві саме ВИДАЛЕННЯ чужого рядка складу, а не зміну: переписати
	 * чуже імʼя, прапор чи роль він не може.
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
		/** Мій голос «грати далі» — від будь-кого присутнього, не лише лідера. */
		onGoOn: () => void;
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
		onResume
	}: Props = $props();

	/** Кого показує рядок: автора паузи або тих, кого немає. */
	const listed = $derived(pausedBy ? [pausedBy] : away);
</script>

{#if waiting && listed.length > 0}
	<!--
		ВІКНО ІСНУЄ, ЛИШЕ ПОКИ ПАРТІЯ ЧЕКАЄ — і тому підкладка тут беззастережна.

		`aria-modal` НЕ ставиться: вікно нічого не забирає у фокус силою.
		`role="status"` лишається — читалка мусить оголосити появу, а не вимагати дії.
	-->
	<div class="away-scrim" data-testid="quiz-away-backdrop">
		<section class="away text-panel" role="status" data-testid="quiz-away-panel">
			<!--
				ОДИН РЯДОК ЗАМІСТЬ ЧОТИРЬОХ БЛОКІВ.

				Доти тут стояли заголовок «Немає звʼязку», список зниклих, питання й
				кнопка — чотири блоки про одне. Автор назвав це «багато шумної
				дублюючої інформації», і має рацію: прапор з аватаркою вже кажуть, що
				йдеться про людину, а слово «чекаємо» — що саме з нею.

				ІМЕНА, А НЕ ЗАЙМЕННИКИ. «Чекаємо на нього» брехало щоразу, коли зникала
				жінка: імена в проєкті випадкові з обох родів. Без прийменника —
				«Чекаємо: Могутній Бізон» — і граматика ціла, і рід ні до чого.
			-->
			<p class="away__line">
				<span class="away__label">
					{@html formatFont(text(pausedBy ? 'quiz.pauseBy' : 'quiz.awayWait'))}
				</span>

				{#each listed as member, index (member.uid)}
					<span class="away__who" data-testid="quiz-away-{member.uid}-item">
						<Flag code={member.country} />
						<Avatar avatar={member.avatar} />
						<span class="away__name">{member.name}</span>
					</span>{#if index < listed.length - 1},{/if}
				{/each}

				{#if secondsLeft > 0}
					<!--
						Число окремим елементом: воно змінюється щосекунди, і читалка мусить
						оголосити зміну, а не перечитувати весь рядок.
					-->
					<b class="away__count" data-testid="quiz-away-timer-value">{secondsLeft}</b>
				{/if}
			</p>

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

			{#if secondsLeft === 0}
				<!--
					ВІДЛІК ВИЧЕРПАНО — і саме тут з'являється рішення, а не автоматичний
					перехід. Кнопка одна на всіх присутніх; лічильник поруч показує, чого
					вона чекає, бо кнопка без числа виглядала б як «натиснув і не працює».

					НА КНОПЦІ НЕМА ІМЕН НАВМИСНО. «Продовжити без них» неправильне для
					одного, «без нього» вертає рід, а імʼя в кнопці повторює рядок вище —
					тобто той самий шум, від якого ми щойно пішли. «Грати далі» коротке,
					гендерно чисте й не залежить від кількості зниклих.
				-->
				<button
					type="button"
					class="away__goon"
					disabled={iVoted}
					onclick={onGoOn}
					data-testid="quiz-away-goon-btn"
				>
					{@html formatFont(text(iVoted ? 'quiz.awayVoted' : 'quiz.awayGoOn'))}
					<b class="away__count" data-testid="quiz-away-goon-count">{voted}/{needed}</b>
				</button>

				{#if onkick && !pausedBy}
					<!-- Лідер може прибрати зниклого назовсім — це інша дія, ніж «грати далі». -->
					<div class="away__kicks">
						{#each away as member (member.uid)}
							<button
								type="button"
								class="away__kick"
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
	</div>
{/if}

<style>
	/*
	 * ПІДКЛАДКА БЕЗЗАСТЕРЕЖНА, бо вікно існує лише поки партія чекає.
	 *
	 * Доти тут було два стани: по центру з підкладкою — поки чекаємо, і смуга над
	 * дошкою — коли «граємо далі без нього». Другий стан і був помилкою: панель
	 * висіла над грою вже після того, як рішення ухвалили, і питала те, на що
	 * відповіли. Тепер відповідь означає зникнення вікна, а не зміну його вигляду.
	 */
	.away-scrim {
		position: fixed;
		inset: 0;
		z-index: 7000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-md);
		box-sizing: border-box;
		/*
		 * Затемнення ПРОЗОРЕ: фонове фото теми мусить лишатися видимим (це стежить
		 * `backdrop.test.ts`), а гра під вікном — вгадуватися, щоб пауза читалася як
		 * пауза, а не як перехід на інший екран.
		 */
		background: color-mix(in srgb, var(--color-bg), transparent 35%);
		backdrop-filter: var(--blur-glass);
	}

	.away {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-sm);
		width: auto;
		/*
		 * ШИРШЕ, НІЖ БУЛО, і без обрізання імені. Скарга автора зі знімком: вікно
		 * вузьке, «Могутній Бізон» стає «Могутній Бі…». Різало не воно, а
		 * `max-width: 12ch` на самому імені — обмеження, яке ховало саме те, заради
		 * чого вікно існує. Тепер імʼя не обмежене нічим, а вікно бере до 34rem і
		 * переносить рядок, якщо імен кілька.
		 */
		max-width: min(92vw, 34rem);
		padding: var(--space-sm) var(--space-md);
		box-sizing: border-box;
		text-align: center;
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
		/* 44px — власний стандарт сенсорної цілі (ACCESSIBILITY-v8 § 8). */
		min-height: 44px;
		padding: 0 var(--space-md);
		border: 1px solid var(--color-accent);
		border-radius: var(--radius-sm);
		background: var(--color-accent);
		color: var(--color-text-on-accent);
		font: inherit;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-bold);
		cursor: pointer;
	}

	.away__goon:disabled {
		border-color: color-mix(in srgb, var(--color-text-on-panel), transparent 82%);
		background: transparent;
		color: var(--color-text-on-panel);
		cursor: default;
	}

	/* Рядок «Чекаємо: 🇺🇦👤 Імʼя — 7»: усе в одну лінію, переноситься за потреби. */
	.away__line {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 6px;
		margin: 0;
		font-size: var(--font-size-sm);
	}

	.away__label {
		font-weight: var(--font-weight-bold);
	}

	.away__who {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}

	.away__kicks {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-xs);
	}

	/* Імʼя НЕ обрізається: саме воно й відповідає на питання «кого чекаємо». */
	.away__name {
		white-space: nowrap;
	}

	/*
	 * Кнопка тиха: дія незворотна, але не та, по яку тут дивляться. Гучна кнопка
	 * поруч з іменем читалася б як пропозиція.
	 */
	.away__kick {
		min-height: 32px;
		padding: 0 var(--space-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-text), transparent 90%);
		color: var(--color-text);
		font: inherit;
		font-size: var(--font-size-xs);
		cursor: pointer;
	}

	.away__count {
		font-variant-numeric: tabular-nums;
		color: var(--color-accent);
	}
</style>
