import { ui } from './ca/ui';
import { population } from './ca/population';
import { myths } from './ca/myths';
import { animals } from './ca/animals';
import { family } from './ca/family';
import { habitat } from './ca/habitat';
import { feeding } from './ca/feeding';

export const ca = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
