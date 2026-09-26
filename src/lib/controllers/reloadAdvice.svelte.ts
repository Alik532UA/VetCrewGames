import { logService } from '$lib/services/logService.svelte';
import { chunkMissing } from '$lib/utils/staleBuild';

/**
 * ЧОМУ СТОРІНКУ ТРЕБА ОНОВИТИ — одне поле на обидві причини (аудит 2026-09-26).
 *
 * - `rules` — правила бази новіші за сторінку: звʼязок є, а ходи не проходять.
 * - `build` — на сервері вже інша збірка: частин застосунку, яких ця вкладка ще не
 *   завантажила, там більше немає (`utils/staleBuild.ts`).
 */
export type ReloadReason = 'rules' | 'build';

/** Не частіше за це звіряти правила, поки звірка каже «ті самі». */
export const RULES_RECHECK_MS = 60_000;

export class ReloadAdvice {
	reason = $state<ReloadReason | null>(null);
	#asking = false;
	#askedAt = -Infinity;

	constructor(
		readonly check: () => Promise<'fresh' | 'stale' | 'unknown'>,
		readonly clock: () => number = Date.now
	) {}

	/**
	 * БАЗА ВІДМОВИЛА БЕЗ ПОЯСНЕННЯ З БОКУ ГРИ — звірити штамп правил (`net/rulesLive.ts`).
	 *
	 * Не «раз на сторінку», як доти: звірка, що сказала «ті самі», витрачала єдину
	 * спробу на будь-який безневинний відкинутий хід (подвійний тап, друга вкладка),
	 * і справжня викладка правил пізніше лишалася без смуги. А звірка, що сама
	 * впала на відсутньому шматку збірки, давала «необроблену відмову промісу» й
	 * тишу — рівно в ту викладку, для якої її й писали (аудит 2026-09-26). Тепер —
	 * не частіше, ніж раз на `RULES_RECHECK_MS`, доки причину не знайдено.
	 */
	noteDenial(code: string): void {
		const now = this.clock();
		if (this.reason !== null || this.#asking || now - this.#askedAt < RULES_RECHECK_MS) return;
		this.#asking = true;
		this.#askedAt = now;
		this.check()
			.then((state) => {
				logService.warn('network', 'rules checked after denial', { code, state });
				if (state === 'stale') this.reason = 'rules';
			})
			.catch((error: unknown) => {
				if (!this.noteFailure(error)) {
					logService.warn('network', 'rules not checked', { code, reason: String(error) });
				}
			})
			.finally(() => (this.#asking = false));
	}

	/** Помилка, за якою може стояти застаріла збірка. `true` — це вона. */
	noteFailure(error: unknown): boolean {
		if (!chunkMissing(error)) return false;
		if (this.reason === null)
			logService.warn('app', 'stale build detected', { reason: String(error) });
		this.reason ??= 'build';
		return true;
	}
}
