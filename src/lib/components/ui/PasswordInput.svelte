<script lang="ts">
	import { Lock, Eye, EyeOff, AlertCircle } from 'lucide-svelte';
	import { formatFont } from '$lib/i18n';

	/**
	 * Поле пароля: показати/приховати, CapsLock, попередження про розкладку.
	 *
	 * ## Чому окремий компонент, а не три рядки у формі
	 *
	 * FORM-INPUTS-v8 § 3 вимагає саме цього, і причина не в повторному вжитку —
	 * полів пароля тут наразі два (вхід і реєстрація в одній формі). Причина в
	 * тому, що всі три фічі — станові, і розсипані по формі вони дають три місця,
	 * кожне з яких може розійтися з рештою.
	 *
	 * ## Чого тут НЕМА і чому
	 *
	 * Кнопки «скопіювати» немає за жодних умов (§ 3.1): вона кладе пароль у буфер
	 * обміну, звідки його прочитає будь-яка сторінка з дозволом, і лежатиме він
	 * там, доки щось не перезапише.
	 *
	 * Кнопки «вставити» немає з іншої причини (§ 3.2). Сама вставка паролям
	 * ПОТРІБНА — довгі згенеровані вводять саме так, — і вона працює: `Ctrl+V` і
	 * довгий дотик ніхто не блокує. А кнопка додала б своє: натиск викликає запит
	 * браузера на доступ до буфера — просто під час входу, поруч із полем пароля.
	 * Це виглядає рівно як фішинг, і ціна відмови нульова.
	 *
	 * ## Межа попередження про розкладку
	 *
	 * Це підказка, а не гарантія. На фізичній клавіатурі працює; віртуальні
	 * надсилають `keydown` для символів ненадійно, тож перевірка йде по ЗНАЧЕННЮ
	 * поля, а не по натисках — тоді мобільна клавіатура теж ловиться.
	 *
	 * CapsLock інакше: його стан читається лише з події (`getModifierState`), тож
	 * до першої взаємодії він невідомий. Це обмеження браузера, не недогляд.
	 */
	interface Props {
		/** Перекладач лінивого чанка — див. те саме в `auth/AuthForm.svelte`. */
		text: (key: string) => string;
		/** `id` для звʼязку з підписом. Мусить бути унікальний у документі. */
		id: string;
		value: string;
		/** Текст підпису, що спливає з поля. */
		label: string;
		/** Основа локаторів: `account-password` дає `account-password-input`. */
		testId: string;
		/** `current-password` — вхід; `new-password` — реєстрація. */
		autocomplete?: 'current-password' | 'new-password';
		disabled?: boolean;
	}

	let {
		text,
		id,
		value = $bindable(''),
		label,
		testId,
		autocomplete = 'current-password',
		disabled = false
	}: Props = $props();

	let shown = $state(false);
	let capsLock = $state(false);

	/**
	 * Нелатинська літера в паролі — майже завжди не та розкладка.
	 *
	 * Перевіряється ЗНАЧЕННЯ, а не натиск: на телефоні `keydown` для символів
	 * приходить із `key === 'Unidentified'`, тобто по натисках мобільну
	 * клавіатуру не зловити взагалі.
	 */
	const wrongLayout = $derived(/\p{Script=Cyrillic}|\p{Script=Greek}/u.test(value));

	function readCaps(event: KeyboardEvent | MouseEvent) {
		capsLock = event.getModifierState('CapsLock');
	}
</script>

<div class="pass">
	<div class="pass__field has-input-tools">
		<Lock size={18} class="pass__lead" aria-hidden="true" />

		<input
			{id}
			{autocomplete}
			{disabled}
			type={shown ? 'text' : 'password'}
			bind:value
			class="pass__input"
			placeholder=" "
			autocapitalize="off"
			autocorrect="off"
			spellcheck="false"
			onkeydown={readCaps}
			onkeyup={readCaps}
			onclick={readCaps}
			data-testid="{testId}-input"
		/>

		<!--
			Підпис спливає, а не зникає: `placeholder` як підпис пропадає при вводі,
			і людина, яку перебили, більше не бачить, що це за поле. Тут же
			`placeholder=" "` — лише технічний тригер `:placeholder-shown`.
		-->
		<label class="pass__label" for={id}>{@html formatFont(label)}</label>

		<button
			type="button"
			class="tools__btn pass__toggle"
			onclick={() => (shown = !shown)}
			tabindex="-1"
			aria-pressed={shown}
			aria-label={text(shown ? 'account.passwordHide' : 'account.passwordShow')}
			data-testid="{testId}-toggle-btn"
		>
			{#if shown}
				<EyeOff size={16} aria-hidden="true" />
			{:else}
				<Eye size={16} aria-hidden="true" />
			{/if}
		</button>
	</div>

	<!--
		Попередження НЕЗАЛЕЖНІ, і це вимога § 6: умова виду `layout && !caps`
		ховала б одне за одним, а разом вони трапляються постійно — CapsLock при
		чужій розкладці саме той випадок.

		`role="status"` на контейнері, а не на кожному рядку: інакше поява другого
		попередження переривала б читання першого.
	-->
	<div class="pass__warnings" role="status" aria-live="polite">
		{#if capsLock}
			<p class="pass__warning" data-testid="{testId}-caps-warning">
				<AlertCircle size={14} aria-hidden="true" />
				<span>{@html formatFont(text('account.capsLock'))}</span>
			</p>
		{/if}
		{#if wrongLayout}
			<p class="pass__warning" data-testid="{testId}-layout-warning">
				<AlertCircle size={14} aria-hidden="true" />
				<span>{@html formatFont(text('account.checkLayout'))}</span>
			</p>
		{/if}
	</div>
</div>

<style>
	.pass {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.pass__field {
		position: relative;
		display: flex;
		align-items: center;
	}

	/*
	 * Значок типу поля — ліворуч, і акцент на фокусі лише прозорістю.
	 *
	 * Зміна відтінку тут була б третім кольором у полі: § 1.1 вимагає ОДИН колір
	 * на всі значки поля, а стан показувати прозорістю.
	 */
	:global(.pass__lead) {
		position: absolute;
		left: var(--space-md);
		color: var(--color-text);
		opacity: 0.65;
		pointer-events: none;
	}

	.pass__field:focus-within :global(.pass__lead) {
		opacity: 1;
	}

	.pass__input {
		width: 100%;
		min-height: var(--account-control, 48px);
		/* Ліворуч місце під замок, праворуч — під око. */
		padding: 0 3rem 0 3rem;
		border: 1px solid var(--account-line, var(--color-border));
		border-radius: var(--account-field-radius, var(--radius-md));
		background: var(--color-bg-card);
		color: var(--color-text);
		font: inherit;
		font-size: var(--font-size-sm);
		transition: border-color var(--transition-fast);
	}

	.pass__input:focus {
		border-color: var(--color-accent);
	}

	/*
	 * ДРУГЕ ОКО — БРАУЗЕРНЕ, і саме його тут ховаємо.
	 *
	 * Автор надіслав знімок із ДВОМА очима в одному полі. Друге — не наше: Edge
	 * малює власну кнопку показу пароля (`::-ms-reveal`) у кожному
	 * `type="password"`, і стоїть вона поруч із нашою. Два ока в рядку не просто
	 * негарні: вони роблять різні речі — наше перемикає `type` (тобто стан видно
	 * через `aria-pressed`), браузерне показує символи, поки кнопку тримають, і
	 * читалці про це не каже.
	 *
	 * Прибирається саме браузерне, бо наше несе підпис, стан і локатор для тестів.
	 * `::-ms-clear` заразом: та сама кнопка-хрестик у полях Edge, і в полі пароля
	 * вона теж зайва — очищення вже є в `InputTools` там, де воно доречне.
	 *
	 * Chrome і Safari таких кнопок не малюють, тож правило їх не стосується.
	 */
	.pass__input::-ms-reveal,
	.pass__input::-ms-clear {
		display: none;
	}

	/*
	 * Підпис у полі, що спливає на межу. Тло «чипа» — те саме, що в поля, інакше
	 * на межі просвічувала б рамка.
	 */
	/*
	 * БЕЗ `opacity` НА ПІДПИСІ, і це не смак.
	 *
	 * Тут стояло `opacity: 0.7`, щоб підпис у порожньому полі читався як
	 * плейсхолдер. Гейт контрасту заміряв 3.97:1 проти потрібних 4.5 —
	 * `rgb(178, 187, 173)` на `rgb(58, 90, 42)` у темі `light-green`.
	 *
	 * Прозорість тут і не потрібна: за § 1 це ПІДПИС, а не плейсхолдер, і
	 * приглушувати його означає приглушувати єдине, що називає поле.
	 */
	.pass__label {
		position: absolute;
		left: 3rem;
		top: 50%;
		translate: 0 -50%;
		padding: 0 var(--space-xs);
		background: var(--color-bg-card);
		color: var(--color-text);
		font-size: var(--font-size-sm);
		pointer-events: none;
	}

	.pass__input:focus ~ .pass__label,
	.pass__input:not(:placeholder-shown) ~ .pass__label {
		top: 0;
		translate: 0 -50%;
		scale: 0.82;
	}

	/*
	 * Око — ПЕРШИМ у трейлінгу й єдиним контролом у полі.
	 *
	 * Клас `tools__btn` узятий свідомо: прозорість, перехід і поведінка на
	 * фокусі та сенсорному екрані описані для нього один раз у `global.css`.
	 * Своє оголошення тут дало б другий набір правил на ту саму кнопку — і
	 * розійшлися б вони мовчки.
	 */
	.pass__toggle {
		position: absolute;
		right: var(--space-sm);
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--color-text);
		cursor: pointer;
		padding: 0;
	}

	.pass__warnings {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	/*
	 * `align-items: flex-start` і незмінний розмір значка: у флексі значок
	 * стискається, коли текст переноситься на два рядки, і стає меншим за сусідній
	 * однорядковий. На вузькому екрані це видно одразу.
	 */
	.pass__warning {
		display: flex;
		align-items: flex-start;
		gap: var(--space-xs);
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--color-warning);
	}

	.pass__warning :global(svg) {
		flex-shrink: 0;
		margin-top: 0.1rem;
	}
</style>
