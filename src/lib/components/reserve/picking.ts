import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import type { Object3D, OrthographicCamera } from 'three';
import { cellOf, type Cell } from '$lib/reserve/grid';

/**
 * Що під пальцем: тварина чи клітинка землі.
 *
 * Власний промінь, а не плагін `interactivity` з `@threlte/extras`. Причин дві, і
 * перша важливіша: плагін не відрізняє тап від перетягування, тож кожне
 * панорамування закінчувалося б вибором тварини, над якою випадково відпустили
 * палець. Друга — ще один пакет заради двадцяти рядків.
 *
 * Камера приходить ФУНКЦІЄЮ, а не значенням: `<Canvas>` створює її не одночасно з
 * розміткою, і посилання, взяте один раз, лишилося б `undefined` назавжди.
 */
export interface Picker {
	/** `id` тварини під точкою вікна; `null` — там її немає. */
	animalAt(clientX: number, clientY: number): number | null;
	/** Клітинка землі під точкою вікна; `null` — камери ще немає. */
	cellAt(clientX: number, clientY: number): Cell | null;
}

export function createPicker(
	canvas: HTMLCanvasElement,
	scene: Object3D,
	camera: () => OrthographicCamera | undefined
): Picker {
	const raycaster = new Raycaster();
	const pointer = new Vector2();
	/** Площина землі: промінь шукає перетин саме з нею, а не з мешем. */
	const ground = new Plane(new Vector3(0, 1, 0), 0);

	/** Навести промінь на точку вікна. Повертає камеру — або нічого. */
	const aim = (clientX: number, clientY: number) => {
		const lens = camera();
		if (!lens) return null;
		const box = canvas.getBoundingClientRect();
		pointer.x = ((clientX - box.left) / box.width) * 2 - 1;
		pointer.y = -((clientY - box.top) / box.height) * 2 + 1;
		raycaster.setFromCamera(pointer, lens);
		return lens;
	};

	/** Мешканця несе ГРУПА, а промінь влучає в меш — шукаємо вгору по батьках. */
	const animalIdAt = (object: Object3D): number | null => {
		for (let node: Object3D | null = object; node; node = node.parent) {
			const id = node.userData?.animalId;
			if (typeof id === 'number') return id;
		}
		return null;
	};

	return {
		animalAt(clientX, clientY) {
			if (!aim(clientX, clientY)) return null;
			for (const hit of raycaster.intersectObjects(scene.children, true)) {
				const id = animalIdAt(hit.object);
				if (id !== null) return id;
			}
			return null;
		},

		cellAt(clientX, clientY) {
			if (!aim(clientX, clientY)) return null;
			/*
			 * Перетин із площиною y = 0, а не з мешем землі: земля — тонка коробка, і
			 * промінь, що прийшов збоку, влучив би в її бік, а не у верх.
			 */
			const hit = raycaster.ray.intersectPlane(ground, new Vector3());
			return hit ? cellOf(hit.x, hit.z) : null;
		}
	};
}
