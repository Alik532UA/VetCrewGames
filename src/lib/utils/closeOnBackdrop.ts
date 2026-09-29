import type { Attachment } from 'svelte/attachments';

/**
 * КЛІК ПО ТЛУ ЗАКРИВАЄ `<dialog>` — його браузер сам не закриває.
 *
 * Ціль такого кліку — сам `<dialog>`: вміст займає його цілком (у всіх вікнах проєкту
 * `<dialog>` — лише рамка верхнього шару, без полів), тож клік усередині вікна потрапляє в
 * дитину й вікна не закриває.
 *
 * Спільне для вибору аватарки, вибору прапора й вікна «На весь екран» (2026-09-29): доти
 * в кожного була власна копія тих самих восьми рядків.
 */
export const closeOnBackdrop: Attachment<HTMLDialogElement> = (node) => {
	const click = (event: MouseEvent) => {
		if (event.target === node) node.close();
	};
	node.addEventListener('click', click);
	return () => node.removeEventListener('click', click);
};
