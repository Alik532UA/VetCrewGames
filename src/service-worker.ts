/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { base, build, files, prerendered, version } from '$service-worker';
import { createWorker } from '$lib/pwa/cache';

/**
 * SERVICE WORKER — лише проводка подій. Уся логіка й причини — у `lib/pwa/cache.ts`.
 *
 * `skipWaiting` + `clients.claim`: нова збірка бере керування одразу, а не «коли закриють
 * усі вкладки». Застосунок із початкового екрана не закривається ніколи, тож без цього
 * новий воркер лишався б чекати вічно — а це і є «оновлюється лише після перевстановлення».
 * Відкрита сторінка старої збірки від цього не ламається: сторінки йдуть мережею, а
 * частина застосунку, якої вже немає на сервері, ловиться `utils/staleBuild.ts` і
 * перезавантажує сторінку свіжою.
 *
 * Реєструє воркер `lib/pwa/register.ts` (з `hooks.client.ts`) — лише в зібраному сайті.
 *
 * ЯКЩО КОЛИСЬ ТРЕБА БУДЕ ВОРКЕР ПРИБРАТИ: не видаляти цей файл. 404 на місці воркера
 * реєстрацію НЕ знімає, і старий воркер жив би далі. Замість логіки тут ставиться
 * самознищення (`self.registration.unregister()` в `activate`) — і тільки після того, як
 * воно розійшлося, файл можна прибирати.
 */
const sw = self as unknown as ServiceWorkerGlobalScope;

const worker = createWorker(
	{ base, version, build, files, prerendered },
	{ caches, fetch: (input, init) => fetch(input, init) }
);

sw.addEventListener('install', (event) => {
	event.waitUntil(worker.install().then(() => sw.skipWaiting()));
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(worker.activate().then(() => sw.clients.claim()));
});

sw.addEventListener('fetch', (event) => {
	const kind = worker.kindOf(event.request, sw.location.origin);
	if (kind === 'pass') return;
	event.respondWith(worker.respond(kind, event.request, (work) => event.waitUntil(work)));
});
