import { env } from '$env/dynamic/public';
import { dev } from '$app/environment';
import { logService } from '$lib/services/logService.svelte';
import type { HandleClientError } from '@sveltejs/kit';

/**
 * Трекер помилок — і головне тут те, що при порожньому DSN він НЕ ЇДЕ.
 *
 * ## Що було не так
 *
 * `PUBLIC_SENTRY_DSN` не заданий ніде — ні локально, ні у workflow. Порожній DSN
 * означає, що SDK не надсилає нічого, і це валідний стан (OBSERVABILITY-v8 § 9:
 * «трекер не використовується»). Але статичний `import * as Sentry` не питає про
 * DSN: SDK потрапляв у замикання кореневого layout і їхав КОЖНОМУ відвідувачу —
 * 84 КБ gzip коду, який за побудовою нічого не робить. Кореневий layout стояв на
 * 118 КБ при бюджеті 120, тобто один комміт від падіння гейта, і три чверті цієї
 * ваги були трекером, вимкненим порожнім рядком.
 *
 * ## Що зроблено
 *
 * SDK приходить `await import()`. Дві властивості, і обидві потрібні:
 *
 *  * при порожньому DSN чанк не завантажується НІКОЛИ — і, що важливіше для
 *    бюджету, він не входить у статичне замикання layout. Вага зникає не з
 *    диска, а з кожного завантаження сторінки;
 *  * при заданому DSN `init()` викликається одразу, у тілі модуля, а не при
 *    першій помилці. Це не косметика: саме `init()` ставить глобальні
 *    перехоплювачі на `error` і `unhandledrejection`, тобто ловить те, що НЕ
 *    проходить через `handleError` SvelteKit. Ленива ініціалізація «при першій
 *    помилці» пропустила б рівно ті помилки, заради яких трекер і потрібен.
 *
 * Ціна названа: із DSN трекер стає активним на кілька мілісекунд пізніше — за
 * час, поки приїде окремий чанк. Помилка в цьому вікні втрачається. Це дешевше
 * за 84 КБ на кожного відвідувача в стані, коли трекера немає взагалі.
 *
 * ## Чого НЕ зроблено
 *
 * Пакет не прибраний із залежностей. Повернути трекер — це задати
 * `PUBLIC_SENTRY_DSN`, і більше нічого: усі налаштування нижче лишилися на
 * місці. Видалення пакета зробило б цей крок правкою коду, а не змінною
 * середовища.
 */
const DSN = env.PUBLIC_SENTRY_DSN || '';

/**
 * Обіцянка ініціалізації, або `null`, коли трекера немає.
 *
 * `null` тут — не «ще не готово», а «не буде»: `handleError` нижче розрізняє ці
 * два стани, і від цього залежить, чи чекати на чанк.
 */
const tracker =
	DSN && !dev
		? import('@sentry/sveltekit').then((Sentry) => {
				Sentry.init({
					dsn: DSN,
					// Локальні помилки не мають потрапляти в той самий проєкт, що й бойові.
					// Умова лишається й тут, поверх гарди вище: `enabled` — це те, що
					// читає сам SDK, і зняти його означало б покластися на одну перевірку.
					enabled: !dev,
					// Без release регресію неможливо прив'язати до збірки, у якій вона
					// з'явилася (OBSERVABILITY-v8 § 1.3). Значення те саме, що йде у звіт
					// LogCopyButton, тож номери в баг-репорті й у трекері збігаються.
					release: __APP_VERSION__,
					tracesSampleRate: 0.1,
					replaysSessionSampleRate: 0,
					replaysOnErrorSampleRate: 1.0,
					environment: import.meta.env.MODE,
					integrations: [Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })],

					/**
					 * OBSERVABILITY-v8 § 1.6, HIGH: квота вигорає не на багах, а на
					 * нормальному житті користувачів — метро без мережі, закрита вкладка
					 * посеред запиту, блокувальник реклами. Те, що в логері має рівень
					 * `warn` (DEBUGGING-v8 § 1.3), у телеметрію не йде взагалі.
					 */
					ignoreErrors: [
						'AbortError',
						'Failed to fetch',
						'NetworkError when attempting to fetch resource',
						// Шум браузера, а не баг застосунку.
						'ResizeObserver loop limit exceeded',
						'ResizeObserver loop completed with undelivered notifications'
					],
					beforeSend(event, hint) {
						const error = hint?.originalException;
						if (error instanceof DOMException && error.name === 'AbortError') return null;
						// Офлайн — очікуваний стан, а не збій застосунку.
						if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
						return event;
					}
				});
				return Sentry;
			})
		: null;

/**
 * Помилка навігації або завантаження даних.
 *
 * Запис у `logService` іде ПЕРШИМ і безумовно — і це прибуток, а не побічний
 * ефект. Доти тут стояв самий `handleErrorWithSentry()`, тож при порожньому DSN
 * помилка цього класу не потрапляла нікуди: `svelte:boundary` у layout ловить
 * помилки РЕНДЕРУ, а слухач `window.error` — помилки з обробників подій. Помилку
 * `load` не бачив ні той, ні той, і у звіті бета-тестувальника її не було.
 */
export const handleError: HandleClientError = async ({ error, event, status, message }) => {
	const route = event.route.id ?? 'unknown';
	logService.error('app', 'Unhandled client error', { message, status, route });

	if (!tracker) return;
	const Sentry = await tracker;
	/*
	 * `captureException`, а не `handleErrorWithSentry()`. Останній у цьому пакеті
	 * типізований під СЕРВЕРНИЙ хук (`RequestEvent` із `cookies`, `fetch`,
	 * `locals`), тож клієнтський `NavigationEvent` йому не підходить —
	 * `svelte-check` каже це прямо. Доти помилки не було лише тому, що
	 * `handleError` експортувався без анотації типу, і невідповідність не
	 * перевірялася ніде.
	 *
	 * Низькорівневий виклик робить тут те саме: надсилає виняток із контекстом
	 * маршруту. Обгортка додала б лише те, що вже зробив рядок вище.
	 */
	Sentry.captureException(error, { extra: { route, status, message } });
};
