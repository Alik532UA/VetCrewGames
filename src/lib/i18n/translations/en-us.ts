import { ui } from './en-us/ui';
import { population } from './en-us/population';
import { myths } from './en-us/myths';
import { animals } from './en-us/animals';
import { family } from './en-us/family';
import { habitat } from './en-us/habitat';
import { feeding } from './en-us/feeding';

export const enUS = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
