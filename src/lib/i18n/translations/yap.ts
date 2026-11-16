import { ui } from './yap/ui';
import { population } from './yap/population';
import { myths } from './yap/myths';
import { animals } from './yap/animals';
import { family } from './yap/family';
import { habitat } from './yap/habitat';
import { feeding } from './yap/feeding';

export const yap = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
