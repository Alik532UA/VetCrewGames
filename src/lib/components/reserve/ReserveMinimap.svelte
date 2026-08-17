<script lang="ts">
	import { t } from '$lib/i18n';
	import { RESERVE_RADIUS } from '$lib/reserve/constants';
	import { cellsOf, worldOf } from '$lib/reserve/grid';
	import { terrainOf, waterRadius, WORLD_RADIUS } from '$lib/reserve/terrain';
	import type { ReserveBiome } from '$lib/reserve/species';
	import type { Enclosure } from '$lib/reserve/types';
	import { MAX_ZOOM, MIN_ZOOM, PAN_FACTOR } from './isoCamera';
	import type { MapView } from './mapView.svelte';

	/**
	 * Уся ділянка згори — і рамка того клаптика, який видно на екрані.
	 *
	 * Ізометрія показує гарно, але мало: на робочому масштабі у вікно влазить
	 * менша частина заповідника, і знайти вольєр на протилежному краю означало
	 * тягнути пальцем навмання. Мінікарта відповідає на «де я» одним поглядом, а
	 * тап по ній — на «хочу туди».
	 *
	 * Малюється SVG, а не другим полотном: тривимірний рушій уже завантажений, але
	 * друга сцена коштувала б другого рендера щокадру заради ста пікселів. Плоскій
	 * карті згори перспектива не потрібна взагалі.
	 */
	interface Props {
		view: MapView;
		biome: ReserveBiome;
		seed: number;
		enclosures: Enclosure[];
	}

	let { view, biome, seed, enclosures }: Props = $props();

	/** Півсторона квадрата, який показує мінікарта: увесь згенерований світ. */
	const HALF = WORLD_RADIUS;

	/**
	 * Рельєф беремо тим самим викликом, що й сцена.
	 *
	 * Він детермінований від зерна, тож два виклики дають однакове до останнього
	 * куста. Передавати готовий рельєф пропсом означало б тягнути його через
	 * сторінку, яка про рельєф нічого не знає, — і привʼязати мінікарту до того,
	 * щоб сцена вже завантажилася.
	 */
	const terrain = $derived(terrainOf(biome, seed));

	/** Вода — єдине, що на мінікарті обовʼязкове: від неї залежить вибір місця. */
	const lakes = $derived(terrain.items.filter((item) => item.kind === 'water'));

	/**
	 * Зелень — кожна третя фігура.
	 *
	 * Не всі: на ста пікселях триста точок дають рівну сіру заливку, з якої не
	 * видно, де густо, а де чисто. Кожна третя лишає саме цю різницю.
	 */
	const green = $derived(
		terrain.items.filter((item, index) => item.kind !== 'water' && index % 3 === 0)
	);

	/** Вольєри — квадрати за своїм слідом, а не точки: розмір тут і є рішення. */
	const boxes = $derived(
		enclosures.map((enclosure) => {
			const cells = cellsOf(enclosure.cell, enclosure.size);
			const spots = cells.map(worldOf);
			const xs = spots.map((s) => s.x);
			const zs = spots.map((s) => s.z);
			const pad = 1.1;
			return {
				id: enclosure.id,
				x: Math.min(...xs) - pad,
				z: Math.min(...zs) - pad,
				w: Math.max(...xs) - Math.min(...xs) + pad * 2,
				h: Math.max(...zs) - Math.min(...zs) + pad * 2
			};
		})
	);

	/**
	 * Рамка видимої області — чотирикутник, а не квадрат.
	 *
	 * Екран у світі стоїть по діагоналі: горизонталь вікна — це напрямок (1, −1), а
	 * не (1, 0). Кути вікна перетворюються тим САМИМ відображенням, яким
	 * панорамування перетворює рух пальця. Воно наближене — точна піраміда огляду
	 * дала б рамку відсотків на десять меншу, — але наближене однаково з
	 * перетягуванням, і саме це важливо: рамка не має казати одне, коли палець
	 * робить інше. Центр при цьому точний: він приходить прямо з цілі камери.
	 */
	const frame = $derived.by(() => {
		const hx = view.spanX / 2;
		const hy = view.spanY / 2;
		return [
			[-hx, -hy],
			[hx, -hy],
			[hx, hy],
			[-hx, hy]
		]
			.map(([sx, sy]) => {
				const x = view.x - (sx + sy) * PAN_FACTOR;
				const z = view.z - (sy - sx) * PAN_FACTOR;
				return `${x.toFixed(1)},${z.toFixed(1)}`;
			})
			.join(' ');
	});

	/** Тап по мінікарті: переводимо піксель картинки у світову точку. */
	function jump(event: MouseEvent) {
		const box = (event.currentTarget as SVGElement).getBoundingClientRect();
		const x = ((event.clientX - box.left) / box.width) * HALF * 2 - HALF;
		const z = ((event.clientY - box.top) / box.height) * HALF * 2 - HALF;
		view.look(x, z);
	}
</script>

<div class="mini" data-testid="reserve-minimap-panel">
	<!--
		Клікабельний SVG, а не `<button>` з картинкою: кнопка має ОДНУ дію, а тут
		значення має саме місце дотику. Роль і клавіатура тримаються на тому, що
		поруч є повзунок і сама сцена, якою так само можна керувати.
	-->
	<svg
		viewBox="{-HALF} {-HALF} {HALF * 2} {HALF * 2}"
		role="presentation"
		onclick={jump}
		data-testid="reserve-minimap-img"
	>
		<rect x={-HALF} y={-HALF} width={HALF * 2} height={HALF * 2} class="mini__ground" />

		{#each terrain.rivers as path, index (index)}
			<polyline
				points={path.points.map((p) => `${p.x.toFixed(1)},${p.z.toFixed(1)}`).join(' ')}
				class="mini__river"
				stroke-width={path.width * 2}
			/>
		{/each}

		{#each lakes as item, index (index)}
			<circle cx={item.x} cy={item.z} r={waterRadius(item.scale)} class="mini__water" />
		{/each}

		{#each green as item, index (index)}
			<circle cx={item.x} cy={item.z} r={0.5 * item.scale} class="mini__green" />
		{/each}

		<!-- Межа забудови — пунктиром, як і на сцені: те саме коло, той самий сенс. -->
		<circle cx="0" cy="0" r={RESERVE_RADIUS} class="mini__bound" />

		{#each boxes as box (box.id)}
			<rect x={box.x} y={box.z} width={box.w} height={box.h} class="mini__box" />
		{/each}

		<polygon points={frame} class="mini__frame" />
	</svg>

	<input
		type="range"
		min={MIN_ZOOM}
		max={MAX_ZOOM}
		step="1"
		value={view.zoom}
		aria-label={t('reserve.zoom')}
		oninput={(event) => view.look(view.x, view.z, Number(event.currentTarget.value))}
		data-testid="reserve-minimap-zoom-slider"
	/>
</div>

<style>
	.mini {
		/*
		 * Кут карти, над смугою кнопок. Не в потоці: мінікарта — це накладка на
		 * сцену, і рядок у стовпці забрав би в самої сцени висоту, якої на телефоні
		 * і без того обмаль.
		 */
		position: absolute;
		right: var(--space-sm);
		bottom: 4.5rem;
		z-index: 2;
		display: flex;
		flex-direction: column;
		gap: 4px;
		width: clamp(88px, 22vw, 128px);
	}

	svg {
		width: 100%;
		height: auto;
		aspect-ratio: 1;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		/* Тап по мінікарті — це наказ камері, а не прокрутка сторінки. */
		touch-action: none;
		cursor: crosshair;
	}

	.mini__ground {
		fill: color-mix(in srgb, var(--color-bg-panel), transparent 12%);
	}

	.mini__river {
		fill: none;
		stroke: #3f7fa8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.mini__water {
		fill: #3f7fa8;
	}

	.mini__green {
		fill: color-mix(in srgb, #2f6b34, transparent 25%);
	}

	.mini__bound {
		fill: none;
		stroke: #f0e6c8;
		stroke-width: 0.35;
		stroke-dasharray: 1.6 1.6;
	}

	.mini__box {
		fill: var(--color-accent);
		stroke: var(--color-text-on-accent);
		stroke-width: 0.2;
	}

	/* Рамка поверх усього: вона відповідає на «де я», і її не має ніщо ховати. */
	.mini__frame {
		fill: rgb(255 255 255 / 12%);
		stroke: #ffffff;
		stroke-width: 0.4;
	}

	input {
		width: 100%;
		/* Повзунок — палець, а не пінцет: доріжка вища за типову. */
		height: 24px;
		accent-color: var(--color-accent);
		cursor: pointer;
	}
</style>
