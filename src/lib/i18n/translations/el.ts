import { ui } from './el/ui';
import { population } from './el/population';
import { myths } from './el/myths';
import { animals } from './el/animals';
import { family } from './el/family';
import { habitat } from './el/habitat';
import { feeding } from './el/feeding';

export const el = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
