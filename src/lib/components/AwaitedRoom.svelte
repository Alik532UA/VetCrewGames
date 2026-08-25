<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { formatFont } from '$lib/i18n';
	import { settings } from '$lib/services/settings.svelte';
	import { langPath } from '$lib/i18n/routing';
	import { loadAwaitedText } from '$lib/i18n/awaited';
	import { awaitedRoom } from '$lib/controllers/awaitedRoom.svelte';
	import { roomQuery, roomRoute } from '$lib/utils/awaitedRoom';

	/**
	 * «ВАС ЧЕКАЮТЬ У ГРІ» — праворуч знизу, на будь-якій сторінці.
	 *
	 * ## Що це лікує
	 *
	 * Гравець вийшов зі сторінки посеред партії. Решта бачить «немає зв'язку» й
	 * вгадує, чи він вернеться; він сам не знає, що на нього чекають, бо код
	 * кімнати жив лише в адресі. Двох відповідей — «повернутися» й «вийти з
	 * кімнати» — бракувало обом сторонам.
	 *
	 * ## Чому НЕ перекриває сторінку
	 *
	 * Бо людина в цю мить робить щось інше, і це щось так само її. Смуга праворуч
	 * знизу видна, але не забирає ні фокус, ні натиск — на відміну від вікна
	 * очікування в самій кімнаті, де перекриття доречне: там партія стоїть.
	 *
	 * ## Чому не показується в самій кімнаті
	 *
	 * Сторінка онлайну сама і є партія: сповіщення «вас чекають» поверх неї
	 * означало б «ви тут, поверніться сюди».
	 */
	let text = $state<Record<string, string>>({});

	$effect(() => {
		const wanted = settings.locale;
		void loadAwaitedText(wanted).then((dict) => {
			if (settings.locale === wanted) text = dict;
		});
	});

	const label = $derived((key: string) => text[key] ?? key);

	/** Сторінка онлайну — це вже партія, і сповіщення про неї тут ні до чого. */
	const insideRoom = $derived(page.url.pathname.includes('/online'));

	/*
	 * Перечитуванням індексу керує кореневий layout, а не цей компонент: сам
	 * компонент довантажується ЛИШЕ тоді, коли кімната вже знайдена, тобто до
	 * першої перевірки його ще немає. Тут лишається показ і дві дії.
	 */
	const room = $derived(awaitedRoom.room);
</script>

{#if room && !insideRoom}
	<aside class="awaited text-panel" data-testid="awaited-room-panel">
		<p class="awaited__title">{@html formatFont(label('awaited.title'))}</p>

		<div class="awaited__actions">
			<button
				type="button"
				class="awaited__btn awaited__btn--back"
				disabled={awaitedRoom.busy}
				onclick={() => {
					/*
					 * АДРЕСА СКЛАДАЄТЬСЯ ДО `dismiss()`, і це не педантизм: `room` тут —
					 * похідна від стану контролера, а `dismiss()` його гасить. У першій
					 * редакції порядок був зворотний, і клік падав на `null.gameId` —
					 * тобто кнопка «повернутися» не вела нікуди (заміряно в браузері).
					 */
					const target = `${langPath(settings.locale, roomRoute(room))}${roomQuery(room)}`;
					awaitedRoom.dismiss();
					void goto(target);
				}}
				data-testid="awaited-room-return-btn"
			>
				{@html formatFont(label('awaited.return'))}
			</button>

			<button
				type="button"
				class="awaited__btn"
				disabled={awaitedRoom.busy}
				onclick={() => void awaitedRoom.leave()}
				data-testid="awaited-room-leave-btn"
			>
				{@html formatFont(label('awaited.leave'))}
			</button>
		</div>
	</aside>
{/if}

<style>
	/*
	 * ПРАВОРУЧ ЗНИЗУ — місце, обране автором, і воно ж найменш нав'язливе: там
	 * немає ні заголовків, ні кнопок ігор.
	 *
	 * `z-index` нижче за меню шапки (9501) і смугу прокрутки (8000): сповіщення не
	 * має права накривати органи керування сторінкою, бо воно про ІНШУ сторінку.
	 */
	.awaited {
		position: fixed;
		right: var(--space-md);
		bottom: var(--space-md);
		z-index: 7500;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		max-width: min(92vw, 20rem);
		padding: var(--space-sm) var(--space-md);
		box-sizing: border-box;
		text-align: center;
	}

	.awaited__title {
		margin: 0;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-bold);
	}

	.awaited__actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-xs);
	}

	.awaited__btn {
		/* 44px — власний стандарт сенсорної цілі (ACCESSIBILITY-v8 § 8). */
		min-height: 44px;
		padding: 0 var(--space-sm);
		border: 1px solid color-mix(in srgb, var(--color-text-on-panel), transparent 82%);
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text-on-panel);
		font: inherit;
		font-size: var(--font-size-sm);
		cursor: pointer;
	}

	/* «Повернутися» — акцентна: це та дія, якої від людини чекають у грі. */
	.awaited__btn--back {
		border-color: var(--color-accent);
		background: var(--color-accent);
		color: var(--color-text-on-accent);
		font-weight: var(--font-weight-bold);
	}

	.awaited__btn:disabled {
		cursor: default;
	}
</style>
