import { ui } from './ka/ui';
import { population } from './ka/population';
import { myths } from './ka/myths';
import { animals } from './ka/animals';
import { family } from './ka/family';
import { habitat } from './ka/habitat';
import { feeding } from './ka/feeding';

export const ka = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
