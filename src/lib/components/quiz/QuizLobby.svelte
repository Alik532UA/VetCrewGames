<script lang="ts">
	import type { QuizMatch } from '$lib/controllers/quizMatch.svelte';
	import type { Role } from '$lib/net/roomTypes';
	import { COUNTDOWN_MS } from '$lib/config/roomLife';
	import OnlineLobby from '$lib/components/pairs/OnlineLobby.svelte';
	import QuizGamePicker from './QuizGamePicker.svelte';

	/**
	 * ЛОБІ ВІКТОРИНИ = спільне лобі плюс НАБІР ІГОР цієї кімнати.
	 *
	 * ## Навіщо обгортка
	 *
	 * `OnlineLobby` спільне з «Знайди пару»: код, склад, роль, відлік. Наборів
	 * ігор там немає й не мусить бути — там одна дошка й одні правила. А сторінка
	 * вікторини стоїть на межі розміру (400 рядків), і саме тому дві половини лобі
	 * зʼєднуються тут, а не в маршруті. Той самий взірець і з тієї самої причини —
	 * `QuizRooms`: спільний список кімнат плюс фільтр за іграми.
	 *
	 * ## НАБІР ПРАВИТЬ ГОСПОДАР, і саме тут
	 *
	 * Доти набір після створення кімнати не міняло ніщо: не той склад ігор —
	 * закривай кімнату й скликай людей заново, з новим кодом. Автор попросив рівно
	 * цього: «можна налаштувати поміняти саме тут, у кімнаті».
	 *
	 * Гість набір БАЧИТЬ, але не править — і бачить обовʼязково: інакше перше
	 * питання стає несподіванкою. Право звужене не лише екраном: `info.config`
	 * пише лише господар (правило бази), а `QuizMatch.setGames` не пустить зміну
	 * після початку партії — програма раундів залежить від набору, тож зміна
	 * посеред партії перемалювала б уже зігране.
	 */
	interface Props {
		/** Перекладач вікторини: її рядки лежать у лінивому чанку (`i18n/quiz`). */
		text: (key: string) => string;
		match: QuizMatch;
		code: string;
		/** Повна адреса кімнати — для QR і кнопки «поділитися». */
		joinUrl: string;
		online: string[];
		me: string;
		amHost: boolean;
		/** Час однією величиною: від нього рахується відлік до автостарту. */
		clock: number;
		onRole: (role: Role) => void;
		onStart: () => void;
		onAutoStart: (on: boolean) => void;
		/** Змінити набір ігор. Мережу знає сторінка — сюда приходить лише виклик. */
		onGames: (games: string[]) => void;
	}

	let {
		text,
		match,
		code,
		joinUrl,
		online,
		me,
		amHost,
		clock,
		onRole,
		onStart,
		onAutoStart,
		onGames
	}: Props = $props();

	/**
	 * МОЯ РОЛЬ у кімнаті — гравець чи глядач.
	 *
	 * Рахується тут, бо потрібна лише лобі: далі роль читається зі складу самим
	 * матчем. Склад і `me` тут уже є, тобто на сторінці це була похідна, яку вона
	 * тримала для чужого екрана.
	 */
	const myRole = $derived<Role>(
		match.members.find((member) => member.uid === me)?.role ?? 'player'
	);

	/**
	 * Скільки секунд до автоматичного старту. `null` — відліку немає.
	 *
	 * Рахується ТУТ, а не на сторінці, бо це число нікому більше не потрібне:
	 * сторінка знає лише сам факт відліку (від нього залежить, чи тікати
	 * годиннику), і читає його з `match.countdownAt` напряму.
	 *
	 * Сама межа — з конфігу: на неї ж ставить таймер господар (сторінка), і
	 * розійшовшись, показане число перестало б збігатися з миттю старту.
	 */
	const countdownLeft = $derived(
		match.countdownAt === null || match.countdownAt === undefined
			? null
			: Math.max(0, Math.ceil((match.countdownAt + COUNTDOWN_MS - clock) / 1000))
	);
</script>

<OnlineLobby
	{code}
	{joinUrl}
	members={match.members}
	{online}
	{me}
	{amHost}
	{myRole}
	{countdownLeft}
	autoStart={match.autoStart}
	{onRole}
	{onStart}
	{onAutoStart}
/>

<div class="quiz-lobby__games text-panel">
	<QuizGamePicker {text} selected={match.games} editable={amHost} onchange={onGames} />
</div>

<style>
	/*
	 * Своя панель, бо в лобі набір лежить просто на фотографії тла: тут немає
	 * контейнера-панелі, як у формі входу (`src/backdrop.test.ts` такого не пустить).
	 */
	.quiz-lobby__games {
		width: 100%;
	}
</style>
