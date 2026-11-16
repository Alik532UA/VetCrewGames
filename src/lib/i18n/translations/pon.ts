import { ui } from './pon/ui';
import { population } from './pon/population';
import { myths } from './pon/myths';
import { animals } from './pon/animals';
import { family } from './pon/family';
import { habitat } from './pon/habitat';
import { feeding } from './pon/feeding';

export const pon = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
