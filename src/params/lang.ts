import type { ParamMatcher } from '@sveltejs/kit';
import { PREFIXED_LANGUAGES } from '$lib/i18n/routing';

/**
 * Матчер мовного сегмента (SVELTEKIT-DATA-v8 § 2.2, I18N-v8 § 3.2).
 *
 * Без нього опційний `[[lang]]` проковтнув би будь-який маршрут першого
 * рівня: `/game-population/` розібралося б як «мова game-population» і
 * показало б головну. Статичний маршрут виграє в динамічного, але
 * покладатися на це крихко — наступний доданий маршрут почне виглядати мовою.
 *
 * Заразом матчер дає безкоштовний 404 для невідомого значення замість
 * сторінки з неправильним вмістом.
 */
export const match: ParamMatcher = (param) =>
	(PREFIXED_LANGUAGES as readonly string[]).includes(param);
