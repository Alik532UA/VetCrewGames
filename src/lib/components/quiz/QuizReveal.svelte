<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { innerWidth } from 'svelte/reactivity/window';
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';
	import { phaseScore, rankedByPhase } from '$lib/utils/revealOrder';
	import { placesOf } from '$lib/utils/standings';
	import { formatFont } from '$lib/i18n';
	import type { Member } from '$lib/net/roomTypes';
	import Flag from '$lib/components/ui/Flag.svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import YouTag from '$lib/components/ui/YouTag.svelte';
	import RoundIndicator from '$lib/components/RoundIndicator.svelte';
	import TimerBar from '$lib/components/ui/TimerBar.svelte';
	import type { RoundStatus } from '$lib/types/game';

	/**
	 * ТАБЛО МІЖ РАУНДАМИ: посередині екрана, з набором балів.
	 *
	 * ## Що було
	 *
	 * Рядок «Наступний раунд» і числа, які просто ставали іншими у смузі зверху.
	 * Автор описав це точно: «просто стає число миттєво більше, зверху табло», а
	 * хотів «результати по центру екрану по кожному з гравцю з анімацією набору
	 * балів». Тобто пауза між раундами існувала, але нічого не показувала.
	 *
	 * ## Чому приріст, а не лише сума
	 *
	 * «+90» відповідає на питання «як я щойно зіграв», якого сума не бачить. Сума
	 * поруч лишається, бо саме вона тримає порядок місць.
	 *
	 * ## Анімація рахує ЧАС, а не кадри
	 *
	 * Крок за кадр (`value += 3`) на 120-герцевому екрані домалював би вдвічі
	 * швидше, ніж на 60-герцевому, і «однакова анімація» залежала б від монітора.
	 * Тут rAF лише питає час, а число виводиться з частки пройденого — тож
	 * тривалість та сама всюди, а пропущені кадри просто зменшують плавність.
	 *
	 * `prefers-reduced-motion` вимикає набір ЦІЛКОМ: підсумок ставиться одразу.
	 * Це не «менша анімація», а її відсутність — саме те, про що просить критерій.
	 */
	interface Props {
		/**
		 * Перекладач вікторини: її рядки лежать у ЛІНИВОМУ чанку
		 * (`i18n/quiz`), бо головний словник вантажать усі відвідувачі.
		 */
		text: (key: string) => string;
		players: Member[];
		/**
		 * КОГО НЕМАЄ ОНЛАЙН — за uid.
		 *
		 * Табло між раундами показує той самий склад, що смуга над дошкою й
		 * підсумок, тож і зниклого мусить показувати так само. Пропустити його тут
		 * означало б, що з трьох переліків гравця видно у двох — а питання «хто
		 * дізконект» ставлять саме на таблі, коли дивляться на рахунок.
		 */
		away?: string[];
		/** Підсумковий рахунок кожного — після цього раунду. */
		scores: Record<string, number>;
		/** Скільки дав саме цей раунд. Нуль — не встиг або схибив. */
		gains: Record<string, number>;
		me: string;
		/** Скільки триває набір, мс. Нуль — без анімації. */
		duration?: number;
		/**
		 * Пауза між кінцем набору й переїздом рядків, мс.
		 *
		 * Не оздоба: без неї два рухи зливаються в один, і питання «як змінилося
		 * моє становище» знову лишається без відповіді — око не встигає відокремити
		 * «долічили» від «поїхали».
		 */
		settle?: number;
		/** Скільки триває переїзд рядків на нові місця, мс. */
		travel?: number;
		/**
		 * МОЇ результати по вже зіграних раундах — для смужок прогресу.
		 *
		 * Скарга автора: «між раундами не видно, скільки вже було ігор і скільки ще
		 * залишилось». Табло — саме те місце, де на це дивляться: під час раунду
		 * увага на питанні, і показувати там прогрес означало б забрати її звідти.
		 *
		 * Свої, а не спільні: смужка відповідає на «як я граю цю партію», а чужий
		 * рахунок стоїть рядком нижче в самій таблиці.
		 */
		rounds?: RoundStatus[];
		/**
		 * Скільки раундів у партії всього. Нуль — програма ще не приїхала.
		 *
		 * Не просто `total`: нижче вже є локальне `total` — підсумковий рахунок
		 * гравця. Два різні `total` в одному файлі читалися б як одне.
		 */
		roundsTotal?: number;
		/**
		 * Скільки лишилося ТАБЛУ, мс. Нуль — смуги немає.
		 *
		 * Скарга автора: «між раундами немає таймера — невідомо, скільки чекати
		 * наступний раунд». Число приходить готовим із контролера, як і в раунді:
		 * свій відлік тут дав би другий годинник, і смуга в двох гравців розійшлася б.
		 */
		leftMs?: number;
		/** Скільки триває табло, мс. Нуль — без смуги. */
		limitMs?: number;
	}

	let {
		text,
		players,
		scores,
		gains,
		me,
		away = [],
		duration = 700,
		settle = 250,
		travel = 500,
		rounds = [],
		roundsTotal = 0,
		leftMs = 0,
		limitMs = 0
	}: Props = $props();

	const reduceMotion = new MediaQuery('(prefers-reduced-motion: reduce)');

	/**
	 * ТАБЛО РОСТЕ З ВІКНОМ — ПЛАВНО, без жодного порогу.
	 *
	 * Скарга автора: табло «займає 10% вікна», а мусить «70%». Так і було: картка на
	 * 26rem посеред екрана, тобто щойно дошка на весь стовпець — і раптом маленька
	 * плашка з двома рядками.
	 *
	 * Перша редакція виправлення мала ПОРІГ (великий варіант від 1024×576), і автор
	 * одразу побачив, що з ним не так: «різкий перехід… тільки на весь екран стало
	 * більше, а пів екрану досі маленьке табло, зроби розумно — для будь-якого екрана
	 * не менше 70% ширини». Поріг ділить вікна на два класи й карає тих, хто біля
	 * межі: вікно на пів екрана лишалося карткою.
	 *
	 * Тому МІРА ОДНА — кегель рядка, пропорційний ширині вікна (1.95%, від 16 до
	 * 36px), — і з неї виводиться все: заголовок, висота рядків, відступи, аватар,
	 * прапор, смуга часу, смужки раундів. Табло на пів екрана — це те саме табло на
	 * весь екран, лише зменшене, а не інший екран. Ширину табло задають стилі
	 * (не менше 70% вікна), а цю міру — скрипт: аватар і прапор приймають розмір
	 * ЧИСЛОМ у пропсі (lucide малює значок у пікселях), і CSS інлайнового розміру
	 * аватара не перекриє. Одне число на стилі й значки — інакше вони розійшлися б.
	 *
	 * Від ширини вікна, а не від місця компонента, бо прохання — саме про вікно, а
	 * табло й так займає більшу частину вікна: міряти себе самого воно не може.
	 */
	const unit = $derived(Math.min(36, Math.max(16, (innerWidth.current ?? 0) * 0.0195)));

	/**
	 * Частка набору: 0 — рахунок до раунду, 1 — після нього.
	 *
	 * Одне число на всіх, а не окреме на гравця: рядки мусять доїхати разом,
	 * інакше порядок місць змінюється на очах у різні миті, і читати таблицю під
	 * час цього неможливо.
	 */
	let progress = $state(0);

	$effect(() => {
		if (reduceMotion.current || duration <= 0) {
			progress = 1;
			return;
		}

		let frame = 0;
		let started: number | null = null;
		const step = (now: number) => {
			started ??= now;
			progress = Math.min(1, (now - started) / duration);
			if (progress < 1) frame = requestAnimationFrame(step);
		};
		frame = requestAnimationFrame(step);
		return () => cancelAnimationFrame(frame);
	});

	/**
	 * ЧИ ВЖЕ ПЕРЕЇХАЛИ РЯДКИ. Друга фаза табла, окрема від набору чисел.
	 *
	 * Доти рядки стояли на КІНЦЕВИХ місцях від першого кадру, і в коді була
	 * записана причина: інакше вони стрибали б місцями протягом самої анімації.
	 * Занепокоєння правильне, а рішення викидало половину сенсу — числа рухалися, а
	 * на питання «як змінилося моє становище» табло не відповідало.
	 *
	 * Скарга автора саме про це: «не видно на якому місці був гравець до цього
	 * раунду і як змінилось його положення».
	 *
	 * Тепер фаз дві, і стрибків так само немає: під час набору порядок МИНУЛОГО
	 * раунду й не міняється, а після паузи всі рядки їдуть РАЗОМ, один раз.
	 */
	let moved = $state(false);

	$effect(() => {
		if (reduceMotion.current || duration <= 0) {
			moved = true;
			return;
		}
		moved = false;
		const timer = setTimeout(() => (moved = true), duration + settle);
		return () => clearTimeout(timer);
	});

	const shown = (uid: string) => {
		const total = scores[uid] ?? 0;
		const gain = gains[uid] ?? 0;
		return Math.round(total - gain * (1 - progress));
	};

	/**
	 * Порядок — за МИНУЛИМ рахунком, поки рядки не переїхали, і за підсумковим
	 * після. Саме правило живе в `utils/revealOrder` — там його й перевірено.
	 *
	 * Ключем `{#each}` лишається `uid`, тому переїзд малює `animate:flip`: Svelte
	 * бачить, що ті самі вузли змінили місця, і рухає їх плавно.
	 */
	const ranked = $derived(rankedByPhase(players, scores, gains, moved));
	/** Рівні бали ділять місце: 1, 1, 3 (`utils/standings.ts`) — за рахунком тієї самої фази. */
	const places = $derived(placesOf(players, phaseScore(scores, gains, moved)));
</script>

<section class="reveal text-panel" style:--reveal-unit="{unit}px" data-testid="quiz-reveal-panel">
	<!--
		СКІЛЬКИ ЧЕКАТИ НАСТУПНИЙ РАУНД — тією самою смугою, що в раунді.

		Прохання автора: «між раундами немає таймера, невідомо, скільки чекати… є
		таймер (по прикладу як під час раунду)». Компонент справді той самий
		(`ui/TimerBar`), і це головне: два схожі, але різні відліки на сусідніх
		екранах читалися б як різні речі.

		ЗВЕРХУ, як і в раунді: смуга відповідає на «скільки лишилося цьому екрану», і
		питання це ставлять, щойно екран зʼявився, а не прочитавши рахунок.
	-->
	{#if limitMs > 0}
		<TimerBar {leftMs} {limitMs} label={text('quiz.revealTimer')} testId="quiz-reveal-progress" />
	{/if}

	<h2 class="reveal__title">{@html formatFont(text('quiz.nextRound'))}</h2>

	<ul class="reveal__list">
		{#each ranked as player (player.uid)}
			<li
				class="reveal__row"
				class:player-away={away.includes(player.uid)}
				data-testid="quiz-reveal-{player.uid}-row"
				animate:flip={{ duration: reduceMotion.current ? 0 : travel, easing: cubicOut }}
			>
				<!--
					Номер місця їде РАЗОМ із рядком, а не перемальовується раніше: інакше
					гравець бачив би нове число на старому місці — тобто саме те
					протиріччя, яке табло й мусить розв'язати.
				-->
				<b class="reveal__place" data-testid="quiz-reveal-{player.uid}-place-value">
					{places[player.uid]}
				</b>
				<span class="reveal__who">
					<Flag code={player.country} height={Math.max(14, Math.round(unit * 0.75))} />
					<Avatar avatar={player.avatar} size={Math.max(22, Math.round(unit * 1.2))} />
					{player.name}{#if player.uid === me}&nbsp;<YouTag />{/if}
				</span>
				<!--
					Приріст стоїть ЛІВОРУЧ від суми: очима читають зліва направо, а
					питання тут «скільки я щойно взяв», і лише потім «скільки всього».
				-->
				{#if (gains[player.uid] ?? 0) > 0}
					<span class="reveal__gain" data-testid="quiz-reveal-{player.uid}-count">
						+{gains[player.uid]}
					</span>
				{/if}
				<b class="reveal__score" data-testid="quiz-reveal-{player.uid}-value">
					{shown(player.uid)}
				</b>
			</li>
		{/each}
	</ul>

	<!--
		СКІЛЬКИ ВЖЕ ЗІГРАНО Й СКІЛЬКИ ЩЕ — смужками, під таблицею.

		Прохання автора: «між раундами не видно, скільки вже було ігор і скільки ще
		залишилось; прогрес бар візуально як `segments-wrapper`». Компонент саме з
		цією розміткою в проєкті вже є й стоїть у пʼятьох соло-іграх та в перевірці
		заповідника — тобто це той самий вигляд, а не другий такий самий.

		ПІД таблицею, а не над: заголовок і місця — головне на цьому екрані, а
		прогрес відповідає на питання, яке ставлять, уже прочитавши рахунок.

		Умова на `roundsTotal` не про порожній масив, а про мить: програма виводиться
		із зерна кімнати, і поки знімок не приїхав, вона порожня. Індикатор на нуль
		сегментів намалював би порожню рамку.
	-->
	{#if roundsTotal > 0}
		<RoundIndicator current={rounds.length + 1} total={roundsTotal} results={rounds} />
	{/if}
</section>

<style>
	/*
	 * Табло стоїть у потоці на місці дошки — тобто посередині того, на що людина
	 * щойно дивилася. Накладка поверх (`position: fixed`) тут була б гіршою: під
	 * нею лишалася б видима дошка з питанням, на яке вже відповіли.
	 *
	 * УСІ РОЗМІРИ — ВІД ОДНІЄЇ МІРИ `--u` (кегель рядка, див. `unit` у скрипті), і
	 * жодного медіазапиту чи порогу: на кожній ширині вікна табло те саме, лише
	 * іншого масштабу. Порога тут уже раз не стало — автор назвав стрибок між
	 * «карткою» й «великим табло» різким.
	 *
	 * ШИРИНА — НЕ МЕНШЕ 70% ВІКНА, на будь-якому екрані (прохання автора дослівне).
	 * `max(70vw, …)`: на телефоні 70% — це 262px, і тоді табло бере стовпець, але не
	 * більше 26rem, як і доти. Нижча стеля вкрала б імена: при 22rem на 375px імʼя
	 * «Рожевий Фламінго» з позначкою «ви» втрачало б 14px. Ширше за стовпець партії
	 * воно стати МОЖЕ: стеля стовпця 1100px, а 70% вікна на 1920 — це 1344. Сторінка
	 * центрує табло (`align-items: center`), тож і вихід за стовпець симетричний, —
	 * тому по горизонталі тут немає `margin: auto`: авто-поля в поперечній осі при
	 * нестачі місця обнуляються з лівого боку, і табло поїхало б праворуч.
	 *
	 * ВИСОТА — `min(70svh, 45vw)`: на широкому вікні це 70% висоти, на вузькому —
	 * пропорційно ширині, тобто табло лишається тієї самої форми, а не стає
	 * вузьким стовпом на пів телефона.
	 */
	.reveal {
		--u: var(--reveal-unit, 16px);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: calc(var(--u) * 0.6);
		width: max(70vw, min(100%, 26rem));
		min-height: min(70svh, 45vw);
		margin-block: auto;
		padding: calc(var(--u) * 0.9) var(--u);
		box-sizing: border-box;
	}

	.reveal__title {
		margin: 0;
		font-size: calc(var(--u) * 1.15);
		text-align: center;
		color: var(--color-text-muted);
	}

	.reveal__list {
		display: flex;
		flex: 1;
		flex-direction: column;
		justify-content: center;
		gap: calc(var(--u) * 0.35);
		width: 100%;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/*
	 * Рядки ДІЛЯТЬ висоту табла між собою (`flex: 1 1 0`), але в межах: не нижчі за
	 * 2.4 кегля й не вищі за 3.3. Двоє гравців отримують великі рядки, дванадцятеро
	 * — вужчі; рядок не стає вищим за те, що око ще читає як один рядок таблиці, а
	 * якщо гравців більше, ніж влазить, табло росте, а не тисне рядки.
	 *
	 * ПОЛЯ Й ПРОМІЖКИ на найменшому кеглі (16px) — ті самі, що були до масштабу:
	 * 8px між частинами рядка, 16px поля табла. Щедріші (0.75 і 1.25 кегля) забрали б
	 * на 320px в імені 42px із 172, і «Сміливий Бобер» втрачав би останню літеру. На
	 * телефоні місце — це імʼя, а не повітря довкола нього.
	 */
	.reveal__row {
		display: flex;
		flex: 1 1 0;
		align-items: center;
		gap: calc(var(--u) * 0.5);
		min-height: calc(var(--u) * 2.4);
		max-height: calc(var(--u) * 3.3);
		padding: 0 calc(var(--u) * 0.5);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-text), transparent 94%);
		font-size: var(--u);
	}

	.reveal__place {
		flex-shrink: 0;
		min-width: 2ch;
		font-variant-numeric: tabular-nums;
		color: var(--color-text-muted);
		text-align: right;
	}

	.reveal__who {
		display: flex;
		align-items: center;
		gap: calc(var(--u) * 0.35);
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/*
	 * Приріст — акцентом, бо це єдине нове число на екрані.
	 *
	 * АКЦЕНТ — ТЛОМ ПІЛЮЛІ, а не кольором тексту. Тут стояло `color: var(--color-accent)`,
	 * і в обох світлих темах «+100» був майже невидимий: #ffb327 на тлі плашки
	 * (`--color-bg-surface`) — 1.46:1 у light-green і 1.58:1 у winter при потрібних
	 * 4.5. Пара акцент + `--color-text-on-accent` — та сама, що в кнопки «Почати
	 * партію» й у відліку лобі, тобто вже підібрана в кожній темі (7.38–7.82:1).
	 */
	.reveal__gain {
		flex-shrink: 0;
		padding: 0 0.3em;
		border-radius: var(--radius-sm);
		background: var(--color-accent);
		color: var(--color-text-on-accent);
		font-variant-numeric: tabular-nums;
		font-weight: var(--font-weight-bold);
	}

	/*
	 * `tabular-nums` обов'язкові на числі, що біжить: у пропорційному шрифті «1» і
	 * «4» різної ширини, тож рядок сіпався б саме тоді, коли на нього дивляться.
	 */
	.reveal__score {
		flex-shrink: 0;
		min-width: 4ch;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	/*
	 * Смуга часу, смужки раундів і позначка «ви» — інші компоненти, тож
	 * дотягуємося `:global` лише всередині цього табло, і тією самою мірою. Сталі
	 * 6px смуги, 300px смужок і 10px позначки на табло завширшки з тисячу пікселів
	 * губилися б, а питання «скільки ще чекати», «скільки ще раундів» і «де я»
	 * лишалися б без видимої відповіді. Нижні межі — ті самі сталі числа: на
	 * телефоні табло таке саме, як було.
	 */
	.reveal :global(.timer) {
		height: max(6px, calc(var(--u) / 3));
	}

	.reveal :global(.segments-wrapper) {
		max-width: max(300px, calc(var(--u) * 22));
		gap: max(4px, calc(var(--u) / 5));
	}

	.reveal :global(.segment) {
		height: max(6px, calc(var(--u) / 3));
		border-radius: max(3px, calc(var(--u) / 6));
	}

	.reveal :global(.badge) {
		font-size: max(10px, calc(var(--u) / 2));
	}
</style>
