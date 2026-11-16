import { ui } from './no/ui';
import { population } from './no/population';
import { myths } from './no/myths';
import { animals } from './no/animals';
import { family } from './no/family';
import { habitat } from './no/habitat';
import { feeding } from './no/feeding';

export const no = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
