import { ui } from './de/ui';
import { population } from './de/population';
import { myths } from './de/myths';
import { animals } from './de/animals';
import { family } from './de/family';
import { habitat } from './de/habitat';
import { feeding } from './de/feeding';
import { reserve } from './de/reserve';

export const de = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding,
	...reserve
} as const;
