import { ui } from './cs/ui';
import { population } from './cs/population';
import { myths } from './cs/myths';
import { animals } from './cs/animals';
import { family } from './cs/family';
import { habitat } from './cs/habitat';
import { feeding } from './cs/feeding';

export const cs = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
