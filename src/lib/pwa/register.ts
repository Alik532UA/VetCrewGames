import { resolve } from '$app/paths';
import { logService } from '$lib/services/logService.svelte';
import { freshLoad } from '$lib/utils/staleBuild';

/**
 * РЕЄСТРАЦІЯ SERVICE WORKER І ОНОВЛЕННЯ ПРИ ПОВЕРНЕННІ В ЗАСТОСУНОК.
 *
 * ## Чого бракувало без цього (скарга автора 2026-09-27)
 *
 * «При оновленні сайту треба щоразу перевстановлювати PWA». Застосунок із початкового
 * екрана не перезавантажується: iPhone повертає його таким, яким залишили, хоч і через
 * тиждень. Кнопки «оновити» в ньому немає, а нова версія доти підхоплювалася лише ПЕРЕХОДОМ
 * між сторінками (`beforeNavigate` у кореневому layout) — і лише після того, як опитування
 * версії (раз на пʼять хвилин, і в фоні таймери стоять) її помітило. На меню, де ніхто не
 * переходить, лишалася стара версія — і людина перевстановлювала.
 *
 * ## Що тут робиться
 *
 *  1. Воркер реєструється після `load` (не змагається зі сторінкою за мережу), з
 *     `updateViaCache: 'none'`: файл воркера щоразу питається в сервера, а не в HTTP-кешу.
 *  2. Щойно застосунок знову видно (`visibilitychange`), питаємо про нову збірку ОДРАЗУ:
 *     `registration.update()` — новий воркер, `checkUpdate()` — нова версія SvelteKit (це
 *     вмикає й перезавантаження на найближчому переході).
 *  3. Якщо нова є, а людина в МЕНЮ (`RELOAD_ON_RESUME`), сторінка перезавантажується свіжою
 *     відразу — стану там немає. Посеред гри — ні: партію не рвемо, версія приїде на
 *     першому ж переході. Перелік — дозволених, а не заборонених, свідомо: нова гра, якої
 *     тут немає, за замовчуванням НЕ перезавантажується посеред партії.
 *
 * Реєструє лише зібраний сайт (`hooks.client.ts`, `!dev`): у dev воркер кешував би модулі,
 * які Vite міняє на ходу.
 */

/** Маршрути без стану гри: тут повернення в застосунок можна перезавантажити. */
export const RELOAD_ON_RESUME: ReadonlySet<string> = new Set([
	'/[[lang=lang]]',
	'/[[lang=lang]]/play',
	'/[[lang=lang]]/quiz/play'
]);

export interface PwaHooks {
	/** `updated.check()` із `$app/state`: чи вийшла нова збірка. */
	checkUpdate: () => Promise<boolean>;
	/** `page.route.id` поточної сторінки. */
	routeId: () => string | null;
}

/** Повернення в застосунок: спитати про нову збірку й, якщо можна, перейти на неї. */
export async function resume(registration: ServiceWorkerRegistration, hooks: PwaHooks) {
	registration.update().catch(() => undefined);
	const fresh = await hooks.checkUpdate().catch(() => false);
	const route = hooks.routeId();
	if (!fresh || !route || !RELOAD_ON_RESUME.has(route)) return false;
	logService.info('app', 'new build on resume — reload', { route });
	void freshLoad(window.location.href);
	return true;
}

async function register(hooks: PwaHooks) {
	let registration: ServiceWorkerRegistration;
	// Корінь застосунку — з `resolve()`: у браузері це абсолютний `/VetCrewGames/`.
	const scope = resolve('/');
	try {
		registration = await navigator.serviceWorker.register(`${scope}service-worker.js`, {
			scope,
			updateViaCache: 'none'
		});
	} catch (error) {
		logService.warn('app', 'service worker not registered', { reason: String(error) });
		return;
	}
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') void resume(registration, hooks);
	});
}

export function startPwa(hooks: PwaHooks): void {
	if (!('serviceWorker' in navigator)) return;
	if (document.readyState === 'complete') void register(hooks);
	else window.addEventListener('load', () => void register(hooks), { once: true });
}
