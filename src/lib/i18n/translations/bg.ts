import { ui } from './bg/ui';
import { population } from './bg/population';
import { myths } from './bg/myths';
import { animals } from './bg/animals';
import { family } from './bg/family';
import { habitat } from './bg/habitat';
import { feeding } from './bg/feeding';

export const bg = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
