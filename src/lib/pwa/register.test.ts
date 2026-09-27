import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/utils/staleBuild', () => ({ freshLoad: vi.fn(async () => undefined) }));

import { freshLoad } from '$lib/utils/staleBuild';
import { LANGUAGE_ROUTES } from '$lib/i18n/routing';
import { RELOAD_ON_RESUME, resume, startPwa, type PwaHooks } from './register';

/**
 * Повернення в застосунок: коли підхоплювати нову збірку, а коли — ні.
 *
 * Сценарій автора — застосунок із початкового екрана iPhone, який не перезавантажується:
 * без цього нова версія приїжджала лише переходом між сторінками, а на меню не приїжджала
 * зовсім. Посеред гри перезавантаження — втрачена партія, тож там — лише перехід.
 */

const registration = () =>
	({ update: vi.fn(async () => undefined) }) as unknown as ServiceWorkerRegistration & {
		update: ReturnType<typeof vi.fn>;
	};

const hooks = (fresh: boolean | Error, route: string | null): PwaHooks => ({
	checkUpdate: () => (fresh instanceof Error ? Promise.reject(fresh) : Promise.resolve(fresh)),
	routeId: () => route
});

describe('повернення в застосунок', () => {
	beforeEach(() => vi.mocked(freshLoad).mockClear());

	it('нова збірка, а людина в меню — одразу свіжа сторінка', async () => {
		const reg = registration();
		expect(await resume(reg, hooks(true, '/[[lang=lang]]'))).toBe(true);
		expect(freshLoad).toHaveBeenCalledWith(window.location.href);
		expect(reg.update).toHaveBeenCalledOnce();
	});

	it('посеред гри — ні: партія не рветься, версія приїде на переході', async () => {
		expect(await resume(registration(), hooks(true, '/[[lang=lang]]/game-mythbusters'))).toBe(
			false
		);
		expect(await resume(registration(), hooks(true, '/[[lang=lang]]/pairs/online'))).toBe(false);
		expect(freshLoad).not.toHaveBeenCalled();
	});

	it('нової збірки немає, перевірка впала чи маршруту ще нема — нічого', async () => {
		expect(await resume(registration(), hooks(false, '/[[lang=lang]]'))).toBe(false);
		expect(await resume(registration(), hooks(new Error('offline'), '/[[lang=lang]]'))).toBe(false);
		expect(await resume(registration(), hooks(true, null))).toBe(false);
		expect(freshLoad).not.toHaveBeenCalled();
	});

	it('новий воркер питається щоразу — навіть коли перезавантажувати не можна', async () => {
		const reg = registration();
		await resume(reg, hooks(false, '/[[lang=lang]]/reserve'));
		expect(reg.update).toHaveBeenCalledOnce();
	});

	it('кожен маршрут переліку справді існує — перейменування не вимкне його мовчки', () => {
		const routes = new Set<string>(Object.values(LANGUAGE_ROUTES));
		for (const id of RELOAD_ON_RESUME) expect(routes.has(id), id).toBe(true);
	});
});

describe('реєстрація воркера', () => {
	const original = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');

	afterEach(() => {
		if (original) Object.defineProperty(navigator, 'serviceWorker', original);
		else delete (navigator as { serviceWorker?: unknown }).serviceWorker;
	});

	function fakeWorkers() {
		const reg = registration();
		const register = vi.fn(async () => reg);
		Object.defineProperty(navigator, 'serviceWorker', { value: { register }, configurable: true });
		return { register, reg };
	}

	it('у межах `base` і з `updateViaCache: none` — файл воркера щоразу з сервера', async () => {
		const { register } = fakeWorkers();
		startPwa(hooks(false, null));
		await vi.waitFor(() => expect(register).toHaveBeenCalledOnce());
		expect(register).toHaveBeenCalledWith('/service-worker.js', {
			scope: '/',
			updateViaCache: 'none'
		});
	});

	it('коли застосунок знову видно — питає про оновлення', async () => {
		const { reg } = fakeWorkers();
		const checkUpdate = vi.fn(async () => false);
		startPwa({ checkUpdate, routeId: () => '/[[lang=lang]]' });
		await vi.waitFor(() => expect(navigator.serviceWorker.register).toHaveBeenCalled());
		await Promise.resolve();
		document.dispatchEvent(new Event('visibilitychange'));
		await vi.waitFor(() => expect(checkUpdate).toHaveBeenCalledOnce());
		expect(reg.update).toHaveBeenCalledOnce();
	});

	it('без підтримки воркерів — тихо нічого', () => {
		delete (navigator as { serviceWorker?: unknown }).serviceWorker;
		expect(() => startPwa(hooks(true, '/[[lang=lang]]'))).not.toThrow();
	});
});
