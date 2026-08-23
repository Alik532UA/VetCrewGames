<script lang="ts">
	import { ClipboardPaste, Copy, Eraser } from 'lucide-svelte';
	import { browser } from '$app/environment';
	import { t } from '$lib/i18n';
	import { toast } from '$lib/controllers/toast.svelte';
	import { logService } from '$lib/services/logService.svelte';

	/**
	 * Кнопки поля вводу: вставити, скопіювати, стерти.
	 *
	 * Перенесено з сусіднього `teatralo4ka.odesa.ua`, на який показав автор, — але
	 * не скопійовано: там інша система перекладу (`svelte-i18n`, `$t`) і тост із
	 * привʼязкою до елемента, якої тут немає. Спільним лишилося те, що є
	 * рішеннями, а не кодом, і кожне з них нижче названо.
	 *
	 * ## Чому окремий компонент
	 *
	 * Три кнопки, обробка відмови буфера обміну й повернення фокусу, розкопійовані
	 * по полях, розходяться на першій же правці — і розходяться ТИХО: кнопка, що
	 * втратила `input?.focus()`, виглядає працюючою.
	 *
	 * ## Чому очищення позначене ластиком, а не хрестиком
	 *
	 * Хрестик у полі читається двозначно: у тому ж рядку часто стоїть хрестик
	 * закриття. Дві однакові позначки поруч із різними наслідками — помилка за
	 * замовчуванням.
	 *
	 * ## Чому набір кнопок задається ззовні
	 *
	 * «Скопіювати» доречне там, звідки вміст ЗАБИРАЮТЬ. У полі імені забирати
	 * нічого — там вводять; у полі коду кімнати, навпаки, копіювання головне: код
	 * диктують і надсилають.
	 *
	 * ## Чому кнопки поза порядком табуляції
	 *
	 * `Tab` із поля має вести до НАСТУПНОГО поля, а не до трьох дрібних кнопок
	 * усередині поточного. Клавіатура нічого не втрачає: кожна кнопка дублює дію,
	 * яка вже є в самому полі (`Ctrl+V`, `Ctrl+C`, виділення й `Delete`). Тобто це
	 * зручність для миші й дотику, а не єдиний шлях до дії.
	 */
	type Tool = 'paste' | 'copy' | 'clear';

	interface Props {
		/** Значення поля. «Вставити» й «стерти» його змінюють. */
		value: string;
		/** Саме поле — щоб повернути в нього фокус після дії. */
		input?: HTMLInputElement | null;
		/** Які кнопки показати. Порядок у розмітці сталий і від цього не залежить. */
		tools?: Tool[];
		/** Основа локаторів: `pairs-name` дає `pairs-name-paste-btn`. */
		scope: string;
		/**
		 * Назва поля для підпису кнопки.
		 *
		 * Без неї диктор прочитає «Вставити» однаково на кожному полі сторінки, і
		 * вибрати з них потрібне буде неможливо. У формі входу таких полів два.
		 */
		fieldLabel?: string;
		/**
		 * Кличеться після вставки й очищення, якщо поле має власну нормалізацію.
		 * Код кімнати, наприклад, зводиться до великих літер — без цього виклику
		 * вставлене значення обійшло б нормалізацію.
		 */
		onchange?: (value: string) => void;
	}

	let {
		value = $bindable(),
		input = null,
		tools = ['paste', 'copy', 'clear'],
		scope,
		fieldLabel,
		onchange
	}: Props = $props();

	/**
	 * Стала, не стан: підтримка буфера не змінюється за час життя сторінки.
	 *
	 * Поза HTTPS `navigator.clipboard` відсутній зовсім, і кнопка вставки була б
	 * мертвою — клік не робив би нічого, а причину видно лише в консолі. На
	 * сервері `navigator` немає, тож у пререндері кнопки в розмітці не буде; вона
	 * зʼявиться при гідратації.
	 */
	const canPaste = browser && typeof navigator.clipboard?.readText === 'function';

	/**
	 * `aria-label` БЕЗ `formatPlain()` — конвенція проєкту: та функція міняє
	 * кириличну «і» на латинську «i» для шрифту inglobal, і диктор вимовляє
	 * покруч.
	 */
	const label = (action: string) => (fieldLabel ? `${action}: ${fieldLabel}` : action);

	const showPaste = $derived(tools.includes('paste') && canPaste);
	/** Копіювати нічого й стирати нема чого, поки поле порожнє. */
	const showCopy = $derived(tools.includes('copy') && value.length > 0);
	const showClear = $derived(tools.includes('clear') && value.length > 0);

	async function paste() {
		try {
			const text = await navigator.clipboard.readText();
			// Порожній буфер — не помилка й не привід для повідомлення: людина просто
			// нічого не копіювала. Тихо лишаємо поле як є.
			if (text) {
				value = text;
				onchange?.(text);
			}
			input?.focus();
		} catch (error) {
			/*
			 * Найчастіша причина — відмова в дозволі, і це не збій застосунку.
			 * Повідомлення КАЖЕ, ЩО РОБИТИ: `Ctrl+V` працює й тоді, коли читання
			 * буфера з коду заборонене, бо вставку робить сам браузер.
			 */
			toast.info('common.pasteDenied', 5000);
			logService.warn('ui', 'clipboard read denied', { scope, reason: reasonOf(error) });
		}
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			toast.success('common.copied', 2000);
			input?.focus();
		} catch (error) {
			/*
			 * `writeText` відмовляє в буденних умовах: вкладка не у фокусі, сторінка
			 * не через https, потрібен окремий дозвіл. Цей самий випадок уже ловився
			 * в проєкті — звіт чеклиста, і там кнопка МОВЧАЛА, тобто виглядала
			 * натиснутою, а результату не було ніде.
			 */
			toast.info('common.copyDenied', 5000);
			logService.warn('ui', 'clipboard write denied', { scope, reason: reasonOf(error) });
		}
	}

	function clear() {
		value = '';
		onchange?.('');
		input?.focus();
	}

	const reasonOf = (error: unknown): string =>
		error instanceof Error ? error.message : String(error);
</script>

<span class="tools">
	{#if showPaste}
		<button
			type="button"
			class="tools__btn"
			onclick={paste}
			tabindex="-1"
			aria-label={label(t('common.paste'))}
			data-testid="{scope}-paste-btn"
		>
			<ClipboardPaste size={16} aria-hidden="true" />
		</button>
	{/if}
	{#if showCopy}
		<button
			type="button"
			class="tools__btn"
			onclick={copy}
			tabindex="-1"
			aria-label={label(t('common.copy'))}
			data-testid="{scope}-copy-btn"
		>
			<Copy size={16} aria-hidden="true" />
		</button>
	{/if}
	{#if showClear}
		<button
			type="button"
			class="tools__btn"
			onclick={clear}
			tabindex="-1"
			aria-label={label(t('common.clear'))}
			data-testid="{scope}-clear-btn"
		>
			<Eraser size={16} aria-hidden="true" />
		</button>
	{/if}
</span>

<style>
	.tools {
		display: flex;
		align-items: center;
		gap: 2px;
		flex-shrink: 0;
	}

	.tools__btn {
		/*
		 * 28px, а не 44px, і це свідоме відхилення від власного стандарту
		 * сенсорної цілі.
		 *
		 * Причина в тому, що ці кнопки НЕ Є єдиним шляхом до дії: кожна дублює те,
		 * що поле вміє саме (`Ctrl+V`, `Ctrl+C`, `Delete`). WCAG 2.5.8 (AA, 24×24)
		 * виконано з запасом; 2.5.5 (AAA, 44×44) — ні, і це той самий виняток
		 * «доступна альтернатива існує», який критерій прямо передбачає. Кнопка на
		 * 44px усередині поля на 44px не лишила б місця самому тексту.
		 */
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: var(--radius-sm);
		/* Домішка кольору тексту — та сама ідіома, що в `.header-btn`: у світлих
		   темах це притінення, у темних підсвітка, і перевертається вона сама. */
		background: color-mix(in srgb, var(--color-text), transparent 92%);
		color: var(--color-text);
		cursor: pointer;
		padding: 0;
	}

	@media (hover: hover) {
		.tools__btn:hover {
			background: color-mix(in srgb, var(--color-text), transparent 82%);
		}
	}
</style>
