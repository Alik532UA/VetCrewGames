import type { ScrollbarMode } from '$lib/services/settings.svelte';
import type { TranslationKey } from '$lib/i18n/translations/uk';

/**
 * Перелік режимів смуги — один на всі місця, де їх показують (SCROLLBAR-v8 § 2.2).
 *
 * Зараз місце одне — контекстне меню самої смуги, — але саме з двох копій цей
 * список і псується: третій режим додають в одному місці й забувають в іншому.
 *
 * Порядок — від звичного до власного. Підписи задано каноном (§ 2.2.1), щоб
 * два сайти на цьому пакеті називали одне й те саме однаково: «Авторська», а
 * не «власна» чи «кастомна» — для відвідувача це не технічна характеристика,
 * а те, що смугу намалював автор сайту.
 */
export const SCROLLBAR_MODES: readonly { id: ScrollbarMode; key: TranslationKey }[] = [
	{ id: 'standard', key: 'scrollbar.standard' },
	{ id: 'custom', key: 'scrollbar.custom' }
];
