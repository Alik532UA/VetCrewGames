import { ui } from './da/ui';
import { population } from './da/population';
import { myths } from './da/myths';
import { animals } from './da/animals';
import { family } from './da/family';
import { habitat } from './da/habitat';
import { feeding } from './da/feeding';

export const da = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
