import { ui } from './pt/ui';
import { population } from './pt/population';
import { myths } from './pt/myths';
import { animals } from './pt/animals';
import { family } from './pt/family';
import { habitat } from './pt/habitat';
import { feeding } from './pt/feeding';

export const pt = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
