import { ui } from './crh/ui';
import { population } from './crh/population';
import { myths } from './crh/myths';
import { animals } from './crh/animals';
import { family } from './crh/family';
import { habitat } from './crh/habitat';
import { feeding } from './crh/feeding';

export const crh = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
