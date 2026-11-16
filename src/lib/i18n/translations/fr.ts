import { ui } from './fr/ui';
import { population } from './fr/population';
import { myths } from './fr/myths';
import { animals } from './fr/animals';
import { family } from './fr/family';
import { habitat } from './fr/habitat';
import { feeding } from './fr/feeding';

export const fr = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
