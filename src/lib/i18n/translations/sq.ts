import { ui } from './sq/ui';
import { population } from './sq/population';
import { myths } from './sq/myths';
import { animals } from './sq/animals';
import { family } from './sq/family';
import { habitat } from './sq/habitat';
import { feeding } from './sq/feeding';

export const sq = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
