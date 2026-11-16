import { ui } from './et/ui';
import { population } from './et/population';
import { myths } from './et/myths';
import { animals } from './et/animals';
import { family } from './et/family';
import { habitat } from './et/habitat';
import { feeding } from './et/feeding';

export const et = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
