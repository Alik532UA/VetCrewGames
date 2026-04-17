import { ui } from './uk/ui';
import { population } from './uk/population';
import { myths } from './uk/myths';
import { animals } from './uk/animals';

export const uk = {
	...ui,
	...population,
	...myths,
	...animals
} as const;

export type TranslationKey = keyof typeof uk;
