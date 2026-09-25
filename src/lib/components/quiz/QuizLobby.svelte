<script lang="ts">
	import type { QuizMatch } from '$lib/controllers/quizMatch.svelte';
	import type { Role } from '$lib/net/roomTypes';
	import OnlineLobby from '$lib/components/pairs/OnlineLobby.svelte';
	import QuizGamePicker from './QuizGamePicker.svelte';
	import QuizPacePicker from './QuizPacePicker.svelte';
	import type { RoomPace } from '$lib/config/quizOnline';

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
		/** Моя роль, відлік і готовність — із сесії (`RoomSession`), як і в «Знайди пару». */
		myRole: Role;
		countdownLeft: number | null;
		ready: boolean;
		onRole: (role: Role) => void;
		onStart: () => void;
		onAutoStart: (on: boolean) => void;
		/** Змінити набір ігор. Мережу знає сторінка — сюда приходить лише виклик. */
		onGames: (games: string[]) => void;
		/**
		 * Змінити швидкість кімнати: час на раунд, час на перегляд відповіді й «не
		 * обмежений» — цілком, бо кімната пише налаштування повністю.
		 */
		onPace: (pace: RoomPace) => void;
	}

	let {
		text,
		match,
		code,
		joinUrl,
		online,
		me,
		amHost,
		myRole,
		countdownLeft,
		ready,
		onRole,
		onStart,
		onAutoStart,
		onGames,
		onPace
	}: Props = $props();
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
	{ready}
	autoStart={match.autoStart}
	{onRole}
	{onStart}
	{onAutoStart}
>
	{#snippet settings()}
		<!--
			НАБІР ІГОР І ШВИДКІСТЬ — В ОДНІЙ ПАНЕЛІ: це два налаштування тієї самої
			кімнати.

			Друга панель поруч читалася б як інша річ, а вони обидві відповідають на «у
			що й як швидко граємо». Заразом це не додає рядка на вузькому екрані: групи
			переносяться самі.

			ПАНЕЛЬ ТЕПЕР МАЛЮЄ ЛОБІ, а не ця обгортка. Доти тут стояв окремий
			`.text-panel` ПІД усім лобі, і на широкому екрані він опинявся нижче межі
			вікна — налаштувати кімнату можна було, лише прогорнувши повз «Почати
			партію». Тепер це третій стовпець лобі (сніпет `settings`), і стоїть він
			поруч зі складом, а не під ним.
		-->
		<div class="quiz-lobby__settings">
			<QuizGamePicker {text} selected={match.games} editable={amHost} onchange={onGames} />
			<QuizPacePicker {text} pace={match.pace} editable={amHost} onpick={onPace} />
		</div>
	{/snippet}
</OnlineLobby>

<style>
	/*
	 * Групи переносяться самі: у вузькому третьому стовпці кожна стає своїм рядком,
	 * а на всю ширину (два стовпці над панеллю) дві шкали швидкості лягають поруч
	 * під набором ігор. Тла тут немає — його дає панель лобі.
	 */
	.quiz-lobby__settings {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: center;
		gap: var(--space-md);
	}
</style>
