import { isDenied } from '$lib/net/denied';
import { chunkMissing } from './staleBuild';

/**
 * ЩО САМЕ ЗЛАМАЛОСЯ — І ЩО З ЦИМ РОБИТИ ЛЮДИНІ (прохання автора 2026-09-27).
 *
 * Доти на будь-який збій автоматичного пошуку стояло «Пошук гри не вдався — спробуйте ще
 * раз». Автор натиснув чотири рази, і нічого не змінилося: правила `seek` ще не були
 * викладені у Firebase, тож база відмовляла щоразу, а порада обіцяла, що повтор допоможе.
 * Кожна причина нижче вимагає ІНШОЇ дії, і текст мусить назвати саме її:
 *
 *  • `offline`  — немає звʼязку. Повтор і є ліки.
 *  • `reload`   — на сервері вже інша збірка: ця сторінка стара. Оновити сторінку.
 *  • `mismatch` — правила бази змінилися після того, як вийшла ця версія гри, а нової
 *                 збірки ще немає: гру саме оновлюють. Оновити за кілька хвилин; не
 *                 допомогло — до розробника.
 *  • `rules`    — правила бази не ті, з якими зібрано ЛОКАЛЬНУ збірку: нових правил ще
 *                 не виклали. Повтор не допоможе, допоможе викладка.
 *  • `code`     — правила ті самі, а база відмовляє, або виняток, якого не мало бути:
 *                 дефект коду. До розробника, зі звітом.
 *
 * ## `mismatch` і `rules` — один і той самий «stale», і розводить їх, ЗВІДКИ збірка
 *
 * Штамп правил (`net/rulesLive.ts`) каже лише «у базі інша редакція», а не котра новіша.
 * Відповідь дає порядок викладки: CI викладає правила ПЕРЕД сайтом і лише на зеленому
 * (`deploy.yml`, `rules_deploy` → `deploy`). Тож у збірки з Pages її правила вже діяли в
 * мить викладки, і «інша редакція» може означати лише одне: правила поїхали вперед. А в
 * локальної збірки (dev, прев'ю, телефон у локальній мережі) такої гарантії немає — там
 * «інша» майже завжди означає «ті, що в цьому дереві, ще не викладені».
 *
 * Емулятора в цьому переліку немає, і це не пропуск: застосунок до нього не ходить НІКОЛИ,
 * навіть із прапорцем (`net/emulatorSession.ts`), — лише перевірки `npm run check:rules`.
 */
export type NetProblem = 'offline' | 'reload' | 'mismatch' | 'rules' | 'code';

/** Що відомо про збій і довкола нього. Збирає `controllers/diagnose.ts`. */
export interface ProblemFacts {
	error: unknown;
	/** `navigator.onLine`: `false` — мережі немає напевно (`true` не обіцяє нічого). */
	online: boolean;
	/** Звірка штампа правил; `null` — не звіряли, бо відмови правил не було. */
	rules: 'fresh' | 'stale' | 'unknown' | null;
	/** На сервері вже інша збірка (опитування версії SvelteKit). */
	newBuild: boolean;
	/** Збірка з Pages, а не локальна: її правила CI виклав РАНІШЕ за неї. */
	deployed: boolean;
}

/** Помилка й причини під нею (`Error.cause`): «код зайнятий», за яким стоїть відмова правил. */
function chain(error: unknown): unknown[] {
	const all: unknown[] = [];
	for (let at: unknown = error; at !== undefined && all.length < 4; ) {
		all.push(at);
		at = at instanceof Error ? at.cause : undefined;
	}
	return all;
}

/**
 * Обрив, як його називають SDK і браузери. Firebase Auth без мережі —
 * `auth/network-request-failed`; `fetch` — `Failed to fetch` (Chromium),
 * `NetworkError when attempting to fetch resource` (Firefox), `Load failed` (Safari).
 */
const OFFLINE =
	/network-request-failed|failed to fetch|networkerror|load failed|client is offline/i;

const text = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Відмова правил — у самій помилці чи в причині під нею. */
export const deniedDeep = (error: unknown): boolean => chain(error).some(isDenied);

/** Назвати причину. Порядок — від того, що лікується найпростіше. */
export function netProblem(facts: ProblemFacts): NetProblem {
	const errors = chain(facts.error);
	if (facts.newBuild || errors.some(chunkMissing)) return 'reload';
	if (!facts.online || errors.some((error) => OFFLINE.test(text(error)))) return 'offline';
	if (!deniedDeep(facts.error)) return 'code';
	if (facts.rules === 'fresh') return 'code';
	if (facts.rules === 'stale') return facts.deployed ? 'mismatch' : 'rules';
	// Відмова була, а звірити правила не вдалося: база щойно відповідала й замовкла.
	return 'offline';
}

/**
 * Кілька верхніх кадрів стеку — для журналу, лише коли причина `code`: там стек і
 * показує, котрий рядок нашого коду. У відмови бази стек — нутрощі SDK, шум.
 *
 * Кадри, а не «рядки після першого»: у Chromium перший рядок стеку — текст помилки, а у
 * Firefox і Safari його там немає, і зріз `slice(1)` губив би саме верхній кадр.
 */
export function shortStack(error: unknown, frames = 4): string | undefined {
	if (!(error instanceof Error) || !error.stack) return undefined;
	const top = error.stack
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => /^at\s|@/.test(line))
		.slice(0, frames);
	return top.length > 0 ? top.join(' | ') : undefined;
}
