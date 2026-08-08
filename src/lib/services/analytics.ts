import { browser, dev } from '$app/environment';

/**
 * Google Analytics 4.
 *
 * Note that app.html also loads Plausible. Both run side by side for now; see
 * the note there before removing either.
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

// `dev` keeps local work from landing in the same property as real traffic.
const enabled = () => browser && !dev && isConfigured;

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

export function track(event: string, params: EventParams = {}) {
	if (!enabled()) return;
	initAnalytics();
	window.gtag?.('event', event, params);
}
