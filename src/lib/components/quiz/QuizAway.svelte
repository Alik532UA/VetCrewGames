<script lang="ts">
	import { formatFont } from '$lib/i18n';
	import type { Member } from '$lib/net/roomTypes';
	import Flag from '$lib/components/ui/Flag.svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';

	/**
	 * ВІКНО ОЧІКУВАННЯ: кого саме немає й скільки вже немає.
	 *
	 * ## Що було замість нього
	 *
	 * Нічого. Присутність у вікторині читалася лише в лобі, а під час партії
	 * зникнення гравця не показувалося ніяк — і водночас замерзало ритм: партія
	 * чекала відповіді від того, кого вже немає, тож кожен раунд крутив таймер до
	 * кінця. Автор попросив зробити «по прикладу з MindStep», і звідти взято
	 * склад: перелік тих, кого немає, відлік і рядок про те, що буде далі.
	 *
	 * ## Чому партія НЕ СТОЇТЬ, поки це вікно висить
	 *
	 * Бо стояти немає за чим: раунд тепер закінчується, коли відповіли ПРИСУТНІ
	 * (`QuizMatch.awaited`). Вікно тут — повідомлення, а не пауза; це головна
	 * різниця з MindStep, де партія на двох без другого просто неможлива.
	 *
	 * ## Чому відлік, якщо він нічого не обриває
	 *
	 * Він відповідає на єдине питання, яке в цю мить є: чекати чи грати далі. За
	 * межею відліку вікно каже прямо, що на цього гравця більше не чекають, — і
	 * саме тоді з'являється «Виключити» в лідера.
	 *
	 * КНОПКА ЛИШЕ ПІСЛЯ ВІДЛІКУ, і це не обережність: обрив зв'язку на пару секунд
	 * трапляється в кожного, а виключення незворотне — той, кого прибрали, вертається
	 * в кімнату вже без свого рахунку в цій партії. Правило бази дозволяє
	 * господареві саме ВИДАЛЕННЯ чужого рядка складу, а не зміну: переписати чуже
	 * імʼя, прапор чи роль він не може.
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
		 * ЧИ ЧЕКАЄ ПАРТІЯ САМЕ ЗАРАЗ — і від цього залежить сам вигляд вікна.
		 *
		 * `true` — вікно стоїть ПО ЦЕНТРУ й перекриває гру підкладкою: партія на
		 * паузі, натискати нема чого, а повідомлення мусить бути прочитане. Вимога
		 * автора: «вікно що перекриває гру з очікуванням гравця».
		 *
		 * `false` — та сама смуга вгорі, що була доти. Це стан «граємо далі без
		 * нього»: пільговий час вичерпано або зниклий уже відповів у цьому раунді,
		 * тобто чекати нема на що. Блокувати екран у цьому стані було б гірше за
		 * будь-яку смугу — гравець лишався б замкнутим доти, доки суперник не
		 * повернеться, а він може не повернутися ніколи.
		 */
		blocking: boolean;
		/** Скільки присутніх уже проголосували «граємо далі». */
		voted: number;
		/** Скільки голосів потрібно — більшість присутніх. */
		needed: number;
		/** Чи мій голос уже врахований. */
		iVoted: boolean;
		/**
		 * ГОЛОС «ГРАЄМО ДАЛІ БЕЗ НЬОГО» — від будь-кого присутнього, не лише лідера.
		 *
		 * Доти партія знімалася з паузи сама, за 15 секунд. Автор попросив інакше, і
		 * причина в житті: гравець перезавантажує комп'ютер, а решта хоче його
		 * дочекатися — 15 секунд на це не хватає нікому. Тепер відлік лише
		 * РОЗБЛОКОВУЄ кнопку, а рішення ухвалює більшість присутніх.
		 */
		onGoOn: () => void;
		/**
		 * Прибрати гравця з кімнати. `undefined` — я не лідер, і кнопки немає.
		 *
		 * Не `disabled`: кнопка, якої натиснути не можна, у гостя лише питала б, чому
		 * вона там стоїть.
		 */
		onkick?: (uid: string) => void;
	}

	let { text, away, secondsLeft, blocking, voted, needed, iVoted, onGoOn, onkick }: Props =
		$props();
</script>

{#if away.length > 0}
	<!--
		ПІДКЛАДКА — ТІЛЬКИ ПОКИ ЧЕКАЄМО. Сама панель та сама в обох станах: інакше
		довелося б тримати дві розмітки того самого повідомлення.

		`aria-modal` НЕ ставиться: вікно нічого не питає й фокус у ньому тримати
		нема на чому (кнопка «Виключити» з'являється лише в лідера й лише після
		відліку). `role="status"` лишається — читалка мусить оголосити появу, а не
		вимагати дії.
	-->
	<div class="away-scrim" class:away-scrim--blocking={blocking} data-testid="quiz-away-backdrop">
		<section
			class="away text-panel"
			class:away--centred={blocking}
			role="status"
			data-testid="quiz-away-panel"
		>
			<h2 class="away__title">{@html formatFont(text('quiz.awayTitle'))}</h2>

			<ul class="away__list" data-testid="quiz-away-list">
				{#each away as member (member.uid)}
					<li class="away__row" data-testid="quiz-away-{member.uid}-item">
						<Flag code={member.country} />
						<Avatar avatar={member.avatar} />
						<span class="away__name">{member.name}</span>
						{#if onkick && secondsLeft === 0}
							<button
								type="button"
								class="away__kick"
								onclick={() => onkick(member.uid)}
								data-testid="quiz-away-{member.uid}-btn"
							>
								{@html formatFont(text('quiz.awayKick'))}
							</button>
						{/if}
					</li>
				{/each}
			</ul>

			{#if secondsLeft > 0}
				<!--
				Число окремим елементом: воно змінюється щосекунди, і читалка мусить
				оголосити зміну, а не перечитувати весь абзац.
			-->
				<p class="away__note">
					{@html formatFont(text('quiz.awayWait'))}
					<b class="away__count" data-testid="quiz-away-timer-value">{secondsLeft}</b>
				</p>
			{:else}
				<!--
					ВІДЛІК ВИЧЕРПАНО — і саме тут з'являється рішення, а не автоматичний
					перехід. Кнопка одна на всіх присутніх; лічильник поруч показує, чого
					вона чекає, бо кнопка без числа виглядала б як «натиснув і не працює».
				-->
				<p class="away__note" data-testid="quiz-away-gone-text">
					{@html formatFont(text('quiz.awayDecide'))}
				</p>

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
			{/if}
		</section>
	</div>
{/if}

<style>
	/*
	 * ДВА СТАНИ ОДНОГО ВІКНА, і різниця між ними — чи чекає партія.
	 *
	 * Доти вікно завжди стояло смугою над дошкою: партія йшла далі, і накривати
	 * питання повідомленням про чужу вкладку означало б заважати тому, хто ще
	 * відповідає. Автор попросив інакше — і має рацію рівно для того часу, поки
	 * партія СПРАВДІ чекає: тоді відповідати нема сенсу, а повідомлення мусить бути
	 * прочитане.
	 *
	 * Тому підкладка вмикається разом із паузою й гасне разом із нею. Стан «граємо
	 * далі без нього» лишається смугою: інакше гравець був би замкнутий доти, доки
	 * суперник не повернеться, а той може не повернутися ніколи.
	 */
	.away-scrim {
		width: 100%;
	}

	.away-scrim--blocking {
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

	.away--centred {
		width: auto;
		max-width: min(92vw, 28rem);
	}

	.away {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-xs);
		width: 100%;
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

	.away__title {
		margin: 0;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-bold);
	}

	.away__list {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-sm);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.away__row {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: var(--font-size-sm);
		/* Пригашено: це той, кого немає, і рядок не мусить читатися як активний. */
		opacity: 0.7;
	}

	.away__name {
		max-width: 12ch;
		overflow: hidden;
		text-overflow: ellipsis;
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

	.away__note {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.away__count {
		font-variant-numeric: tabular-nums;
		color: var(--color-accent);
	}
</style>
