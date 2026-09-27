<script lang="ts">
	/**
	 * Значок `user-round-group` із lucide — ЛОКАЛЬНОЮ КОПІЄЮ, бо в пакеті його ще немає.
	 *
	 * Прохання автора 2026-09-27: у плитці «Грати онлайн» — `user-round-group` замість `users`.
	 * Проєкт стоїть на `lucide-svelte` 1.0.1, і це остання версія того пакета: lucide далі
	 * виходить як `@lucide/svelte` (1.48.0 на цю дату), і `user-round-group` зʼявився вже там.
	 * Переїзд на новий пакет зачіпає кожен імпорт значків у проєкті, тож це окрема задача; до
	 * неї — рівно цей один значок тут. Дизайн і шляхи — lucide (ліцензія ISC), атрибути ті
	 * самі, що малює їхній `Icon`: `aria-hidden`, товщина й кінці ліній. Власних класів
	 * lucide (`lucide`, `lucide-icon`) тут немає: жодне правило проєкту їх не бере, і гейт
	 * `structure.test.ts` правильно вважає клас без правил помилкою. Коли проєкт переїде на
	 * `@lucide/svelte`, цей файл прибирається на користь імпорту.
	 */
	interface Props {
		class?: string;
		size?: number;
	}

	let { class: className = '', size = 24 }: Props = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	class={className}
	aria-hidden="true"
>
	<path d="M17 21a5 5 0 00-10 0" />
	<path d="M22 10.5a3.5 3.5 0 00-5.507-2.868" />
	<path d="M7.507 7.632A3.5 3.5 0 002 10.5" />
	<circle cx="12" cy="13" r="3" />
	<circle cx="18.5" cy="4.5" r="2.5" />
	<circle cx="5.5" cy="4.5" r="2.5" />
</svg>
