import { ui } from './ja/ui';
import { population } from './ja/population';
import { myths } from './ja/myths';
import { animals } from './ja/animals';
import { family } from './ja/family';
import { habitat } from './ja/habitat';
import { feeding } from './ja/feeding';

export const ja = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
