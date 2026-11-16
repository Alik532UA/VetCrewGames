import { ui } from './ga/ui';
import { population } from './ga/population';
import { myths } from './ga/myths';
import { animals } from './ga/animals';
import { family } from './ga/family';
import { habitat } from './ga/habitat';
import { feeding } from './ga/feeding';

export const ga = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
