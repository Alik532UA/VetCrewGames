import { ui } from './sv/ui';
import { population } from './sv/population';
import { myths } from './sv/myths';
import { animals } from './sv/animals';
import { family } from './sv/family';
import { habitat } from './sv/habitat';
import { feeding } from './sv/feeding';

export const sv = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
