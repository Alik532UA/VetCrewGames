<script lang="ts">
	import { onMount } from 'svelte';
	import { Gamepad2 } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { t, formatFont } from '$lib/i18n';
	import { langPath, languageFromParam } from '$lib/i18n/routing';

	/**
	 * СТАРА АДРЕСА РОЗДІЛУ ГРИ — переадресація в «Грати» (рішення автора 2026-09-26, 1-A).
	 *
	 * `/quiz/` і `/pairs/` були розділами головного меню, а тепер головне меню веде в
	 * «Грати» й «Грати онлайн». Прибрати адреси означало б зламати посилання, які вже могли
	 * комусь піти, тож сторінки лишаються — і одразу ведуть далі, ЗАМІНОЮ запису в історії:
	 * «назад» не вертає на адресу, з якої сторінка сама пішла.
	 *
	 * Переадресація в браузері, а не в `load`: пререндер записав би редирект файлом із
	 * вбудованим скриптом без політики CSP. Поки скрипт не виконався (або вимкнений), видно
	 * посилання туди ж. Обидві адреси поза індексом (`HIDDEN_ROUTES`).
	 */
	const lang = $derived(languageFromParam(page.params.lang));

	onMount(() => void goto(langPath(lang, 'play'), { replaceState: true }));
</script>

<div class="menu-page fill">
	<nav class="menu-tiles">
		<a
			href={langPath(lang, 'play')}
			class="menu-btn menu-btn--game menu-tile"
			data-testid="moved-play-link"
		>
			<!-- Та сама плитка, що «Грати» в головному меню: сюди приходять саме по неї. -->
			<Gamepad2 class="menu-tile__icon" />
			<span>{@html formatFont(t('menu.play'))}</span>
		</a>
	</nav>
</div>
