import { ui } from './lt/ui';
import { population } from './lt/population';
import { myths } from './lt/myths';
import { animals } from './lt/animals';
import { family } from './lt/family';
import { habitat } from './lt/habitat';
import { feeding } from './lt/feeding';

export const lt = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
