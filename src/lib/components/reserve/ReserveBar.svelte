<script lang="ts">
	import { t, formatFont } from '$lib/i18n';

	/**
	 * Смуга кнопок унизу карти й підказка режиму розміщення.
	 *
	 * Кампанія стоїть тут окремою кнопкою, а не в панелі, бо це ХІД, а не список:
	 * ховати щоденну дію за два кліки означало б робити її незручною рівно
	 * настількою, щоб про неї забували.
	 *
	 * Підказка «натисніть на карту» лежить над смугою й тримає скасування поруч
	 * із собою. Режим, з якого не видно виходу, читається як зависання.
	 */
	export type Panel = 'animals' | 'enclosures' | 'staff' | 'tasks';

	interface Props {
		panel: Panel | null;
		placing: boolean;
		/**
		 * Панель відкрита — і разом з нею передається `x` центру кнопки.
		 *
		 * Вікно спливає НАД тією кнопкою, з якої його викликали: інакше воно завжди
		 * виїжджало з середини екрана, і звʼязок «натиснув тут — відкрилося там»
		 * доводилося вгадувати. Координата міряється з живої кнопки, бо смуга
		 * прокручується вбік і її кнопки не стоять на місці.
		 */
		onPanel: (id: Panel, anchorX: number) => void;
		onCampaign: () => void;
		onCancel: () => void;
	}

	let { panel, placing, onPanel, onCampaign, onCancel }: Props = $props();

	/** Центр кнопки в координатах вікна: саме над ним і спливе панель. */
	const centerOf = (button: HTMLElement) => {
		const box = button.getBoundingClientRect();
		return box.left + box.width / 2;
	};

	const BUTTONS: Array<{
		id: Panel;
		key: 'reserve.animals' | 'reserve.enclosures' | 'reserve.staff' | 'reserve.tasks';
	}> = [
		{ id: 'animals', key: 'reserve.animals' },
		{ id: 'enclosures', key: 'reserve.enclosures' },
		{ id: 'staff', key: 'reserve.staff' },
		{ id: 'tasks', key: 'reserve.tasks' }
	];
</script>

<!--
	ОДИН КОРІНЬ, а не два. Компонент став лівою половиною нижнього рядка
	(`ReserveGame` ставить праворуч від нього керування часом), і два кореневі
	вузли потрапили б у той рядок окремо — підказка про розміщення стала б сусідом
	кнопок замість того, щоб стояти над ними.
-->
<div class="bar-wrap">
	{#if placing}
		<p class="hint" role="status" data-testid="reserve-placing-status">
			{@html formatFont(t('reserve.placing'))}
			<button type="button" class="hint__cancel" onclick={onCancel}>
				{@html formatFont(t('reserve.cancel'))}
			</button>
		</p>
	{/if}

	<nav class="bar" aria-label={t('reserve.title')}>
		{#each BUTTONS as item (item.id)}
			<button
				type="button"
				class="bar__btn"
				class:bar__btn--on={panel === item.id}
				aria-pressed={panel === item.id}
				onclick={(event) => onPanel(item.id, centerOf(event.currentTarget))}
				data-testid="reserve-panel-{item.id}-btn"
			>
				{@html formatFont(t(item.key))}
			</button>
		{/each}

		<button
			type="button"
			class="bar__btn"
			title={t('reserve.campaignHint')}
			onclick={onCampaign}
			data-testid="reserve-campaign-btn"
		>
			{@html formatFont(t('reserve.campaign'))}
		</button>
	</nav>
</div>

<style>
	/*
	 * Обгортка: підказка над кнопками. Сама вона в нижньому рядку МОЖЕ звужуватися
	 * (`min-width: 0`) — без цього `overflow-x` у `.bar` не працює, бо вміст
	 * розпирав би саму обгортку, а не прокручувався в ній.
	 */
	.bar-wrap {
		display: flex;
		flex: 1 1 auto;
		min-width: 0;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.bar {
		display: flex;
		gap: var(--space-sm);
		/*
		 * ОДИН рядок із прокруткою вбік, а не перенос.
		 *
		 * Кнопки завширшки з текст на 320px переносилися в чотири рядки — виміряно:
		 * смуга виростала до 200px, тобто третини екрана, і накривала мінікарту. А
		 * головне, висота смуги мінялася від довжини підписів, тобто від мови: те саме
		 * керування стрибало б угору-вниз при перекладі. Прокрутка тримає висоту
		 * незмінною — рівно одна кнопка.
		 */
		flex-wrap: nowrap;
		overflow-x: auto;
		/* Смуга прокрутки під кнопками тільки б їх обрізала. */
		scrollbar-width: none;
		/* Жест уздовж смуги належить їй, а не карті під нею. */
		touch-action: pan-x;
	}

	.bar__btn {
		/*
		 * Ширина по тексту, а не рівними частками. Розтягнуті на весь екран кнопки
		 * читаються як панель керування верстатом: «Мешканці» й «Кампанія в
		 * соцмережах» отримували однакове поле, і коротка кнопка виглядала
		 * порожньою.
		 */
		flex: 0 0 auto;
		min-height: 44px;
		/* Ширина по тексту — але не впритул до літер: палець б'є по полю, не по слову. */
		padding: 0 var(--space-md);
		border-radius: var(--radius-sm);
		background: var(--color-bg-panel);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.bar__btn--on {
		background: var(--color-accent);
		color: var(--color-text-on-accent);
	}

	.hint {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
		align-items: center;
		margin: 0;
		padding: var(--space-sm);
		border-radius: var(--radius-sm);
		background: var(--color-accent);
		color: var(--color-text-on-accent);
	}

	.hint__cancel {
		min-height: 44px;
		padding: 0 var(--space-md);
		border-radius: var(--radius-sm);
		background: var(--color-bg-panel);
		color: var(--color-text);
		font: inherit;
		cursor: pointer;
	}
</style>
