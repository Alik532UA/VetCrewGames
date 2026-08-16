import { ui } from './nl/ui';
import { population } from './nl/population';
import { myths } from './nl/myths';
import { animals } from './nl/animals';
import { family } from './nl/family';
import { habitat } from './nl/habitat';
import { feeding } from './nl/feeding';
import { reserve } from './nl/reserve';

export const nl = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding,
	...reserve
} as const;
