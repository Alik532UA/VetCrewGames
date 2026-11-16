import { ui } from './fi/ui';
import { population } from './fi/population';
import { myths } from './fi/myths';
import { animals } from './fi/animals';
import { family } from './fi/family';
import { habitat } from './fi/habitat';
import { feeding } from './fi/feeding';

export const fi = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
