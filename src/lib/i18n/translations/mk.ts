import { ui } from './mk/ui';
import { population } from './mk/population';
import { myths } from './mk/myths';
import { animals } from './mk/animals';
import { family } from './mk/family';
import { habitat } from './mk/habitat';
import { feeding } from './mk/feeding';

export const mk = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
