import { ui } from './pl/ui';
import { population } from './pl/population';
import { myths } from './pl/myths';
import { animals } from './pl/animals';
import { family } from './pl/family';
import { habitat } from './pl/habitat';
import { feeding } from './pl/feeding';

export const pl = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
