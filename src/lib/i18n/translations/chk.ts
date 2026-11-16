import { ui } from './chk/ui';
import { population } from './chk/population';
import { myths } from './chk/myths';
import { animals } from './chk/animals';
import { family } from './chk/family';
import { habitat } from './chk/habitat';
import { feeding } from './chk/feeding';

export const chk = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
