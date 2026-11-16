import { ui } from './hr/ui';
import { population } from './hr/population';
import { myths } from './hr/myths';
import { animals } from './hr/animals';
import { family } from './hr/family';
import { habitat } from './hr/habitat';
import { feeding } from './hr/feeding';

export const hr = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
