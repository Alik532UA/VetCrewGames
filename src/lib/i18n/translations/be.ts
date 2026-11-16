import { ui } from './be/ui';
import { population } from './be/population';
import { myths } from './be/myths';
import { animals } from './be/animals';
import { family } from './be/family';
import { habitat } from './be/habitat';
import { feeding } from './be/feeding';

export const be = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
