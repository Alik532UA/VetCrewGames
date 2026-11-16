import { ui } from './sk/ui';
import { population } from './sk/population';
import { myths } from './sk/myths';
import { animals } from './sk/animals';
import { family } from './sk/family';
import { habitat } from './sk/habitat';
import { feeding } from './sk/feeding';

export const sk = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
