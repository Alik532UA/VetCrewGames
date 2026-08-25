import { ui } from './uk/ui';
import { population } from './uk/population';
import { myths } from './uk/myths';
import { animals } from './uk/animals';
import { family } from './uk/family';
import { habitat } from './uk/habitat';
import { feeding } from './uk/feeding';

export const uk = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;

/**
 * КЛЮЧІ ЗАПОВІДНИКА ЛИШАЮТЬСЯ В ТИПІ, хоч самі рядки поїхали в лінивий чанк.
 *
 * `import type` не тягне модуль у бандл — компілятор бачить форму об'єкта, а
 * збирач не кладе жодного байта. Саме це й потрібно: `t('reserve.title')` мусить
 * лишитися типобезпечним у двадцяти чотирьох компонентах заповідника, а 14,88 КБ
 * його рядків не мусять їхати кожному відвідувачеві (`i18n/reserve/index.ts`).
 */
import type { reserve } from '../reserve/uk';

/** Ключі, що приїжджають ліниво. Виключені з контракту повноти нижче. */
export type LazyTranslationKey = keyof typeof reserve;

export type TranslationKey = keyof typeof uk | LazyTranslationKey;
