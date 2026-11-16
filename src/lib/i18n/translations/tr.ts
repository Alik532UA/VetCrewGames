import { ui } from './tr/ui';
import { population } from './tr/population';
import { myths } from './tr/myths';
import { animals } from './tr/animals';
import { family } from './tr/family';
import { habitat } from './tr/habitat';
import { feeding } from './tr/feeding';

export const tr = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
