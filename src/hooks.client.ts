import * as Sentry from '@sentry/sveltekit';
import { handleErrorWithSentry } from '@sentry/sveltekit';
import { env } from '$env/dynamic/public';
import { dev } from '$app/environment';

/**
 * DSN приходить із `PUBLIC_SENTRY_DSN` і зараз ніде не заданий — ні локально,
 * ні у workflow. Порожній DSN означає, що SDK не надсилає нічого, і це
 * валідний стан (OBSERVABILITY-v8 § 9: «трекер не використовується»). Усе
 * нижче написане так, щоб у момент появи DSN нічого не довелося доналаштовувати.
 */
Sentry.init({
	dsn: env.PUBLIC_SENTRY_DSN || '',
	// Локальні помилки не мають потрапляти в той самий проєкт, що й бойові.
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
	 * OBSERVABILITY-v8 § 1.6, HIGH: квота вигорає не на багах, а на нормальному
	 * житті користувачів — метро без мережі, закрита вкладка посеред запиту,
	 * блокувальник реклами. Те, що в логері має рівень `warn`
	 * (DEBUGGING-v8 § 1.3), у телеметрію не йде взагалі.
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

export const handleError = handleErrorWithSentry();
