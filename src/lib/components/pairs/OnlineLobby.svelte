<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import type { TranslationKey } from '$lib/i18n/translations/uk';
	import type { Member, Role } from '$lib/net/roomTypes';
	import SegmentedChoice from '$lib/components/ui/SegmentedChoice.svelte';
	import YouTag from '$lib/components/ui/YouTag.svelte';

	/**
	 * Лобі кімнати: код, склад, роль і кнопка «почати».
	 *
	 * Роль вибирається ДО початку партії й після нього вже не міняється: склад
	 * гравців входить у роздачу колоди, тож перехід із глядача в гравці посеред
	 * партії означав би нову роздачу — і стер би все, що всі запамʼятали.
	 */
	interface Props {
		code: string;
		members: Member[];
		online: string[];
		me: string;
		amHost: boolean;
		myRole: Role;
		/**
		 * Скільки секунд до автоматичного старту; `null` — відліку немає.
		 *
		 * Число приходить готовим, а не рахується тут: воно виводиться з СЕРВЕРНОЇ
		 * позначки в кімнаті, і саме тому в обох учасників однакове. Компонент його
		 * лише малює.
		 */
		countdownLeft: number | null;
		/**
		 * Режим початку партії: сама чи за підтвердженням господаря.
		 *
		 * Налаштування КІМНАТИ, тож видно його обом — гість мусить знати, чого
		 * чекати. Міняти може лише господар: правило бази інших і не пустить.
		 */
		autoStart: boolean;
		onRole: (role: Role) => void;
		onStart: () => void;
		/** Перемкнути режим. Кличеться лише з боку господаря. */
		onAutoStart: (on: boolean) => void;
	}

	let {
		code,
		members,
		online,
		me,
		amHost,
		myRole,
		countdownLeft,
		autoStart,
		onRole,
		onStart,
		onAutoStart
	}: Props = $props();

	/**
	 * Скільком гравцям місце в партії. Двоє — це сама гра, а не налаштування.
	 *
	 * Число тут іменем, а не двома `< 2` по тексту: воно вирішує і статус, і
	 * доступність кнопки, і розійтися ці два місця не мають права.
	 */
	const MIN_PLAYERS = 2;

	const players = $derived(members.filter((member) => member.role === 'player'));

	/**
	 * ОДИН СТАТУС ЛОБІ, і рівно один — за пріоритетом перешкод.
	 *
	 * ## Дефект, який це виправляє
	 *
	 * Підказок було ТРИ, і вони не знали одна про одну: режим початку (завжди),
	 * «потрібні щонайменше двоє» (лідерові, коли мало гравців) і «чекаємо, доки
	 * лідер почне» (гостеві). Лідер із одним гравцем бачив одночасно «партія
	 * чекає, доки лідер натисне» і «потрібні щонайменше двоє гравців» — тобто два
	 * твердження, з яких перше неправда: натиск нічого не дав би.
	 *
	 * Автор описав це точно: «не логічно чекати господаря, якщо все одно не
	 * вистачає гравців».
	 *
	 * ## Чому саме пріоритет, а не склеювання
	 *
	 * Перешкоди тут вкладені: доки не зібралися гравці, режим початку не має
	 * значення; доки йде відлік, і режим, і кнопка вже не важливі. Тому статус
	 * називає НАЙБЛИЖЧУ перешкоду, а не всі одразу — інакше він знову став би
	 * двома рядками, тільки в одному абзаці.
	 *
	 * `null` означає «тут відлік», який малюється числом і тому не є ключем.
	 */
	const statusKey = $derived.by((): TranslationKey | null => {
		// Найближча перешкода — склад. Однакова для лідера й гостя: обидва бачать,
		// чому нічого не відбувається.
		if (players.length < MIN_PLAYERS) return 'pairs.needPlayers';
		if (countdownLeft !== null) return null;
		if (autoStart) return 'pairs.modeAutoHint';
		// Лідерові — ВКАЗІВКА, гостеві — опис. Доти обидва читали опис, і лідер
		// дізнавався про себе в третій особі: «партія чекає, доки лідер натисне».
		return amHost ? 'pairs.startWhenReady' : 'pairs.modeConfirmHint';
	});
	/*
	 * Порядок у списку — за входом, а не за тим, як його віддала база (за алфавітом
	 * ключів). Черга ходів іде саме за входом, і список мусить показувати те саме,
	 * інакше «хто перший» читається з екрана неправильно.
	 */
	const shown = $derived([...members].sort((a, b) => a.order - b.order));
</script>

<div class="lobby">
	<p class="lobby__code text-panel">
		{@html formatFont(t('pairs.roomCode'))}:
		<b class="lobby__value" data-testid="pairs-room-code-value">{code}</b>
	</p>

	<ul class="lobby__list text-panel" data-testid="pairs-members-list">
		{#each shown as member (member.uid)}
			<li
				class="lobby__member"
				class:lobby__member--away={!online.includes(member.uid)}
				data-testid="pairs-member-{member.uid}-item"
			>
				{member.name}{#if member.uid === me} <YouTag />{/if}
				<span class="lobby__role">
					{@html formatFont(
						t(member.role === 'player' ? 'pairs.rolePlayer' : 'pairs.roleSpectator')
					)}
				</span>
			</li>
		{/each}
	</ul>

	<!--
		РОЛЬ — ТОЙ САМИЙ СЕГМЕНТОВАНИЙ ВИБІР, що й режим початку партії.
	
		Доти це були два чіпи з `aria-pressed`, і автор сказав про них точно: «не
		зрозуміло, яка позиція вибрана». Причина в тому, що чіп-перемикач має лише
		одну відмінність між станами — колір тла, — і поруч стоять два таких чіпи,
		тобто око бачить дві кнопки, а не один вибір із двох.
	
		Сегментована панель показує саме вибір: спільна рамка каже «це одне поле», а
		залитий сегмент — «ось поточне значення». Заразом зникають два дефекти чіпів:
		нативні радіокнопки дають групі керування з клавіатури стрілками, а вибране
		значення читається скрінрідером як стан радіо, а не як натиснута кнопка.
	-->
	<SegmentedChoice
		legend={t('pairs.myRole')}
		scope="pairs-role"
		value={myRole}
		onchange={(id) => onRole(id as Role)}
		options={[
			{ id: 'player', label: t('pairs.rolePlayer') },
			{ id: 'spectator', label: t('pairs.roleSpectator') }
		]}
	/>

	<!--
		СТАТУС — ОДИН, і в ОДНОМУ МІСЦІ.

		Стоїть тут навмисно: вище нього немає жодного умовного блока, тож рядок не
		стрибає ні між лідером і гостем, ні коли починається відлік. Доти статуси
		жили в трьох різних місцях сторінки й з’являлися по два (див. `statusKey`).

		Підпису «Статус» немає — автор попросив прямо, і він має рацію: рядок
		читається як стан і без назви, а назва зробила б із нього поле форми.

		`role="status"` рівно один: три живі області поспіль скрінрідер зачитує
		впереміш, і зрозуміти, яка з них щойно змінилася, неможливо.

		ВІДЛІК БАЧАТЬ ОБОЄ, і це головне в ньому. Той, хто зайшов другим, кнопки
		«Почати» не має зовсім, тож без цього рядка партія починалася б для нього
		раптово. Число те саме, що в лідера: воно виводиться з серверної позначки, а
		не з місцевого таймера.

		Скасувати може лідер перемикачем режиму; гість — перейшовши в глядачі, бо
		тоді гравців стає менше двох і відлік гасне сам. Тобто вихід є в обох, і
		жоден не потребує окремого права в базі.
	-->
	<p class="lobby__status text-panel" role="status" data-testid="pairs-lobby-status-text">
		{#if statusKey === null}
			{@html formatFont(t('pairs.startingIn'))}
			<b class="lobby__seconds">{countdownLeft}{@html formatFont(t('pairs.seconds'))}</b>
		{:else}
			{@html formatFont(t(statusKey))}
		{/if}
	</p>

	<!--
		РЕЖИМ ПОЧАТКУ ПАРТІЇ — налаштування кімнати, а не поведінка.
		
		Дві названі кнопки замість здогадки: «Автостарт» і «Підтвердження
		готовності». Кімната, створена руками, стоїть на другому — її відкривають
		для когось конкретного, і партія, що почалася сама, щойно зайшов ХТОСЬ,
		була б несподіванкою. «Швидка гра» створює кімнату на першому: вона
		зводить незнайомців, і зайвий натиск лише заважає.
		
		Гість бачить режим РЯДКОМ у статусі вище, а не кнопками: міняти його він не
		може (правило бази), але знати, чого чекати, мусить — інакше «чому не
		починається» лишається без відповіді з того боку, де немає кнопки.
	-->
	{#if amHost}
		<SegmentedChoice
			legend={t('pairs.startMode')}
			scope="pairs-start-mode"
			value={autoStart ? 'auto' : 'confirm'}
			onchange={(id) => onAutoStart(id === 'auto')}
			options={[
				{ id: 'auto', label: t('pairs.modeAuto') },
				{ id: 'confirm', label: t('pairs.modeConfirm') }
			]}
		/>
		<!--
			Починає лише лідер, і кнопка не ховається, коли гравців бракує: заборона з
			причиною вчить, а зникла кнопка читається як поломка. Причину при цьому
			тепер каже статус вище, а не окремий абзац під кнопкою.
		-->
		<button
			type="button"
			class="btn-primary"
			onclick={onStart}
			data-testid="pairs-start-btn"
			aria-disabled={players.length < MIN_PLAYERS}
		>
			{@html formatFont(t('pairs.start'))}
		</button>
	{/if}
</div>

<style>
	.lobby {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-md);
		width: 100%;
		max-width: 26rem;
	}

	.lobby__code {
		margin: 0;
		font-size: var(--font-size-md);
	}

	/*
	 * ОДИН СТАТУС — і місце під нього ЗАКРІПЛЕНЕ.
	 *
	 * `min-height` не косметика: текст статусу перемикається між «потрібні двоє»,
	 * відліком і вказівкою лідерові, і рядки в них різної довжини. Без резерву
	 * висоти кнопка «Почати партію» стрибала б угору-вниз рівно тоді, коли на неї
	 * націлюються пальцем.
	 *
	 * Прозорості тут НЕМА, і це не забутий рядок: доти ці підказки були
	 * `opacity: 0.75`, тобто «додаткова інформація». Тепер це єдиний стан лобі —
	 * головне, що людина читає, чекаючи. Заразом знімається й ризик для гейта
	 * контрасту: приглушений текст на цій панелі вже одного разу впирався в 4.5:1.
	 */
	.lobby__status {
		margin: 0;
		min-height: 2.5em;
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
		font-size: var(--font-size-md);
		color: var(--color-text);
	}

	/*
	 * Число рівної ширини: без `tabular-nums` рядок сіпається на кожній секунді,
	 * бо «5» і «1» у пропорційному шрифті різної ширини — а сіпається він рівно
	 * тоді, коли на нього дивляться.
	 */
	.lobby__seconds {
		font-variant-numeric: tabular-nums;
		color: var(--color-accent);
	}

	/* Код диктують уголос, тож він великий і з проміжками між літерами. */
	.lobby__value {
		font-size: var(--font-size-xl);
		letter-spacing: 0.25em;
	}

	.lobby__list {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		width: 100%;
		margin: 0;
		padding: var(--space-md);
		list-style: none;
	}

	.lobby__member {
		display: flex;
		gap: var(--space-sm);
		justify-content: space-between;
	}

	/* Звʼязок обірвався — не «вийшов»: людина могла заїхати в тунель. */
	.lobby__member--away {
		opacity: 0.5;
	}

	.lobby__role {
		font-size: var(--font-size-sm);
		opacity: 0.7;
	}

	/*
	 * ТУТ БІЛЬШЕ НЕМА `.lobby__roles`, `.chip`, `.chip--on` І `.lobby__hint`.
	 *
	 * Чіпи ролі стали `SegmentedChoice` — той самий елемент, що й режим початку
	 * партії, тож і стилі тепер там, в одному місці. Три підказки зійшлися в один
	 * `.lobby__status`.
	 *
	 * Правило без жодного носія читається як «десь у розмітці ще є такий елемент»,
	 * і саме на цьому в проєкті вже одного разу лишилася мертва копія компонента.
	 * Компілятор Svelte про це попереджає — попередження тут гейт, а не шум.
	 */
</style>
