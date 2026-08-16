import { ui } from './uk/ui';
import { population } from './uk/population';
import { myths } from './uk/myths';
import { animals } from './uk/animals';
import { family } from './uk/family';

export const uk = {
	...ui,
	...population,
	...myths,
	...animals,
	...family
} as const;

export type TranslationKey = keyof typeof uk;
