import { SITE_ORIGIN } from '$lib/i18n/routing';
import { EMULATOR } from '$lib/net/emulator';
import { checkLiveRules } from '$lib/net/rulesLive';
import { logService, type LogContext } from '$lib/services/logService.svelte';
import {
	deniedDeep,
	netProblem,
	shortStack,
	type NetProblem,
	type ProblemFacts
} from '$lib/utils/netProblem';

/**
 * ФАКТИ ДЛЯ `utils/netProblem.ts` — звідки вони беруться (прохання автора 2026-09-27).
 *
 * Сама таблиця причин чиста й перевірена окремо; тут — те, що вимагає мережі й браузера:
 * звірка штампа правил, опитування версії й адреса сторінки. Інтерфейсом, щоб тест хабу
 * й пошуку підставив свої факти й не пішов у мережу.
 */
export interface ProblemProbe {
	/** `navigator.onLine`. */
	online(): boolean;
	/**
	 * Звірка штампа правил (`net/rulesLive.ts`). Кличеться ЛИШЕ після відмови бази: вона
	 * вимагає входу, а після відмови вхід уже є — звірка не заводить нікому обліковки.
	 */
	rules(): Promise<'fresh' | 'stale' | 'unknown'>;
	/** Чи є на сервері інша збірка (`updated.check()`; у dev SvelteKit каже «ні» завжди). */
	newBuild(): Promise<boolean>;
	/** Збірка з Pages, а не локальна (dev, прев'ю, телефон у локальній мережі). */
	deployed(): boolean;
	/** Dev на локальному емуляторі (`net/emulator.ts`). */
	emulator(): boolean;
}

/**
 * Справжні факти. Опитування версії дає СТОРІНКА (`updated.check` із `$app/state`): у
 * `lib/` рантайму SvelteKit немає ніде, і тест, що імпортує цей файл, його не тягне.
 */
export function liveProbe(newBuild: () => Promise<boolean>): ProblemProbe {
	return {
		// Емулятор — на цій машині: без інтернету він працює так само.
		online: () => EMULATOR || navigator.onLine,
		rules: async () => (await checkLiveRules()).state,
		newBuild,
		deployed: () => location.origin === SITE_ORIGIN,
		emulator: () => EMULATOR
	};
}

/**
 * Скільки чекати звірки. Не перестраховка: без звʼязку `get()` бази не відмовляє, а
 * чекає, поки звʼязок повернеться, — і пошук висів би в «Шукаємо гравця…» назавжди.
 */
export const PROBE_WAIT_MS = 5000;

/** Причина разом із фактами, з яких її виведено: і те, і те йде в журнал. */
export interface Diagnosis extends Omit<ProblemFacts, 'error'> {
	problem: NetProblem;
}

/** Відповідь або запасне значення: і на відмову, і на мовчання довше за `ms`. */
function within<T>(promise: Promise<T>, fallback: T, ms: number): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const late = new Promise<T>((resolve) => (timer = setTimeout(() => resolve(fallback), ms)));
	return Promise.race([promise.catch(() => fallback), late]).finally(() => clearTimeout(timer));
}

/** Назвати причину збою. Не кидає: діагноз, що сам упав, лишив би людину без пояснення. */
export async function diagnose(
	error: unknown,
	probe: ProblemProbe,
	wait = PROBE_WAIT_MS
): Promise<Diagnosis> {
	const [rules, newBuild] = await Promise.all([
		deniedDeep(error) ? within(probe.rules(), 'unknown' as const, wait) : Promise.resolve(null),
		within(probe.newBuild(), false, wait)
	]);
	const online = probe.online();
	const deployed = probe.deployed();
	const emulator = probe.emulator();
	const problem = netProblem({ error, online, rules, newBuild, deployed, emulator });
	return { problem, rules, newBuild, deployed, online, emulator };
}

/**
 * ЗБІЙ У ЖУРНАЛ — разом із причиною й фактами, з яких її виведено.
 *
 * Рівень `error` — лише дефект коду (DEBUGGING-v9 § 1.3): червоний лічильник на табло
 * мусить означати «сталося те, чого не мало статися», а не «у людини пропала мережа» чи
 * «правила ще не викладені». Стек — теж лише тоді: у відмови бази він показує нутрощі
 * SDK, а не наш рядок.
 */
export function logFailure(
	message: string,
	error: unknown,
	diagnosis: Diagnosis,
	context: LogContext
): void {
	const code = diagnosis.problem === 'code';
	const entry = {
		...context,
		...diagnosis,
		reason: String(error),
		...(code ? { stack: shortStack(error) } : {})
	};
	if (code) logService.error('network', message, entry);
	else logService.warn('network', message, entry);
}
