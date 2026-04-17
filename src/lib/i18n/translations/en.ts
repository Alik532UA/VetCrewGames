import { ui } from './en/ui';
import { population } from './en/population';
import { myths } from './en/myths';
import { animals } from './en/animals';

export const en = {
	...ui,
	...population,
	...myths,
	...animals
} as const;
