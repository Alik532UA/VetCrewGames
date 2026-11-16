import { ui } from './is/ui';
import { population } from './is/population';
import { myths } from './is/myths';
import { animals } from './is/animals';
import { family } from './is/family';
import { habitat } from './is/habitat';
import { feeding } from './is/feeding';

export const is = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
