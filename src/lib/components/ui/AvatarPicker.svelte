<script lang="ts">
	import { formatFont } from '$lib/i18n';
	import { AVATAR_COLORS, AVATAR_ICONS, formatAvatar, parseAvatar } from '$lib/config/avatars';
	import Avatar from './Avatar.svelte';

	/**
	 * ВИБІР АВАТАРА — плитка згори, під нею рядок кольорів і рядок значків.
	 *
	 * Склад узято зі знімка редактора в сусідньому `Slovko`, на який показав
	 * автор. Не перенесено три речі, і кожну — навмисно.
	 *
	 * ## Не перенесено кнопки «підтвердити» і «скасувати»
	 *
	 * Там редактор — окремий екран модалки, тож йому потрібен власний вихід. Тут
	 * він стоїть У ФОРМІ ПРОФІЛЮ, поруч з іменем, псевдонімом і країною, і в тієї
	 * форми вже є «Зберегти». Другий «підтвердити» посеред неї означав би два
	 * різних збереження на одному екрані — і питання, яке з них головне.
	 *
	 * ## Не перенесено фото й прапори як тло
	 *
	 * Фото ніде взяти: Storage у проєкті немає, входу через Google теж (причина —
	 * у `net/account.ts`). А прапор тут ОКРЕМА річ: він стоїть у тому самому
	 * рядку списку й каже країну. Той самий прапор ще й тлом аватара сказав би те
	 * саме двічі, а місце в рядку зайняв би за двох.
	 *
	 * ## Не перенесено `button class:active`
	 *
	 * Там кожен варіант — звичайна кнопка без ARIA. На вигляд однаково, а для
	 * читалки це десятки окремих натисків, з яких не видно ні того, що вибір
	 * ОДИН, ні того, який стоїть зараз. Тут це дві справжні радіогрупи на
	 * нативних `input type="radio"`: браузер сам дає «варіант 3 з 14», стрілки
	 * між варіантами й правильний фокус.
	 *
	 * Підпис варіанта живе в `aria-label`, а не текстом у кнопці: сорок слів
	 * («Кіт», «Синій») під плитками зайняли б утричі більше місця, ніж самі
	 * плитки, і рядок перестав би читатися як рядок. Тому назви є там, де вони
	 * потрібні (читалка), і немає там, де без них зрозуміло (око бачить кота).
	 */
	interface Props {
		/** Рядок `значок:колір`. Двобічне. */
		value: string;
		/**
		 * Перекладач сторінки, а не власний доступ до словника — те саме
		 * міркування, що в `auth/AuthForm.svelte`: рядки акаунта лежать у
		 * ЛИНИВОМУ чанку, і тримає його сторінка.
		 */
		text: (key: string) => string;
		/**
		 * Основа локаторів і ІМʼЯ радіогруп. Імен тут два («-color» і «-icon»), і
		 * обидва мусять бути унікальні на сторінці: саме за імʼям браузер поєднує
		 * кнопки в одну групу.
		 */
		scope: string;
		/**
		 * ВИБІР ВІДДАЄТЬСЯ ВГОРУ, а не пишеться двобічним звʼязком.
		 *
		 * Доти тут стояло `bind:value`, і для форми з кнопкою «Зберегти» цього було
		 * досить. Тепер аватар зберігається САМИМ вибором, тобто натиск — це
		 * мережева дія, яка може не вдатися: власник значення мусить побачити її
		 * відповідь і, якщо не вийшло, повернути попереднє. Двобічний звʼязок такого
		 * не дає — він уже переписав значення до того, як хтось про це дізнався.
		 */
		onchange: (avatar: string) => void;
		/** Поки триває запис, вибір не приймає натисків: другий дав би дві дії. */
		disabled?: boolean;
		/**
		 * Велика плитка згори. У формі входу її немає: там вибір розгортається під
		 * плиткою-кнопкою, яка й так показує поточну аватарку (`AvatarChooser`).
		 */
		preview?: boolean;
		/**
		 * ЗАЙНЯТІ ПАРИ — у кімнаті (рішення автора 2026-09-26): пара → імʼя власника.
		 * Клітинка зайнятої пари видна, але не натискається, і підпис каже, чия вона:
		 * зникла клітинка читалася б як «такого кольору немає».
		 */
		taken?: ReadonlyMap<string, string>;
	}

	let { value, text, scope, onchange, disabled = false, preview = true, taken }: Props = $props();

	/** Чия пара — або `undefined`, якщо вільна. */
	const holderOf = (avatar: string) => taken?.get(avatar);

	/**
	 * Вибрати пару — лише вільну. `disabled` на клітинці тримає це для людини, а тут
	 * — для будь-якого іншого шляху до `change` (подія, надіслана скриптом, старий
	 * браузер): правило «зайняту не взяти» не мусить триматися на одному атрибуті.
	 */
	const pick = (pair: string) => {
		if (holderOf(pair) === undefined) onchange(pair);
	};

	/** Підпис клітинки: назва варіанта, а для зайнятої — ще й чия вона. */
	const labelOf = (key: string, avatar: string) => {
		const holder = holderOf(avatar);
		const name = text(key);
		return holder === undefined
			? name
			: `${name} — ${text('account.avatarTakenBy').replace('{name}', holder)}`;
	};

	/*
	 * Розібраний аватар, а не два окремих стани.
	 *
	 * Пара полів `icon`/`color` поруч зі рядком `value` дала б три джерела однієї
	 * правди й потребувала б ефекту, щоб їх звести. Тут єдине джерело — рядок, а
	 * половинки з нього ВИВОДЯТЬСЯ; вибір кольору збирає рядок назад із наявним
	 * значком, і навпаки.
	 */
	const look = $derived(parseAvatar(value));
</script>

<div class="pick">
	{#if preview}
		<div class="pick__preview">
			<Avatar avatar={formatAvatar(look.icon, look.color)} size={72} showDefault />
		</div>
	{/if}

	<fieldset class="pick__group">
		<legend class="pick__legend">{@html formatFont(text('account.avatarColors'))}</legend>
		<div class="seg-track">
			{#each AVATAR_COLORS as color (color)}
				{@const pair = formatAvatar(look.icon, color)}
				<label
					class="seg-item pick__cell"
					class:pick__cell--on={look.color === color}
					class:pick__cell--taken={holderOf(pair) !== undefined}
				>
					<input
						class="pick__radio"
						type="radio"
						name="{scope}-color"
						value={color}
						checked={look.color === color}
						onchange={() => pick(pair)}
						disabled={disabled || holderOf(pair) !== undefined}
						aria-label={labelOf(`account.avatarColor.${color}`, pair)}
						data-testid="{scope}-color-{color}-radio"
					/>
					<!--
						У кожній клітинці кольору стоїть ПОТОЧНИЙ значок, а не абстрактний
						кружок: людина вибирає не «синій», а «синього кота», і саме його й
						мусить бачити до натиску.
					-->
					<Avatar avatar={formatAvatar(look.icon, color)} size={30} showDefault />
				</label>
			{/each}
		</div>
	</fieldset>

	<fieldset class="pick__group">
		<legend class="pick__legend">{@html formatFont(text('account.avatarIcons'))}</legend>
		<div class="seg-track">
			{#each AVATAR_ICONS as icon (icon)}
				{@const pair = formatAvatar(icon, look.color)}
				<label
					class="seg-item pick__cell"
					class:pick__cell--on={look.icon === icon}
					class:pick__cell--taken={holderOf(pair) !== undefined}
				>
					<input
						class="pick__radio"
						type="radio"
						name="{scope}-icon"
						value={icon}
						checked={look.icon === icon}
						onchange={() => pick(pair)}
						disabled={disabled || holderOf(pair) !== undefined}
						aria-label={labelOf(`account.avatarIcon.${icon}`, pair)}
						data-testid="{scope}-icon-{icon}-radio"
					/>
					<Avatar avatar={formatAvatar(icon, look.color)} size={30} showDefault />
				</label>
			{/each}
		</div>
	</fieldset>
</div>

<style>
	.pick {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.pick__preview {
		display: flex;
		justify-content: center;
		padding: var(--space-xs) 0;
	}

	/*
	 * `fieldset` без власного вигляду: він тут за семантику, а не за рамку —
	 * те саме рішення, що в `SegmentedChoice`.
	 */
	.pick__group {
		margin: 0;
		padding: 0;
		border: none;
		min-width: 0;
	}

	.pick__legend {
		padding: 0;
		margin-bottom: var(--space-xs);
		font-size: var(--font-size-sm);
		color: var(--color-text-on-panel);
	}

	/*
	 * Ряди плиток — СМУГОЮ, як кожен вибір у застосунку (`.seg-track`, `.seg-item` у
	 * `global.css`): одне поле замість чотирнадцяти окремих клітинок на панелі.
	 */

	/*
	 * Клітинка — 44px, хоч плитка всередині 30px.
	 *
	 * 44px тут не про красу: це власний стандарт сенсорної цілі
	 * (ACCESSIBILITY-v8 § 8), і чотирнадцять плиток по 30px давали б цілі, у які
	 * пальцем не влучити. Різниця йде в поле навколо плитки, а не в її розмір:
	 * великі плитки в два рядки не влізли б у панель.
	 */
	.pick__cell {
		flex: 0 0 44px;
		width: 44px;
		height: 44px;
		padding: 0;
	}

	/*
	 * Фокус видно на КЛІТИНЦІ: сама радіокнопка прихована, і без цього рядка
	 * обхід клавіатурою був би невидимим.
	 */
	.pick__cell:focus-within {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}

	/*
	 * Вибране позначене КІЛЬЦЕМ, а не заливкою — і тому тут не `.seg-item--on`, як у
	 * решти смуг.
	 *
	 * Заливка тут неможлива: усередині клітинки лежить плитка свого власного
	 * кольору, і будь-яке тло за нею сперечалося б із ним — вісім разів у рядку
	 * кольорів. Кільце ж лишається видимим на кожному з восьми. `box-shadow`
	 * усередину, а не рамка: у сегмента смуги рамки немає.
	 *
	 * КІЛЬЦЕ — КОЛЬОРОМ ТЕКСТУ, а не акценту. Тут стояла рамка акценту, і заміряно:
	 * на світлій смузі в light-green і winter вона дає 1.28 і 1.38:1 при потрібних
	 * 3:1 (WCAG 1.4.11). А в плитки кільце — ЄДИНА ознака вибору: ні напису, ні
	 * напівжирності в неї немає. Колір тексту панелі перевертається разом із темою
	 * й тримає контраст у всіх чотирьох — 6.65–10.49:1, заміряно проти смуги й проти
	 * власної підкладки клітинки; акцентна підкладка лишилася як тепла підказка, а
	 * не носій стану.
	 */
	/*
	 * Зайнята пара — приглушена й без курсора-руки. Контраст тут не мірило: WCAG
	 * 1.4.3/1.4.11 не поширюються на НЕАКТИВНІ елементи, а що клітинка неактивна, каже
	 * сам `disabled` (і підпис — чия вона).
	 */
	.pick__cell--taken {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.pick__cell--on {
		box-shadow: inset 0 0 0 2px var(--color-text-on-panel);
		background: color-mix(in srgb, var(--color-accent), transparent 80%);
	}

	/*
	 * Радіокнопка ПРИХОВАНА, але не `display: none`: він виймає елемент із
	 * порядку фокуса, і група перестає керуватися з клавіатури — тобто зникає
	 * рівно те, задля чого взято нативні радіокнопки.
	 */
	.pick__radio {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		border: 0;
	}
</style>
