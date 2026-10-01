import { browser } from '$app/environment';
import { isStandalone } from '$lib/services/fullscreen.svelte';
import { logService } from '$lib/services/logService.svelte';
import { storage } from '$lib/services/storage';

/**
 * ВСТАНОВЛЕННЯ ОДНИМ НАТИСКОМ — там, де браузер це дає (прохання автора 2026-09-29).
 *
 * ## Де воно є
 *
 * Лише в Chromium: Chrome, Edge, Samsung Internet, Opera — на Android і на компʼютері. Коли
 * сайт придатний до встановлення (маніфест, значки), браузер кидає `beforeinstallprompt`, і
 * збережена подія потім показує ЙОГО ВЛАСНЕ вікно «Встановити додаток» одним натиском.
 * Safari (iPhone, iPad, Mac) і Firefox такої події не мають — там вікно «На весь екран»
 * показує кроки вручну (`installGuide.ts`).
 *
 * ## Чому подію ловить скрипт першого кадру, а не цей модуль
 *
 * Подія приходить ОДИН раз, невдовзі після завантаження. Перша редакція вішала слухача в
 * `startPwa()` — лінивому модулі, що вантажиться лише в зібраному сайті, — і скарга автора
 * прийшла того ж дня: «у Slovko в Chrome викликається вікно, а в нас ні». У dev слухача не
 * було зовсім, а в збірці він чіплявся вже після старту застосунку, тобто міг пропустити
 * подію. Тепер її ловить інлайн-скрипт `app.html` — найраніше, що є, і однаково в dev та
 * збірці — і кладе в `window.__vetcrewgamesInstallPrompt`. Тут лише читання.
 *
 * ## Ціна `preventDefault()`
 *
 * Без нього Chrome на Android сам показує внизу смужку «Додати на головний екран». З ним —
 * ні: пропозиція встановити йде лише через кнопку «На весь екран».
 */

/** `beforeinstallprompt` — лише Chromium, у типах DOM його немає. */
interface InstallPromptEvent extends Event {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/** Що сталося з натиском «Встановити». `unavailable` — вікна браузера немає, потрібні кроки. */
export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

/** Сховок скрипта першого кадру (`app.html`). */
type Stash = Window & { __vetcrewgamesInstallPrompt?: InstallPromptEvent | null };

/** Чи є вікно браузера «Встановити додаток» саме зараз. */
export const canPromptInstall = (): boolean =>
	Boolean((window as Stash).__vetcrewgamesInstallPrompt);

/**
 * Показати вікно браузера.
 *
 * `prompt()` кличеться ДО першого `await`, тобто в тому самому натиску: без дії людини
 * браузер вікна не покаже. Подію можна показати лише раз — тому її забуто одразу.
 */
export async function promptInstall(): Promise<InstallOutcome> {
	const stash = window as Stash;
	const event = stash.__vetcrewgamesInstallPrompt;
	if (!event) return 'unavailable';
	stash.__vetcrewgamesInstallPrompt = null;
	try {
		await event.prompt();
		const { outcome } = await event.userChoice;
		logService.info('app', 'install prompt answered', { outcome });
		return outcome;
	} catch (error) {
		logService.warn('app', 'install prompt failed', { reason: String(error) });
		return 'unavailable';
	}
}

/**
 * Чи вже встановлено додаток на цьому пристрої.
 *
 * Перевіряє три джерела:
 * 1. Вікно вже запущено в standalone (`isStandalone`);
 * 2. API `navigator.getInstalledRelatedApps()` (Chromium);
 * 3. Локальний прапорець `vetcrewgames_installed` від події `appinstalled`.
 */
export async function isAppAlreadyInstalled(): Promise<boolean> {
	if (!browser) return false;
	if (isStandalone()) return true;

	if ('getInstalledRelatedApps' in navigator && typeof navigator.getInstalledRelatedApps === 'function') {
		try {
			const apps = await (
				navigator as Navigator & {
					getInstalledRelatedApps: () => Promise<Array<{ id?: string; platform?: string; url?: string }>>;
				}
			).getInstalledRelatedApps();
			if (apps && apps.length > 0) return true;
		} catch {
			// не підтримується або заблоковано браузером
		}
	}

	if (storage.get('installed') === 'true') {
		return true;
	}

	return false;
}

