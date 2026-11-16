import { ui } from './it/ui';
import { population } from './it/population';
import { myths } from './it/myths';
import { animals } from './it/animals';
import { family } from './it/family';
import { habitat } from './it/habitat';
import { feeding } from './it/feeding';

export const it = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
