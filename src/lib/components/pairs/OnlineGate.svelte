<script lang="ts">
	import { Dices } from 'lucide-svelte';
	import { t, td, formatFont } from '$lib/i18n';
	import { randomCrewName } from '$lib/config/crewNames';
	import InputTools from '$lib/components/ui/InputTools.svelte';

	/**
	 * Вхід у спільну партію.
	 *
	 * Компонент нічого не знає ні про базу, ні про кімнату — він збирає поля й
	 * кличе те, що дали. Виніс зі сторінки, коли та перетнула межу розміру файлу:
	 * форма існує рівно до появи матчу й далі не показується жодного разу.
	 *
	 * ## ЧОТИРИ БЛОКИ, а не один стовпчик
	 *
	 * Доти все лежало підряд: поле, кнопка, поле, кнопка. Читалося це як одна
	 * послідовність кроків, хоч кроки взаємно виключні — створити кімнату АБО
	 * зайти в чужу. Тепер видно, що імʼя спільне для обох шляхів, а далі шляхи
	 * розходяться:
	 *
	 *   1. Хто я             — імʼя, спільне для всього іншого
	 *   2. Створити кімнату  — прапорець закритості + кнопка
	 *   3. Зайти за кодом    — поле коду + кнопка
	 *   4. Список кімнат     — те, що передали знизу (`rooms`)
	 *
	 * Порядок саме такий, бо блок 4 з часом стає найчастішим шляхом: коли кімнати
	 * вже є, у них заходять зі списку, а не диктують код. Але імʼя потрібне й
	 * для нього, тож воно лишається першим.
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
		 * Список кімнат — четвертий блок. Його малює СТОРІНКА: вона знає мережу.
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
	<!-- ── 1. Хто я ─────────────────────────────────────────────────────────── -->
	<section class="gate__block">
		<label class="gate__field" for="pairs-name">
			<span>{@html formatFont(t('pairs.yourName'))}</span>
		</label>
		<div class="gate__row">
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
				Кидок кубика поруч із полем, а не замість імені за замовчуванням.

				Імʼя й далі підставляється саме, тож вигадувати його не мусять; кнопка
				існує для того, кому підставлене не сподобалося. `randomCrewName`
				отримує поточне значення й гарантовано віддає ІНШЕ — інакше один кидок
				із шістнадцяти виглядав би як зламана кнопка.
			-->
			<button
				type="button"
				class="gate__dice"
				onclick={() => (name = randomCrewName(td, Math.random, name.trim()))}
				aria-label={t('pairs.otherName')}
				data-testid="pairs-name-random-btn"
			>
				<Dices size={18} aria-hidden="true" />
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

	<!-- ── 2. Створити кімнату ──────────────────────────────────────────────── -->
	<section class="gate__block">
		<!--
			Прапорець стоїть ПЕРЕД кнопкою, і це не смак: він міняє те, що кнопка
			зробить, тож прочитати його треба до натиску, а не після.

			Типове значення — «відкрита» (прапорець зняток). Кімната, якої немає в
			списку, потребує, щоб код комусь передали; кімната зі списку не потребує
			нічого. Приватність тут — вибір для того, хто грає з конкретною людиною,
			а не типовий стан.
		-->
		<label class="gate__check">
			<input type="checkbox" bind:checked={isPrivate} data-testid="pairs-private-checkbox" />
			<span>{@html formatFont(t('pairs.privateRoom'))}</span>
		</label>
		<p class="gate__hint">{@html formatFont(t('pairs.privateRoomHint'))}</p>

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

	<!-- ── 3. Зайти за кодом ────────────────────────────────────────────────── -->
	<section class="gate__block">
		<label class="gate__field" for="pairs-code">
			<span>{@html formatFont(t('pairs.roomCode'))}</span>
		</label>
		<div class="gate__row">
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

	<!-- ── 4. Список кімнат ─────────────────────────────────────────────────── -->
	{#if roomList}
		<section class="gate__block gate__block--last">
			{@render roomList()}
		</section>
	{/if}
</div>

<style>
	.gate {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		width: 100%;
		max-width: 22rem;
		padding: var(--space-lg);
		border-radius: var(--radius-md);
		background: var(--color-bg-panel);
	}

	/*
	 * Блок відділяється РИСКОЮ, а не порожнім місцем.
	 *
	 * Відступи тут уже є всередині блоків, тож збільшений проміжок між ними читався
	 * б як «трохи більший проміжок», а не як межа. Риска каже, що далі інший вибір.
	 */
	.gate__block {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding-bottom: var(--space-md);
		border-bottom: 1px solid color-mix(in srgb, var(--color-text-on-panel), transparent 80%);
	}

	.gate__block:last-child,
	.gate__block--last {
		padding-bottom: 0;
		border-bottom: none;
	}

	.gate__field {
		font-size: var(--font-size-sm);
		color: var(--color-text-on-panel);
	}

	/* Поле й кнопки — один рядок; розтягується саме поле. */
	.gate__row {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
	}

	.gate__row input {
		flex: 1;
		/* `min-width: 0` — щоб поле стискалося замість розпирати рядок кнопками. */
		min-width: 0;
		min-height: 44px;
		padding: 0 var(--space-sm);
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
		background: var(--color-bg-card);
		color: var(--color-text);
		font: inherit;
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
		/*
		 * 44px, на відміну від кнопок `InputTools`: у цієї дії альтернативи в полі
		 * НЕМА — випадкове імʼя не набереш із клавіатури. Тобто виняток
		 * «доступна альтернатива існує» тут не діє, і стандарт сенсорної цілі
		 * лишається в силі.
		 */
		background: color-mix(in srgb, var(--color-text), transparent 92%);
		color: var(--color-text);
		cursor: pointer;
		padding: 0;
	}

	.gate__check {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		/* 44px на всю смугу: натискати мусить і підпис, а не лише сама позначка. */
		min-height: 44px;
		font-size: var(--font-size-sm);
		color: var(--color-text-on-panel);
		cursor: pointer;
	}

	.gate__check input {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		accent-color: var(--color-accent);
		cursor: pointer;
	}

	.gate__hint {
		margin: 0;
		/*
		 * ПІДКАЗКА ПРИГЛУШЕНА РОЗМІРОМ, А НЕ КОЛЬОРОМ — і це не стилістика.
		 *
		 * Тут стояло `opacity: 0.75` на `--color-text-on-panel`, і воно давало
		 * 3.75:1 у light-green проти потрібних 4.5. `--color-text-muted` не
		 * допомагає: він підібраний під тло СТОРІНКИ, а на панелі дає 3.48:1
		 * (light-green) і 3.23:1 (winter) — панель `#93bf4c` / `#80b3ff` сама
		 * світлий півтон, і приглушений текст на ній до AA не доходить нічим.
		 *
		 * Повний колір дає 6.16:1 і 6.38:1, а «тихість» лишається за розміром.
		 * Дрібніший кегль — теж ієрархія, тільки та, що не коштує читабельності.
		 */
		font-size: var(--font-size-xs);
		color: var(--color-text-on-panel);
	}

	/* Код диктують уголос і вводять великими: так його й показуємо. */
	.gate__code {
		text-transform: uppercase;
		letter-spacing: 0.25em;
	}
</style>
