import { ui } from './en/ui';
import { population } from './en/population';
import { myths } from './en/myths';
import { animals } from './en/animals';
import { family } from './en/family';
import { habitat } from './en/habitat';
import { feeding } from './en/feeding';
import { reserve } from './en/reserve';

export const en = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding,
	...reserve
} as const;
