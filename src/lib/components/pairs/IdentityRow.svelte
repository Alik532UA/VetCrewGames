<script lang="ts">
	import { Dices } from 'lucide-svelte';
	import { t, formatFont } from '$lib/i18n';
	import InputTools from '$lib/components/ui/InputTools.svelte';
	import CountryPicker from '$lib/components/ui/CountryPicker.svelte';
	import AvatarChooser from '$lib/components/ui/AvatarChooser.svelte';

	/**
	 * «ХТО Я» — ПІДПИС ГРАВЦЯ ОДНИМ РЯДКОМ: прапор, аватарка, імʼя, кубик.
	 *
	 * Винесено з `OnlineGate`, коли туди додалася аватарка: форма перетнула межу
	 * розміру файлу, а сам рядок — окрема відповідь на одне питання, «як мене видно
	 * іншим». Порядок — той самий, що в рядку складу кімнати (`OnlineLobby`) і в
	 * переліку кімнат: прапор, плитка, імʼя.
	 *
	 * Компонент нічого не знає ні про мережу, ні про сховище: імʼя й прапор —
	 * двобічні, аватарку й кубик обробляє власник (`PlayerIdentity`).
	 */
	interface Props {
		/** Імʼя гравця. Двобічне. */
		name: string;
		/** Прапор гравця. Порожній рядок — без прапора. Двобічне. */
		country: string;
		/** Аватарка; порожньо — не вибирав. Вибір зберігає власник. */
		avatar: string;
		onAvatar: (avatar: string) => void;
		/** Кубик: підставити інше імʼя (словник і зайняті імена знає сторінка). */
		onRandomName: () => void;
		/** Пари, які вже тримають у кімнаті (вікно «вас запросили»), — їх не вибрати. */
		taken?: ReadonlyMap<string, string>;
	}

	let {
		name = $bindable(),
		country = $bindable(),
		avatar,
		onAvatar,
		onRandomName,
		taken
	}: Props = $props();

	let nameInput = $state<HTMLInputElement | null>(null);
</script>

<div class="identity">
	<label class="identity__label" for="pairs-name">
		<span>{@html formatFont(t('pairs.yourName'))}</span>
	</label>
	<!--
		КНОПКИ — ЧАСТИНА ПОЛЯ, а не сусіди праворуч від нього.

		Рамку й тло малює ОБГОРТКА, а не сам `input`, тож кнопки стоять усередині
		тієї самої рамки — саме той вигляд, що в `teatralo4ka`, на який показав
		автор. Там це зроблено накладанням (`position: absolute` плюс
		зарезервований `padding-right`), бо рамку там малює саме поле; тут обгортку
		пишемо ми, і ряд flex дає те саме без жодного магічного відступу — кнопки
		з'являються й зникають, а поле просто перетікає. Сама обгортка —
		`.field-shell` у `global.css`: та сама й у поля коду кімнати.
	-->
	<div class="identity__row">
		<!--
			ПРАПОР — ПЕРЕД НІКОМ, а не окремим рядком.

			Окремий рядок із підписом «Прапор» читався як ще одне налаштування
			кімнати, хоч це частина того самого підпису гравця: прапор і імʼя — одна
			річ, яку бачать інші. Тепер вони й стоять як одна.
		-->
		<CountryPicker bind:value={country} scope="pairs-country" compact />
		<!--
			АВАТАРКА — між прапором і іменем. У формі входу — будь-яка з усіх: кімнати ще
			немає, і зайнятою пара бути не може (прохання автора 2026-09-26); у вікні «вас
			запросили» — лише вільні (`taken`). Вибір розгортається окремим рядком під цим
			(`AvatarChooser`).
		-->
		<AvatarChooser value={avatar} onpick={onAvatar} scope="pairs-avatar" {taken} />
		<div class="field-shell has-input-tools identity__field">
			<input
				id="pairs-name"
				type="text"
				bind:this={nameInput}
				bind:value={name}
				maxlength="48"
				placeholder={t('pairs.nickname')}
				data-testid="pairs-name-input"
			/>
			<InputTools
				bind:value={name}
				input={nameInput}
				tools={['paste', 'clear']}
				scope="pairs-name"
				fieldLabel={t('pairs.yourName')}
			/>
		</div>
		<!--
			КУБИК — ПОЗА ПОЛЕМ, праворуч від нього, і це вибір автора.

			Я був поставив його всередину заодно з «вставити» й «очистити», бо одна
			кнопка зовні поруч із двома всередині здалася недоробленою. Автор
			повернув назовні, і в цьому є своя логіка: «вставити» й «очистити» діють
			на ТЕКСТ, який уже в полі, а кубик пише туди НОВЕ значення. Різна природа
			— різне місце.

			44px, а не 32: поза полем місце є, а власний стандарт сенсорної цілі
			(ACCESSIBILITY-v8 § 8) виняток вимагає лише там, де його нема куди
			подіти.

			Імʼя й далі підставляється саме, тож вигадувати його не мусять; кубик
			існує для того, кому підставлене не сподобалося, і віддає ГАРАНТОВАНО
			інше — інакше один кидок із вісімдесяти шести виглядав би як зламана
			кнопка.

			ЗАЙНЯТІ ІМЕНА ТЕЖ ВИКЛЮЧАЮТЬСЯ, але вирішує це сторінка: перелік тих,
			хто вже онлайн, приходить із мережі. Кидок, що віддав уже видане імʼя,
			технічно правильний і практично шкідливий — два однакових рядки в
			списку роблять неможливим вибір «до кого зайти».
		-->
		<button
			type="button"
			class="identity__dice"
			onclick={onRandomName}
			aria-label={t('pairs.otherName')}
			data-testid="pairs-name-random-btn"
		>
			<Dices size={18} aria-hidden="true" />
		</button>
	</div>
</div>

<style>
	/*
	 * Контейнер — корінь, а не екран і не форма: ширина рядка — це ширина ПАНЕЛІ, у
	 * якій він стоїть, а вона вузька й на широкому екрані (три стовпці форми входу).
	 */
	.identity {
		container: identity / inline-size;
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.identity__label {
		font-size: var(--font-size-sm);
		color: var(--color-text-on-panel);
	}

	/*
	 * Поле й кубик поруч: розтягується поле, кубик лишається свого розміру.
	 *
	 * `flex-wrap` — для вибору аватарки: він елемент ЦЬОГО ряду з повною шириною й
	 * переноситься під нього сам (`AvatarChooser`). Решта в широкій панелі не
	 * переноситься ніколи: поле має `flex: 1` і `min-width: 0`, тобто стискається
	 * раніше, ніж ряд вирішить переносити.
	 */
	.identity__row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-xs);
	}

	.identity__field {
		flex: 1;
		min-width: 0;
	}

	/*
	 * ВУЗЬКА ПАНЕЛЬ — ДВА РЯДКИ: прапор і аватарка зверху, імʼя з кубиком під ними.
	 *
	 * У ряду три кнопки по 44px, і поле імені отримує решту. Доти кнопок було дві, а
	 * з аватаркою на телефоні 390px полю лишалося ~160px, з яких 60 — «вставити» й
	 * «очистити», тобто видно було одне слово з двох; на 280px поле стискалося до
	 * 58px — лише самі кнопки. Тому нижче 20rem поле бере свій рядок разом із
	 * кубиком: основа «100% мінус кубик» не влазить поруч із прапором і плиткою й
	 * переносить поле сама, а кубик стає поруч із ним. Порядок читання той самий —
	 * прапор, плитка, імʼя.
	 */
	@container identity (max-width: 20rem) {
		.identity__field {
			flex: 1 0 calc(100% - 44px - var(--space-xs));
		}
	}

	.identity__dice {
		width: 44px;
		height: 44px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-text), transparent 92%);
		color: var(--color-text);
		cursor: pointer;
		padding: 0;
	}

	@media (hover: hover) {
		.identity__dice:hover {
			background: color-mix(in srgb, var(--color-text), transparent 82%);
		}
	}
</style>
