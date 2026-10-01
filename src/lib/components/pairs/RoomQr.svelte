<script lang="ts">
	import { Check, Copy } from 'lucide-svelte';
	import { t, formatFont } from '$lib/i18n';
	import { logService } from '$lib/services/logService.svelte';

	/**
	 * QR-код на кімнату: навів камеру — зайшов.
	 * Також надає кнопку копіювання посилання, щоб зайти можна було в один клік.
	 */
	interface Props {
		/** Повне посилання на кімнату. Порожнє — не малюємо нічого. */
		url: string;
	}

	let { url }: Props = $props();

	/** Розмір матриці й шлях її темних модулів. `null` — ще не порахували. */
	let matrix = $state<{ size: number; path: string } | null>(null);
	let copied = $state(false);
	let copiedTimeout: ReturnType<typeof setTimeout> | undefined;

	async function copyUrl() {
		try {
			await navigator.clipboard.writeText(url);
			copied = true;
			clearTimeout(copiedTimeout);
			copiedTimeout = setTimeout(() => {
				copied = false;
			}, 2500);
		} catch (error) {
			logService.warn('ui', 'clipboard copy denied', { reason: String(error) });
		}
	}

	/**
	 * Тиха зона — ЧОТИРИ модулі, як вимагає стандарт.
	 *
	 * Не косметичний відступ: сканер шукає межу коду за контрастом, і без рамки
	 * світлого поля він не знаходить її на тлі сторінки. Чотири — мінімум зі
	 * специфікації, менше різко знижує розпізнавання на телефонах.
	 */
	const QUIET = 4;

	$effect(() => {
		const value = url;
		if (value === '') {
			matrix = null;
			return;
		}

		let dead = false;
		void (async () => {
			try {
				const { default: qrcode } = await import('qrcode-generator');
				/*
				 * `0` — версія підбирається сама під довжину даних; `'M'` — рівень
				 * корекції близько 15%.
				 *
				 * Не `'L'` (7%): код дивиться камера з руки, під кутом і при будь-якому
				 * світлі, а сама матриця від вищого рівня росте на один-два кроки —
				 * тобто платимо дрібницею за те, що він читається з першого разу.
				 */
				const qr = qrcode(0, 'M');
				qr.addData(value);
				qr.make();

				const size = qr.getModuleCount();
				/*
				 * ОДИН `path` на всі темні модулі: `M x y h1 v1 h-1 z` на кожен.
				 *
				 * Пʼятсот окремих `<rect>` браузер малює й розкладає окремо, і на
				 * телефоні це видно паузою. Один шлях — один вузол.
				 */
				let path = '';
				for (let row = 0; row < size; row++) {
					for (let col = 0; col < size; col++) {
						if (qr.isDark(row, col)) path += `M${col + QUIET} ${row + QUIET}h1v1h-1z`;
					}
				}

				if (!dead) matrix = { size, path };
			} catch (error) {
				// Код на екрані лишається, тобто зайти можна й без QR. Тому це
				// попередження, а не помилка: нічого не зламалося, лише не додалося.
				logService.warn('ui', 'QR not built', { reason: String(error) });
				if (!dead) matrix = null;
			}
		})();

		return () => {
			dead = true;
		};
	});

	const side = $derived(matrix === null ? 0 : matrix.size + QUIET * 2);
</script>

{#if matrix !== null}
	<div class="qr">
		<!--
			ЧОРНЕ НА БІЛОМУ ЗАВЖДИ, і це не забута підтримка тем.

			Сканери телефонів навчені на темних модулях по світлому полю; інверсія
			читається далеко не всіма камерами, а частиною — тільки з другої спроби.
			Тому QR тут лишається одним і тим самим у всіх чотирьох темах: він не
			елемент оформлення, а мішень для камери.
		-->
		<svg
			class="qr__code"
			viewBox="0 0 {side} {side}"
			role="img"
			aria-label={t('pairs.qrLabel')}
			data-testid="pairs-room-qr-img"
		>
			<rect width={side} height={side} fill="#ffffff" />
			<path d={matrix.path} fill="#000000" />
		</svg>
		<span class="qr__hint">{@html formatFont(t('pairs.qrHint'))}</span>
		<button
			type="button"
			class="btn-secondary qr__copy-btn"
			onclick={copyUrl}
			data-testid="room-qr-copy-btn"
		>
			{#if copied}
				<Check size={18} aria-hidden="true" />
				<span>{@html formatFont(t('pairs.linkCopied'))}</span>
			{:else}
				<Copy size={18} aria-hidden="true" />
				<span>{@html formatFont(t('pairs.copyLink'))}</span>
			{/if}
		</button>
	</div>
{/if}

<style>
	.qr {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-sm);
		width: 100%;
	}

	/*
	 * `image-rendering: pixelated` — щоб модулі лишалися квадратами.
	 *
	 * SVG масштабується без втрат, але браузер згладжує межі при неціло́му
	 * масштабі, і тонка сіра кайма навколо кожного модуля знижує контраст саме
	 * там, де сканер його міряє.
	 *
	 * НА ВСЮ ШИРИНУ ПАНЕЛІ, а не 168px. Тут стояло `clamp(120px, 40vw, 168px)` —
	 * число з часів, коли QR був плашкою в стовпчику, — і в панелі запрошення він
	 * займав менше половини ширини. Скарга автора: «замалий, по ширині
	 * контейнера». Більший код і сканується легше: з руки, під кутом, із другого
	 * боку столу. SVG від масштабу не розмивається, тож цьому ніщо не заважає.
	 */
	.qr__code {
		width: 100%;
		height: auto;
		border-radius: var(--radius-sm);
		image-rendering: pixelated;
	}

	.qr__hint {
		font-size: var(--font-size-xs);
		text-align: center;
	}

	.qr__copy-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-xs);
		min-height: 40px;
		width: 100%;
		padding: 0 var(--space-md);
		border-radius: var(--radius-sm);
		font: inherit;
		font-size: var(--font-size-sm);
		cursor: pointer;
	}
</style>
