import { ui } from './en/ui';
import { population } from './en/population';
import { myths } from './en/myths';
import { animals } from './en/animals';
import { family } from './en/family';

export const en = {
	...ui,
	...population,
	...myths,
	...animals,
	...family
} as const;
