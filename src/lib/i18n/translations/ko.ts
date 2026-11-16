import { ui } from './ko/ui';
import { population } from './ko/population';
import { myths } from './ko/myths';
import { animals } from './ko/animals';
import { family } from './ko/family';
import { habitat } from './ko/habitat';
import { feeding } from './ko/feeding';

export const ko = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
