import { ui } from './lv/ui';
import { population } from './lv/population';
import { myths } from './lv/myths';
import { animals } from './lv/animals';
import { family } from './lv/family';
import { habitat } from './lv/habitat';
import { feeding } from './lv/feeding';

export const lv = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
