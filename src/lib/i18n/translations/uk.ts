import { ui } from './uk/ui';
import { population } from './uk/population';
import { myths } from './uk/myths';
import { animals } from './uk/animals';
import { family } from './uk/family';
import { habitat } from './uk/habitat';

export const uk = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat
} as const;

export type TranslationKey = keyof typeof uk;
