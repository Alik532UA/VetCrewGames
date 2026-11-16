import { ui } from './cy/ui';
import { population } from './cy/population';
import { myths } from './cy/myths';
import { animals } from './cy/animals';
import { family } from './cy/family';
import { habitat } from './cy/habitat';
import { feeding } from './cy/feeding';

export const cy = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
