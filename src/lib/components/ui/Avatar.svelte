<script lang="ts">
	import {
		Bird,
		Bug,
		Cat,
		Dog,
		Fish,
		Heart,
		Rabbit,
		Smile,
		Snail,
		Star,
		Target,
		Turtle,
		User,
		Zap
	} from 'lucide-svelte';
	import { isCustomAvatar, parseAvatar, type AvatarIcon } from '$lib/config/avatars';

	/**
	 * АВАТАР ГРАВЦЯ — плитка зі значком на кольоровому тлі.
	 *
	 * ## Що це і чого це НЕ заміняє
	 *
	 * Підпис поруч з імʼям, як і прапор, — і саме тому прапор лишається на місці:
	 * він каже КРАЇНУ (факт, якого в тексті немає), а аватар не каже нічого, крім
	 * «це той самий, кого я бачив у лобі». Дві різні речі в одному рядку.
	 *
	 * ## Чому `aria-hidden`, а не назва значка для читалки
	 *
	 * Це рішення, і воно протилежне тому, що зроблено у `Flag`. Прапор несе
	 * інформацію, якої немає в тексті, тож його `alt` — назва країни. Аватар же
	 * стоїть РЯДОМ З ІМЕНЕМ і не додає до нього нічого: «синій кіт, Дивний
	 * Птахоніс» лише подвоїло б рядок у читалці. Отже це оздоба в точному сенсі
	 * WCAG, і правильна відповідь — не озвучувати.
	 *
	 * У ВИБОРІ аватара — навпаки: там значок і є вся інформація, і кожна кнопка
	 * там має підпис (`AvatarPicker.svelte`).
	 *
	 * ## Мапа значків живе ТУТ, а не в конфізі
	 *
	 * `config/avatars.ts` лишається чистим від імпортів `lucide-svelte`: інакше
	 * кожен, хто читає звідти саму лише межу довжини (а це й `net`, і правила
	 * гейта), тягнув би в бандл чотирнадцять модулів зі значками.
	 */
	interface Props {
		/** Рядок `значок:колір`. Невідоме чи порожнє — типовий аватар. */
		avatar: string | null | undefined;
		/** Сторона плитки в пікселях. Значок займає дві третини. */
		size?: number;
		/**
		 * Малювати ТИПОВИЙ аватар теж. Типово — ні, і це головне правило цього
		 * компонента.
		 *
		 * Причина в тому, що плитка робить у рядку імені: вона каже «це той самий,
		 * кого я бачив у лобі». Типова плитка цього не каже — вона стоїть однакова в
		 * кожного, хто аватарки не вибирав, і лише розсуває прапор та імʼя. Автор
		 * попросив прямо: показувати лише те, що відрізняється від типового.
		 *
		 * Вмикає це рівно один вжиток — ВИБІР аватара (`AvatarPicker`). Там типовий і
		 * є один із варіантів, і сховати його означало б порожню клітинку в переліку.
		 *
		 * Типове значення саме `false`, а не `true`: місць-списків девʼять, а вибір
		 * один, і забути прапорець у десятому списку — це та сама помилка, яку автор
		 * уже ловив у прозорості зниклого гравця («фарбувала лише перший і третій»).
		 */
		showDefault?: boolean;
	}

	let { avatar, size = 22, showDefault = false }: Props = $props();

	const ICONS: Record<AvatarIcon, typeof User> = {
		user: User,
		cat: Cat,
		dog: Dog,
		rabbit: Rabbit,
		bird: Bird,
		fish: Fish,
		snail: Snail,
		turtle: Turtle,
		bug: Bug,
		smile: Smile,
		star: Star,
		heart: Heart,
		zap: Zap,
		target: Target
	};

	const look = $derived(parseAvatar(avatar));
	const Icon = $derived(ICONS[look.icon]);
	/*
	 * Значок міряється в тих самих пікселях, що плитка, а не у відсотках:
	 * `lucide-svelte` малює `width`/`height` числом в атрибутах, тобто
	 * відносної одиниці там не буває. Дві третини — щоб навколо лишалося поле:
	 * значок урівень із краєм читається як обрізаний.
	 */
	const glyph = $derived(Math.round(size * 0.66));

	/** Чи є що показувати: власний аватар — або вибір, де типовий теж вибір. */
	const visible = $derived(showDefault || isCustomAvatar(avatar));
</script>

{#if visible}
	<span
		class="avatar avatar--{look.color}"
		style:width="{size}px"
		style:height="{size}px"
		aria-hidden="true"
	>
		<Icon size={glyph} strokeWidth={2.25} />
	</span>
{/if}

<style>
	/*
	 * Тонка рамка ОБОВʼЯЗКОВА, і не для краси — те саме міркування, що у `Flag`.
	 *
	 * Плитка лежить на панелі, чий колір міняється разом із темою, і темний
	 * `slate` на темній панелі зливався б із нею. Рамка з кольору тексту в 78%
	 * прозорості дає межу в усіх чотирьох темах, не сперечаючись із жодним
	 * кольором самої плитки.
	 */
	.avatar {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		border-radius: var(--radius-sm);
		border: 1px solid color-mix(in srgb, var(--color-text), transparent 78%);
		color: var(--color-avatar-ink);
		vertical-align: text-bottom;
	}

	.avatar--red {
		background: var(--color-avatar-red);
		color: var(--color-avatar-ink);
	}

	.avatar--orange {
		background: var(--color-avatar-orange);
		color: var(--color-avatar-ink);
	}

	.avatar--green {
		background: var(--color-avatar-green);
		color: var(--color-avatar-ink);
	}

	.avatar--teal {
		background: var(--color-avatar-teal);
		color: var(--color-avatar-ink);
	}

	.avatar--blue {
		background: var(--color-avatar-blue);
		color: var(--color-avatar-ink);
	}

	.avatar--violet {
		background: var(--color-avatar-violet);
		color: var(--color-avatar-ink);
	}

	.avatar--pink {
		background: var(--color-avatar-pink);
		color: var(--color-avatar-ink);
	}

	.avatar--slate {
		background: var(--color-avatar-slate);
		color: var(--color-avatar-ink);
	}
</style>
