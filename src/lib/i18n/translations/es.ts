import { ui } from './es/ui';
import { population } from './es/population';
import { myths } from './es/myths';
import { animals } from './es/animals';
import { family } from './es/family';
import { habitat } from './es/habitat';
import { feeding } from './es/feeding';

export const es = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
