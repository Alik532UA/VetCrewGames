// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

/**
 * КНОПКА «НА ВЕСЬ ЕКРАН» ХОВАЄТЬСЯ ДО ГІДРАЦІЇ — і тією самою умовою, що в сервісі.
 *
 * З 2026-09-29 (прохання автора) кнопки немає ЛИШЕ у встановленому застосунку, який
 * повного екрана не вміє (iPhone з початкового екрана). На iPhone у браузері вона тепер є
 * й відкриває пояснення з кроками встановлення. Доти (2026-09-26) її ховав сам факт
 * «не вміє».
 *
 * Скрипт першого кадру (`src/app.html`) не може імпортувати сервіс, тож умова існує у
 * двох місцях. Розійдуться вони МОВЧКИ: до гідрації кнопка є, після — немає (або
 * навпаки), і шапка стрибає. Тому скрипт тут ВИКОНУЄТЬСЯ — на підставних документах із
 * кожною комбінацією ознак, — а не звіряється текстом.
 *
 * Зворотні експерименти: прибрати зі скрипта `webkitFullscreenEnabled` — червоніє
 * «старий WebKit»; прибрати умову «встановлено» — червоніє «iPhone у браузері»; прибрати
 * `navigator.standalone` — червоніє «Safari з початкового екрана»; прибрати правило зі
 * стилів шапки — червоніє «правило».
 */

const APP_HTML = 'src/app.html';
const HEADER = 'src/lib/components/GameHeader.svelte';
const SERVICE = 'src/lib/services/fullscreen.svelte.ts';

const html = readFileSync(APP_HTML, 'utf8');

/** Тіло інлайн-скрипта першого кадру — рівно те, що виконає браузер. */
const firstFrame = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';

interface Case {
	/** Ознаки документа: `fullscreenEnabled`, `webkitFullscreenEnabled`. */
	features?: Record<string, unknown>;
	/** `navigator.standalone` — ознака Safari, відкритого з початкового екрана. */
	iosStandalone?: boolean;
	/** `display-mode: standalone` — стандартна ознака встановленого застосунку. */
	displayStandalone?: boolean;
}

/** Прогнати скрипт першого кадру на документі з такими ознаками. */
function runFirstFrame({ features = {}, iosStandalone, displayStandalone = false }: Case) {
	const classes = new Set<string>();
	const listeners = new Map<string, (event: unknown) => void>();
	const documentElement = {
		setAttribute: () => {},
		classList: { add: (name: string) => classes.add(name) }
	};
	const document = { documentElement, querySelector: () => null, ...features };
	const window: Record<string, unknown> = {
		matchMedia: (query: string) => ({
			matches: query === '(display-mode: standalone)' && displayStandalone
		}),
		addEventListener: (type: string, listener: (event: unknown) => void) =>
			listeners.set(type, listener)
	};
	const navigator = iosStandalone === undefined ? {} : { standalone: iosStandalone };
	const localStorage = { getItem: () => null };
	// Окремий контекст, а не `new Function`: скрипт бачить рівно ці імена — як браузер на
	// першому кадрі, коли застосунку ще немає.
	runInNewContext(firstFrame, { document, window, navigator, localStorage });
	return {
		classes: [...classes],
		window,
		fire: (type: string, event: unknown = {}) => listeners.get(type)?.(event)
	};
}

const classesAfterFirstFrame = (options: Case): string[] => runFirstFrame(options).classes;

describe('кнопка «на весь екран» до гідрації', () => {
	it('перевірка жива: скрипт першого кадру знайдено', () => {
		expect(firstFrame).toContain('fullscreenEnabled');
		expect(firstFrame).toContain('display-mode: standalone');
	});

	it('iPhone у браузері (не вміє, не встановлено) — класу немає: кнопка пояснює й радить', () => {
		expect(classesAfterFirstFrame({})).not.toContain('no-fullscreen');
	});

	it('Safari з початкового екрана (не вміє, встановлено) — клас ставиться', () => {
		expect(classesAfterFirstFrame({ iosStandalone: true })).toContain('no-fullscreen');
	});

	it('встановлений застосунок за `display-mode` (не вміє) — клас ставиться', () => {
		expect(classesAfterFirstFrame({ displayStandalone: true })).toContain('no-fullscreen');
	});

	it('уміє — класу немає ні в браузері, ні у встановленому', () => {
		for (const installed of [false, true]) {
			expect(
				classesAfterFirstFrame({ features: { fullscreenEnabled: true }, iosStandalone: installed })
			).not.toContain('no-fullscreen');
		}
	});

	it('старий WebKit — теж уміє', () => {
		expect(
			classesAfterFirstFrame({ features: { webkitFullscreenEnabled: true }, iosStandalone: true })
		).not.toContain('no-fullscreen');
	});

	it('та сама умова, що в сервісі', () => {
		const service = readFileSync(SERVICE, 'utf8');
		expect(service).toContain('doc.fullscreenEnabled || doc.webkitFullscreenEnabled');
		expect(firstFrame).toContain('document.fullscreenEnabled || document.webkitFullscreenEnabled');
		expect(service).toContain(
			"nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true"
		);
		expect(firstFrame).toContain('navigator.standalone === true');
		expect(firstFrame).toContain(
			"window.matchMedia('(display-mode: standalone)').matches === true"
		);
		// «Сховано» в сервісі — рівно «не вміє й установлено».
		expect(service).toContain("return state.installed ? 'hidden' : 'blocked';");
	});

	it('правило, що ховає кнопку, — у стилях шапки, а кнопка має його клас', () => {
		const header = readFileSync(HEADER, 'utf8');
		expect(header).toMatch(
			/:global\(html\.no-fullscreen\) \.fullscreen-btn \{\s*display: none;\s*\}/
		);
		expect(header).toMatch(/class="header-btn fullscreen-btn"/);
	});
});

/**
 * ПОДІЮ «МОЖНА ВСТАНОВИТИ» ЛОВИТЬ ПЕРШИЙ КАДР (скарга автора 2026-09-29: «у Slovko в Chrome
 * викликається вікно, а в нас ні»). Перша редакція вішала слухача в лінивому модулі, і він
 * не встигав: подія приходить раз, невдовзі після завантаження. Тепер скрипт `app.html`
 * глушить власну смужку браузера й зберігає подію для `lib/pwa/installPrompt.ts`.
 *
 * Зворотні експерименти: прибрати `preventDefault` — червоніє «глушить»; не забувати подію
 * після `appinstalled` — червоніє «встановили».
 */
describe('подія «можна встановити» — на першому кадрі', () => {
	it('ловить, глушить смужку браузера й зберігає для натиску', () => {
		const frame = runFirstFrame({});
		const event = { preventDefault: vi.fn() };
		frame.fire('beforeinstallprompt', event);
		expect(event.preventDefault).toHaveBeenCalledTimes(1);
		expect(frame.window.__vetcrewgamesInstallPrompt).toBe(event);
	});

	it('встановили — подію забуто: вдруге вікна браузера не буде', () => {
		const frame = runFirstFrame({});
		frame.fire('beforeinstallprompt', { preventDefault: () => {} });
		frame.fire('appinstalled');
		expect(frame.window.__vetcrewgamesInstallPrompt).toBeNull();
	});

	it('той самий сховок читає модуль встановлення', () => {
		const module = readFileSync('src/lib/pwa/installPrompt.ts', 'utf8');
		expect(firstFrame).toContain('window.__vetcrewgamesInstallPrompt = event');
		expect(module).toContain('__vetcrewgamesInstallPrompt');
	});
});
