import { ui } from './uk/ui';
import { population } from './uk/population';
import { myths } from './uk/myths';
import { animals } from './uk/animals';
import { family } from './uk/family';
import { habitat } from './uk/habitat';
import { feeding } from './uk/feeding';
import { reserve } from './uk/reserve';

export const uk = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding,
	...reserve
} as const;

export type TranslationKey = keyof typeof uk;
