import type { OrthographicCamera, Vector3 } from 'three';

/**
 * Панорамування й масштаб ізометричної камери — пальцем і мишею.
 *
 * Своє, а не `OrbitControls`: обертати камеру тут НЕ можна. Ізометрія — це
 * фіксований кут, і щойно його дозволити крутити, зникає сама ізометрія разом
 * із тим, що всі вольєри виглядають однаково незалежно від місця. `OrbitControls`
 * довелося б наполовину вимикати, а половина вимкненої бібліотеки — це більше
 * коду, ніж уся ця функція, і ще ~10 КБ у чанку.
 *
 * Камера дивиться на `target` із незмінного напрямку. Панорамування рухає
 * ОБИДВА — камеру й ціль, — тож кут не змінюється ніколи.
 */

/** Межі масштабу. Без них колесо миші виводить сцену або в піксель, або в стіну. */
export const MIN_ZOOM = 18;
export const MAX_ZOOM = 140;

/**
 * Масштаб, з якого починається партія.
 *
 * Було 54 — і при ньому у вікно 1264×630 потрапляло лише 37×18 світових
 * одиниць, тобто клаптик трави без жодного дерева: рельєф стоїть на ±16, і
 * майже весь лишався за кадром. Число не косметичне, тому й живе поруч із
 * межами, а не в розмітці сцени.
 */
export const DEFAULT_ZOOM = 34;

/** На скільки світових одиниць від центру можна відʼїхати. */
const MAX_PAN = 24;

export interface IsoControls {
	destroy(): void;
}

/**
 * Скільки пікселів дозволено проїхати пальцю, щоб дотик усе ще рахувався тапом.
 *
 * Без цього порога кожне панорамування закінчувалося б вибором тварини, над
 * якою випадково відпустили палець. Нуль тут не годиться: палець зсувається на
 * кілька пікселів навіть при найакуратнішому дотику.
 */
const TAP_SLOP_PX = 8;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function isoControls(
	element: HTMLElement,
	camera: OrthographicCamera,
	target: Vector3,
	onChange: () => void,
	/** Дотик БЕЗ перетягування — координати в пікселях вікна. */
	onTap?: (clientX: number, clientY: number) => void
): IsoControls {
	/** Напрямок «камера → ціль» лишається сталим: це і є ізометрія. */
	const offset = camera.position.clone().sub(target);

	const apply = () => {
		target.x = clamp(target.x, -MAX_PAN, MAX_PAN);
		target.z = clamp(target.z, -MAX_PAN, MAX_PAN);
		camera.position.copy(target).add(offset);
		camera.lookAt(target);
		camera.updateProjectionMatrix();
		/*
		 * `updateMatrixWorld` тут не зайвий, хоч його й робить рендерер.
		 *
		 * Рендерер оновлює матриці на кадрі — а промінь вибору летить із події
		 * вказівника, тобто МІЖ кадрами. Одразу після панорамування він
		 * рахувався б за старою матрицею й бив би повз рівно на щойно проїхану
		 * відстань. Виміряно прямо: без цього рядка `matrixWorld` камери
		 * лишалася одиничною, і жоден тап не влучав у вольєр.
		 */
		camera.updateMatrixWorld();
		onChange();
	};

	/** Активні дотики. Саме Map, бо пальців буває два, і другий приходить пізніше. */
	const pointers = new Map<number, { x: number; y: number }>();
	/** Відстань між пальцями на початку щипка. */
	let pinchStart = 0;
	let zoomStart = camera.zoom;
	/** Звідки почався поточний дотик і чи він уже перетворився на перетягування. */
	let downAt: { x: number; y: number } | null = null;
	let dragged = false;

	const spread = () => {
		const [a, b] = [...pointers.values()];
		return Math.hypot(a.x - b.x, a.y - b.y);
	};

	function onPointerDown(event: PointerEvent) {
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		element.setPointerCapture(event.pointerId);
		if (pointers.size === 1) {
			downAt = { x: event.clientX, y: event.clientY };
			dragged = false;
		} else {
			// Другий палець: це вже щипок, і тапом він скінчитися не може.
			dragged = true;
			pinchStart = spread();
			zoomStart = camera.zoom;
		}
	}

	function onPointerMove(event: PointerEvent) {
		const previous = pointers.get(event.pointerId);
		if (!previous) return;
		const next = { x: event.clientX, y: event.clientY };
		pointers.set(event.pointerId, next);

		if (downAt && Math.hypot(next.x - downAt.x, next.y - downAt.y) > TAP_SLOP_PX) dragged = true;

		if (pointers.size >= 2) {
			// Щипок: масштаб від ВІДНОШЕННЯ відстаней, а не від приросту — інакше
			// той самий рух пальців означав би різне на різних масштабах.
			if (pinchStart > 0) {
				camera.zoom = clamp(zoomStart * (spread() / pinchStart), MIN_ZOOM, MAX_ZOOM);
				apply();
			}
			return;
		}

		/*
		 * Пікселі екрана перетворюються на світові одиниці через `camera.zoom`:
		 * інакше на дальньому масштабі палець тягнув би сцену ледь-ледь, а на
		 * ближньому вона вилітала б за екран від найменшого руху.
		 */
		const dx = (next.x - previous.x) / camera.zoom;
		const dy = (next.y - previous.y) / camera.zoom;

		// В ізометрії горизонталь екрана — це діагональ світу; звідси поворот осей.
		target.x -= (dx + dy) * 0.85;
		target.z -= (dy - dx) * 0.85;
		apply();
	}

	function onPointerUp(event: PointerEvent) {
		pointers.delete(event.pointerId);
		if (pointers.size < 2) pinchStart = 0;

		// Тап рахується лише коли пішов ОСТАННІЙ палець: інакше кінець щипка
		// віддавав би вибір тварини, над якою випадково відпустили другий.
		if (pointers.size === 0) {
			if (!dragged && downAt) onTap?.(event.clientX, event.clientY);
			downAt = null;
			dragged = false;
		}
	}

	function onWheel(event: WheelEvent) {
		// Сторінка під сценою не має їхати: жест адресований саме сцені.
		event.preventDefault();
		camera.zoom = clamp(camera.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12), MIN_ZOOM, MAX_ZOOM);
		apply();
	}

	element.addEventListener('pointerdown', onPointerDown);
	element.addEventListener('pointermove', onPointerMove);
	element.addEventListener('pointerup', onPointerUp);
	element.addEventListener('pointercancel', onPointerUp);
	element.addEventListener('wheel', onWheel, { passive: false });

	apply();

	return {
		destroy() {
			element.removeEventListener('pointerdown', onPointerDown);
			element.removeEventListener('pointermove', onPointerMove);
			element.removeEventListener('pointerup', onPointerUp);
			element.removeEventListener('pointercancel', onPointerUp);
			element.removeEventListener('wheel', onWheel);
		}
	};
}
