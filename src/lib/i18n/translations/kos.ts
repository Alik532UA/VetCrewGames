import { ui } from './kos/ui';
import { population } from './kos/population';
import { myths } from './kos/myths';
import { animals } from './kos/animals';
import { family } from './kos/family';
import { habitat } from './kos/habitat';
import { feeding } from './kos/feeding';

export const kos = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
