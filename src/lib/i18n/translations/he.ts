import { ui } from './he/ui';
import { population } from './he/population';
import { myths } from './he/myths';
import { animals } from './he/animals';
import { family } from './he/family';
import { habitat } from './he/habitat';
import { feeding } from './he/feeding';

export const he = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
