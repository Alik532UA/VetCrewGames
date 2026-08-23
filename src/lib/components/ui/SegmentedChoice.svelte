<script lang="ts">
	import { formatFont } from '$lib/i18n';

	/**
	 * Вибір одного зі кількох станів — спільною панеллю з перемиканням.
	 *
	 * Зразок узято з `Slovko` (`class="segmented-control"`), на який показав автор.
	 * Перенесено ВИГЛЯД і не перенесено дві речі, і обидві не випадково.
	 *
	 * ## Не перенесено кольори
	 *
	 * Там тло панелі — `rgba(255, 255, 255, 0.03)`, активний сегмент —
	 * `rgba(255, 255, 255, 0.1)`, обводка — `rgba(255, 255, 255, 0.05)`. Літеральний
	 * білий під прозорістю працює лише поки тема темна: у цьому проєкті тем чотири,
	 * дві з них світлі, і рівно такий білий давав тут 106 вузлів невидимого тексту
	 * (заміряно `tests/contrast-runtime.spec.ts`). Тут та сама ідея зроблена
	 * домішкою КОЛЬОРУ ТЕКСТУ: у світлих темах це притінення, у темних підсвітка, і
	 * перевертається вона разом із темою сама.
	 *
	 * ## Не перенесено «дві кнопки»
	 *
	 * У `Slovko` це `<button class:active>` без жодного ARIA. На вигляд однаково, а
	 * для читалки — два звичайні натиски, з яких не видно ні того, що вибір ОДИН із
	 * двох, ні того, який зараз стоїть. Тут це справжня радіогрупа на нативних
	 * `<input type="radio">`: браузер сам дає «варіант 1 з 2», стрілки між
	 * варіантами й правильний фокус — нічого з цього не треба писати руками, і
	 * нічого з цього не можна забути.
	 *
	 * `<fieldset>` із `<legend>` — саме тому: підпис групи мусить бути ЧАСТИНОЮ
	 * групи, інакше читалка озвучує «Лише друзі, варіант 1 з 2», не сказавши, з
	 * чого саме вибір.
	 *
	 * ## Чому напис не переноситься
	 *
	 * `white-space: nowrap` плюс `clamp()` на кеглі — те саме рішення, що в
	 * `Slovko`, і причина там записана: довгі українські слова при фіксованому
	 * кеглі розпирали контрол за межі батька. Раз текст не можна ні переносити, ні
	 * обрізати — зменшується він сам.
	 */
	interface Option {
		/** Значення. Воно ж дискримінатор локатора: `{scope}-{id}-radio`. */
		id: string;
		label: string;
	}

	interface Props {
		/** Підпис групи. Малюється як `legend` і читається читалкою перед варіантами. */
		legend: string;
		options: Option[];
		value: string;
		onchange: (id: string) => void;
		/**
		 * Основа локаторів і ІМʼЯ радіогрупи.
		 *
		 * Імʼя обовʼязкове й мусить бути унікальним на сторінці: саме за ним браузер
		 * поєднує кнопки в одну групу. Дві групи з однаковим імʼям поводилися б як
		 * одна — і вибір в одній знімав би вибір у другій.
		 */
		scope: string;
	}

	let { legend, options, value, onchange, scope }: Props = $props();
</script>

<fieldset class="seg">
	<legend class="seg__legend">{@html formatFont(legend)}</legend>
	<div class="seg__track">
		{#each options as option (option.id)}
			<label class="seg__item" class:seg__item--on={value === option.id}>
				<input
					class="seg__radio"
					type="radio"
					name={scope}
					value={option.id}
					checked={value === option.id}
					onchange={() => onchange(option.id)}
					data-testid="{scope}-{option.id}-radio"
				/>
				<span class="seg__label">{@html formatFont(option.label)}</span>
			</label>
		{/each}
	</div>
</fieldset>

<style>
	/*
	 * `fieldset` без власного вигляду: він тут за семантику, а не за рамку.
	 * Типова рамка браузера намалювала б другу коробку навколо панелі.
	 */
	.seg {
		margin: 0;
		padding: 0;
		border: none;
		min-width: 0;
	}

	.seg__legend {
		padding: 0;
		margin-bottom: var(--space-xs);
		font-size: var(--font-size-sm);
		color: var(--color-text-on-panel);
	}

	/*
	 * Спільна панель, у якій живуть сегменти — і в неї СВОЄ тло.
	 *
	 * Було `color-mix(… transparent 94%)`, тобто шестивідсотковий натяк. На сторінці
	 * панель лежить просто на фотографії тла, і напис невибраного сегмента
	 * опинявся на фотографії — автор сказав про це прямо: «стильно, але немає
	 * фону, текст погано читається».
	 *
	 * Тло взято те саме, що в глобального `.text-panel`, а не вигадане: воно вже
	 * перевірене гейтом контрасту в усіх чотирьох темах разом із
	 * `--color-text-on-panel`, яким тут пофарбовані сегменти. Своє значення
	 * означало б нову пару, якої гейт не бачив.
	 *
	 * `backdrop-filter` тут теж не для краси: без розмиття будь-яка фотографія
	 * просвічує крізь напівпрозоре тло дрібними деталями, і саме вони роблять
	 * текст нечитабельним.
	 */
	.seg__track {
		display: flex;
		gap: 2px;
		padding: 4px;
		border-radius: var(--radius-md);
		border: 1px solid color-mix(in srgb, var(--color-text-on-panel), transparent 82%);
		background: color-mix(in srgb, var(--color-bg-surface), transparent 25%);
		backdrop-filter: var(--blur-glass);
	}

	/*
	 * Фокус видно на ПАНЕЛІ, а не на сегменті: сама радіокнопка прихована, і без
	 * цього рядка обхід клавіатурою був би невидимим.
	 */
	.seg__track:focus-within {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}

	.seg__item {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		/* 44px — власний стандарт сенсорної цілі (ACCESSIBILITY-v8 § 8). */
		min-height: 44px;
		padding: 0 var(--space-xs);
		border-radius: var(--radius-sm);
		color: var(--color-text-on-panel);
		cursor: pointer;
		/*
		 * Перехід лише на тому, що справді міняється. `all` тут ловив би ще й
		 * `outline` фокусу, і рамка приїжджала б із запізненням.
		 */
		transition:
			background-color var(--transition-fast),
			color var(--transition-fast);
	}

	@media (hover: hover) {
		.seg__item:hover:not(.seg__item--on) {
			background: color-mix(in srgb, var(--color-text-on-panel), transparent 88%);
		}
	}

	/*
	 * Вибране — суцільний акцент, а не той самий колір під іншою прозорістю.
	 *
	 * Той самий висновок, що в меню тем: два стани одного кольору під різною
	 * прозорістю майже не відрізняються, а `--color-text-on-accent` існує саме для
	 * пари з акцентом і в кожній темі підібраний під нього окремо.
	 */
	.seg__item--on {
		background: var(--color-accent);
		color: var(--color-text-on-accent);
		font-weight: var(--font-weight-bold);
	}

	/*
	 * Радіокнопка ПРИХОВАНА, але не `display: none`.
	 *
	 * `display: none` і `visibility: hidden` виймають елемент із порядку фокуса, і
	 * група перестає керуватися з клавіатури — тобто зникає рівно те, задля чого
	 * взято нативні радіокнопки. Тому вона розміром у піксель і обрізана.
	 */
	.seg__radio {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		border: 0;
	}

	/*
	 * Напис не переноситься й не обрізається — зменшується.
	 *
	 * Те саме рішення, що в `Slovko`, і з тієї самої причини: «Лише друзі» й «Для
	 * всіх» при фіксованому кеглі розпирали панель на вузькому екрані.
	 */
	.seg__label {
		white-space: nowrap;
		font-size: clamp(0.7rem, 3vw, var(--font-size-sm));
		text-align: center;
	}
</style>
