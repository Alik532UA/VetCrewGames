import { ui } from './ro/ui';
import { population } from './ro/population';
import { myths } from './ro/myths';
import { animals } from './ro/animals';
import { family } from './ro/family';
import { habitat } from './ro/habitat';
import { feeding } from './ro/feeding';

export const ro = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
