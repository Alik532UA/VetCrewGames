import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * SVELTE-CORE-v8 § 1.9 — наскрізний запис у мутаторі замість `$effect`.
 *
 * Перевіряється саме те, чого не було видно, доки збереженням керували
 * чотири ефекти під `$effect.root`:
 *
 *  1. **Гідрація нічого не пише.** Ефект спрацьовував на будь-яку зміну стану,
 *     зокрема на ту, що прийшла із самого сховища, — тобто застосунок
 *     перезаписував рівно те, що звідти щойно прочитав. Тест на чистому
 *     сховищі це ловить: жодного ключа після конструктора.
 *  2. **Мутатор пише і в сховище, і в DOM.** Без ефекту це єдине місце, де
 *     воно відбувається, тож пропущений виклик означає тему, яка не
 *     переживає перезавантаження.
 *
 * Зворотний експеримент (AI-AGENT-PITFALLS-v8 § 1.1): прибрати
 * `storage.set('theme', theme)` із `setTheme()` — червоніє «зберігає вибір
 * теми»; додати `storage.set` у конструктор — червоніє «гідрація не пише».
 */

function makeStorage(seed: Record<string, string> = {}): Storage {
	const data = new Map<string, string>(Object.entries(seed));
	return {
		get length() {
			return data.size;
		},
		key: (i: number) => [...data.keys()][i] ?? null,
		getItem: (k: string) => data.get(k) ?? null,
		setItem: (k: string, v: string) => void data.set(k, v),
		removeItem: (k: string) => void data.delete(k),
		clear: () => data.clear()
	} as Storage;
}

/** Системна тема має бути детермінованою: інакше тест залежить від машини. */
function stubMatchMedia(prefersDark: boolean) {
	vi.stubGlobal(
		'matchMedia',
		vi.fn(() => ({
			matches: prefersDark,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn()
		}))
	);
}

async function load(seed: Record<string, string> = {}, prefersDark = true) {
	vi.resetModules();
	const raw = makeStorage(seed);
	vi.stubGlobal('localStorage', raw);
	stubMatchMedia(prefersDark);
	const { settings } = await import('./settings.svelte');
	return { settings, raw };
}

const ownKeys = (raw: Storage) =>
	Array.from({ length: raw.length }, (_, i) => raw.key(i)).filter(Boolean);

describe('settings', () => {
	beforeEach(() => {
		document.documentElement.removeAttribute('data-theme');
		document.documentElement.removeAttribute('data-font');
		document.head.innerHTML = '<meta name="color-scheme" content="light dark" />';
	});

	it('гідрація не пише у сховище нічого', async () => {
		const { raw } = await load();
		expect(ownKeys(raw), 'ефект зберігав те, що щойно звідти прочитав').toEqual([]);
	});

	it('без збереженого вибору тему диктує система', async () => {
		const dark = await load({}, true);
		expect(dark.settings.theme).toBe('dark');

		const light = await load({}, false);
		expect(light.settings.theme).toBe('light-green');
	});

	it('збережений вибір перекриває системну тему', async () => {
		const { settings } = await load({ vetcrewgames_theme: 'winter' }, true);
		expect(settings.theme).toBe('winter');
		expect(document.documentElement.getAttribute('data-theme')).toBe('winter');
	});

	it('мігрує стару тему light у light-green', async () => {
		const { settings } = await load({ vetcrewgames_theme: 'light' });
		expect(settings.theme).toBe('light-green');
	});

	it('зберігає вибір теми і оновлює DOM тим самим викликом', async () => {
		const { settings, raw } = await load();

		settings.setTheme('orange-purple');

		expect(raw.getItem('vetcrewgames_theme')).toBe('orange-purple');
		expect(document.documentElement.getAttribute('data-theme')).toBe('orange-purple');
		// Мета-тег рухомий: для темних схем 'dark', інакше 'light dark' —
		// статичне значення повертає Force Dark Mode на Android (UI-UX-v8 § 1.2).
		expect(document.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe(
			'dark'
		);

		settings.setTheme('light-green');
		expect(document.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe(
			'light dark'
		);
	});

	it('toggleTheme обходить усі чотири теми по колу', async () => {
		const { settings } = await load();
		const seen = [settings.theme];
		for (let i = 0; i < 4; i++) {
			settings.toggleTheme();
			seen.push(settings.theme);
		}
		expect(new Set(seen.slice(0, 4)).size, 'кожна тема має траплятися рівно раз').toBe(4);
		expect(seen[4], 'після четвертого перемикання цикл замикається').toBe(seen[0]);
	});

	/**
	 * Мову диктує АДРЕСА, і `applyRouteLocale()` навмисно НЕ пише у сховище:
	 * сегмент шляху — це запит на конкретну сторінку, а не вибір користувача
	 * (I18N-v8 § 3.3). Запам'ятовує вибір окремий `rememberLocale()`, який
	 * кличе перемикач у шапці.
	 */
	it('мова з адреси змінює атрибут lang і не чіпає сховища', async () => {
		const { settings, raw } = await load();

		settings.applyRouteLocale('en');

		expect(document.documentElement.getAttribute('lang')).toBe('en');
		expect(raw.getItem('vetcrewgames_locale'), 'адреса — не вибір').toBeNull();
	});

	it('rememberLocale() зберігає вибір, savedLocale() його повертає', async () => {
		const { settings, raw } = await load();
		expect(settings.savedLocale()).toBeNull();

		settings.rememberLocale('en');

		expect(raw.getItem('vetcrewgames_locale')).toBe('en');
		expect(settings.savedLocale()).toBe('en');
	});

	// `zz` — код, зарезервований ISO 639 під приватне вживання: мовою сайту він
	// не стане ніколи. Доти тут стояла `de`, і з увімкненням німецької тест
	// почав вимагати, щоб справжня мова не зберігалася.
	it('зіпсована мова у сховищі не приймається за вибір', async () => {
		const { settings } = await load({ vetcrewgames_locale: 'zz' });
		expect(settings.savedLocale()).toBeNull();
	});

	it('зіпсований рахунок не перетворює його на NaN', async () => {
		const { settings } = await load({ vetcrewgames_score: 'не число' });
		expect(settings.score).toBe(0);

		settings.addScore(3);
		expect(settings.score).toBe(3);
	});

	it('init() повертає зняття підписки на системну тему', async () => {
		const removeEventListener = vi.fn();
		vi.resetModules();
		vi.stubGlobal('localStorage', makeStorage());
		vi.stubGlobal(
			'matchMedia',
			vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener }))
		);
		const { settings } = await import('./settings.svelte');

		settings.init()();

		expect(removeEventListener, 'підписка лишалася б жити після демонтажу').toHaveBeenCalled();
	});
});
