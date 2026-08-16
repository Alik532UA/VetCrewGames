import { ui } from './en/ui';
import { population } from './en/population';
import { myths } from './en/myths';
import { animals } from './en/animals';
import { family } from './en/family';
import { habitat } from './en/habitat';

export const en = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat
} as const;
