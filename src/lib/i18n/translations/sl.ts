import { ui } from './sl/ui';
import { population } from './sl/population';
import { myths } from './sl/myths';
import { animals } from './sl/animals';
import { family } from './sl/family';
import { habitat } from './sl/habitat';
import { feeding } from './sl/feeding';

export const sl = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
