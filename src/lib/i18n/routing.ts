import { resolve } from '$app/paths';

/**
 * Єдине джерело правди про мовні адреси (I18N-v8 § 3.1).
 *
 * Політику не можна розмазувати по компонентах: її читають щонайменше чотири
 * місця — матчер сегмента, кореневий layout, перемикач мови й генератор
 * `sitemap.xml`, який виконується в Node без застосунку. Розійшовшись, вони
 * дають сайт, де адреса каже одне, а сторінка показує інше.
 */

export type Language = 'uk' | 'en' | 'de' | 'nl';

/**
 * Мови, які сайт СПРАВДІ віддає. Порядок тут — порядок у перемикачі.
 *
 * Це не те саме, що `Language`. Тип перелічує коди, про які проєкт знає — для
 * них уже є підпис і прапор; цей масив перелічує ті, у яких є ПОВНИЙ словник.
 * Різниця не формальна: неповна мова показала б ключі замість тексту, а
 * перевірка типів цього не ловить — `td()` бере рядок і повертає рядок.
 *
 * Увімкнути мову — це дописати її сюди й покласти словник. Обидва кроки
 * стереже `src/i18n-completeness.test.ts`: він падає, якщо зроблено лише один.
 */
export const LANGUAGES: readonly Language[] = ['uk', 'en', 'de', 'nl'];

/** Мова, що живе на ГОЛОМУ шляху: `/`, а не `/uk/`. */
export const DEFAULT_LANGUAGE: Language = 'uk';

/**
 * Мови в сегменті адреси. `uk` сюди не входить свідомо: інакше той самий
 * вміст існував би за двома адресами (`/` і `/uk/`) і конкурував сам із собою
 * в індексі. Ціна рішення — `/uk/` віддає 404-фолбек; записано в
 * PROJECT-CONTEXT.md.
 */
export const PREFIXED_LANGUAGES: readonly Language[] = LANGUAGES.filter(
	(lang) => lang !== DEFAULT_LANGUAGE
);

/** Мови, які потрапляють у hreflang і sitemap (I18N-v8 § 3.4). */
export const INDEXED_LANGUAGES: readonly Language[] = LANGUAGES;

/**
 * Абсолютні адреси будуються з ЯВНИХ констант, а не з `page.url`: під час
 * prerender `page.url.origin` дорівнює `sveltekit-prerender` (SEO-v8 § 1.2).
 */
export const SITE_ORIGIN = 'https://alik532ua.github.io';
export const SITE_BASE = '/VetCrewGames';

/**
 * Маршрути, що існують у кожній мові. Ключ — «хвіст» адреси без мови, він же
 * те, що йде в canonical, hreflang і sitemap; значення — типізований route id.
 *
 * Перелік один на весь проєкт: доти шляхи склеювалися з `base` у чотирьох
 * місцях, і кожне мало власну помилку.
 */
export const LANGUAGE_ROUTES = {
	'': '/[[lang=lang]]',
	'game-mythbusters': '/[[lang=lang]]/game-mythbusters',
	'game-population': '/[[lang=lang]]/game-population',
	'game-family': '/[[lang=lang]]/game-family',
	'game-habitat': '/[[lang=lang]]/game-habitat',
	// Підрежими «Де живем?» — окремі сторінки, а не стан: посиланням на них
	// можна поділитися, і кожна потрапляє в sitemap та hreflang окремо.
	'game-habitat/continents': '/[[lang=lang]]/game-habitat/continents',
	'game-habitat/biomes': '/[[lang=lang]]/game-habitat/biomes',
	'game-feeding': '/[[lang=lang]]/game-feeding',
	'game-memory': '/[[lang=lang]]/game-memory',
	/*
	 * Розділи меню. Адреси самих ігор НЕ змінилися — змінився лише шлях
	 * кліками: доти шість кнопок лежали в головному меню, тепер вони за
	 * «Вікториною». Кожен розділ має власну адресу, бо це окремий екран, яким
	 * можна поділитися, і його бачить пошуковик.
	 */
	quiz: '/[[lang=lang]]/quiz',
	'quiz/play': '/[[lang=lang]]/quiz/play',
	pairs: '/[[lang=lang]]/pairs',
	/** Заповідник — не раунд, а партія, що триває; звідси й окремий розділ. */
	reserve: '/[[lang=lang]]/reserve',
	/*
	 * Кожен біом — окрема адреса, бо це окрема ПАРТІЯ. Партія в савані й партія в
	 * лісі тривають паралельно й нічого одна одній не роблять; тримати їх в
	 * одному стані означало б, що вибір біома стирає попередній заповідник.
	 *
	 * Чотири СТАТИЧНІ маршрути, а не один із параметром `[biome]`. Параметр дав
	 * би один route id на чотири адреси — і `routeRestFromId` перестав би
	 * відрізняти їх, а разом із ним canonical, hreflang і sitemap. Той самий
	 * висновок уже застосований до підрежимів «Де живем?».
	 */
	'reserve/forest': '/[[lang=lang]]/reserve/forest',
	'reserve/tundra': '/[[lang=lang]]/reserve/tundra',
	'reserve/savanna': '/[[lang=lang]]/reserve/savanna',
	'reserve/rainforest': '/[[lang=lang]]/reserve/rainforest'
} as const;

export type RouteRest = keyof typeof LANGUAGE_ROUTES;

export function isLanguage(value: unknown): value is Language {
	return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/** Мова сторінки за сегментом адреси: його відсутність означає типову. */
export function languageFromParam(param: string | undefined): Language {
	return isLanguage(param) ? param : DEFAULT_LANGUAGE;
}

/** Сегмент для мови: `undefined` для типової — саме його чекає `resolve()`. */
export function languageSegment(lang: Language): string | undefined {
	return lang === DEFAULT_LANGUAGE ? undefined : lang;
}

/**
 * Внутрішнє посилання — через типізований `resolve()`, а не склеюванням із
 * `base` (SEO-v8 § 1.5).
 *
 * Це не стилістика. Під час prerender `base` **відносний**, тож
 * `${base}/en/` на сторінці `/game-population/` дає
 * `/VetCrewGames/game-population/en/` — і саме на цьому збірка тут упала
 * першого разу. `resolve()` знає і про `base`, і про поточну адресу, а
 * заразом типізований проти реального переліку маршрутів: помилка в назві
 * або в регістрі стає помилкою `svelte-check`, а не 404 у продакшні.
 */
export function langPath(lang: Language, rest: RouteRest = ''): string {
	const path = resolve(LANGUAGE_ROUTES[rest], { lang: languageSegment(lang) });

	/*
	 * Кінцевий слеш доводиться додавати самому: `resolve()` його НЕ додає, а в
	 * проєкті `trailingSlash: 'always'`. Без цього кожне внутрішнє посилання —
	 * зайвий редирект на хостингу, і форма адреси розходиться з canonical та
	 * sitemap, які слеш мають (SVELTEKIT-DATA-v8 § 2.4).
	 *
	 * Знайдено в браузері на зібраному сайті: юніт-тест був зелений, бо слеш
	 * додавав МОК `$app/paths`, а не код. Мок відтоді повторює цю нормалізацію,
	 * тож обидва боки кажуть одне.
	 */
	return path.endsWith('/') ? path : `${path}/`;
}

/** Абсолютна адреса тієї самої сторінки — для canonical, hreflang і sitemap. */
export function langUrl(lang: Language, rest: RouteRest = ''): string {
	const segments = [languageSegment(lang), rest].filter(Boolean);
	return `${SITE_ORIGIN}${SITE_BASE}/${segments.length ? `${segments.join('/')}/` : ''}`;
}

/**
 * «Хвіст» адреси за ID маршруту, а не за `pathname`.
 *
 * Саме за ID, бо `pathname` під час prerender містить `base`, а `base` там
 * відносний — і відрізати його від шляху нічим. ID натомість не залежить ні
 * від хостингу, ні від мови: `/[[lang=lang]]/game-population` → `game-population`.
 */
export function routeRestFromId(routeId: string | null): RouteRest {
	const rest = (routeId ?? '').replace('/[[lang=lang]]', '').replace(/^\/|\/$/g, '');
	return (rest in LANGUAGE_ROUTES ? rest : '') as RouteRest;
}
