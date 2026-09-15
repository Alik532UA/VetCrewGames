import { browser, dev } from '$app/environment';

/**
 * Google Analytics 4 — єдиний лічильник проєкту.
 *
 * Тут стояв рядок «app.html also loads Plausible. Both run side by side» —
 * і це неправда: жодного Plausible у `app.html` немає й не було. Документ, що
 * суперечить коду, вводить в оману активніше за його відсутність
 * (DOCUMENTATION-v8 § 8): наступний читач шукав би другий лічильник, а перед
 * тим ще й вирішував би, який із двох правильний (ANALYTICS-v9 § 1).
 *
 * The measurement ID sits here rather than in an environment variable: it is
 * public by design — it ships in the page source of every site that uses GA —
 * so hiding it would buy nothing, while a missing CI variable would switch
 * analytics off silently.
 */
const GA_ID_PLACEHOLDER = 'G-XXXXXXXXXX';
// Annotated as string so the placeholder check below stays a real comparison:
// as literal types TypeScript narrows them and rejects it as always-true.
const GA_ID: string = 'G-0E633M761B';

// Compared against the whole placeholder rather than searching for a run of
// X's: real measurement IDs can contain them.
const isConfigured = /^G-[A-Z0-9]{6,}$/.test(GA_ID) && GA_ID !== GA_ID_PLACEHOLDER;

/**
 * ВІДМОВА ВІД ВІДСТЕЖУВАННЯ ПОВАЖАЄТЬСЯ — незалежно від того, чи є банер згоди.
 *
 * ANALYTICS-v9 § 4.2 називає це мінімумом, який не залежить від обраної позиції:
 * проєкт свідомо йде без банера (позиція B, записана в `PROJECT-CONTEXT.md`), і
 * саме тому єдиний сигнал, яким людина може сказати «ні», мусить діяти. Інакше
 * «без банера» означає «без способу відмовитися».
 *
 * Два сигнали, а не один, бо вони з різних епох і надсилають їх різні браузери:
 * `doNotTrack` (старий, Firefox і Safari донедавна) і `globalPrivacyControl`
 * (новий, юридично значущий у частині штатів США). Жоден із них не стандартний
 * у DOM-типах, тож читаються вони через звуження, а не через `any`.
 *
 * Перевіряється при КОЖНОМУ виклику, а не один раз при завантаженні: обидва
 * значення людина може змінити в налаштуваннях браузера, не перезавантажуючи
 * сторінку.
 */
const optedOut = () => {
	if (!browser) return false;
	const nav = navigator as Navigator & {
		doNotTrack?: string | null;
		globalPrivacyControl?: boolean;
		msDoNotTrack?: string | null;
	};
	const win = window as Window & { doNotTrack?: string | null };
	// `'1'` і `'yes'` — обидва траплялися в живих браузерах; `'0'` і `'unspecified'`
	// означають «не заперечую», тож перевіряється саме згода на відмову.
	const dnt = nav.doNotTrack ?? win.doNotTrack ?? nav.msDoNotTrack ?? null;
	return nav.globalPrivacyControl === true || dnt === '1' || dnt === 'yes';
};

/**
 * Локальне середовище або автоматизований тест (Playwright, Puppeteer тощо).
 * Запобігає засміченню аналітики під час розробки, локального прев'ю та E2E-тестів.
 */
const isTestOrLocal = () => {
	if (!browser || typeof window === 'undefined') return false;
	const hostname = window.location?.hostname ?? '';
	const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
	const isWebDriver = typeof navigator !== 'undefined' && Boolean(navigator.webdriver);
	return isLocal || isWebDriver;
};

// `dev`, `localhost` та автотести відключають аналітику, щоб тестовий трафік не потрапляв у продакшн.
const enabled = () => browser && !dev && !isTestOrLocal() && isConfigured && !optedOut();

export type AnalyticsEvent =
	| 'language_change'
	| 'theme_change'
	| 'section_view'
	| 'game_select'
	| 'game_start'
	| 'game_finish'
	| 'service_badge_click';

type EventParams = Record<string, string | number | boolean>;

declare global {
	interface Window {
		dataLayer?: unknown[];
		gtag?: (...args: unknown[]) => void;
	}
}

let started = false;

export function initAnalytics() {
	if (!enabled() || started) return;
	started = true;

	const dataLayer = (window.dataLayer = window.dataLayer ?? []);
	window.gtag = function gtag() {
		// gtag.js reads the raw `arguments` object back off the queue, so this
		// cannot be an arrow function taking rest parameters.
		// eslint-disable-next-line prefer-rest-params
		dataLayer.push(arguments);
	};

	window.gtag('js', new Date());
	// Page views are sent by hand from the root layout: the automatic one fires
	// before the router has settled, and never fires again for the client-side
	// moves between the two games.
	window.gtag('config', GA_ID, { send_page_view: false });

	const script = document.createElement('script');
	script.async = true;
	script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
	document.head.appendChild(script);
}

export function trackPageView() {
	if (!enabled()) return;
	// afterNavigate can fire before onMount, so neither caller may assume the
	// other ran first. initAnalytics is idempotent, and gtag queues into
	// dataLayer until its script arrives.
	initAnalytics();
	const { origin, pathname } = window.location;
	window.gtag?.('event', 'page_view', { page_location: `${origin}${pathname}` });
}

export function track(event: AnalyticsEvent, params: EventParams = {}) {
	if (!enabled()) return;
	initAnalytics();
	window.gtag?.('event', event, params);
}
