import { ui } from './mt/ui';
import { population } from './mt/population';
import { myths } from './mt/myths';
import { animals } from './mt/animals';
import { family } from './mt/family';
import { habitat } from './mt/habitat';
import { feeding } from './mt/feeding';

export const mt = {
	...ui,
	...population,
	...myths,
	...animals,
	...family,
	...habitat,
	...feeding
} as const;
