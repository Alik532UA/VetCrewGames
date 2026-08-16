/**
 * Заглушка `$app/paths` для Vitest (аліас у `vitest.config.ts`).
 *
 * Мок мусить містити **всі** поля, які читає тестований модуль: відсутнє дає
 * `undefined`, і код мовчки йде іншою гілкою або падає посеред прогону
 * (CODE-QUALITY-v8 § 3.2). Саме так і сталося, коли активи перевели на
 * `asset()`: чотири файли тестів упали з «asset is not a function» ще до
 * першої перевірки.
 */
export const base = '';
export const assets = '';

/** У проєкті `paths.assets` не заданий, тож активи — це просто `base + шлях`. */
export function asset(file: string): string {
	return `${base}${file}`;
}

/**
 * Спрощений `resolve()`: підставляє параметри в ID маршруту й нормалізує
 * кінцевий слеш під `trailingSlash: 'always'`.
 *
 * Опційний сегмент без значення зникає разом зі своїм слешем — саме так
 * поводиться справжній `resolve()` для `/[[lang=lang]]` без мови.
 */
export function resolve(routeId: string, params: Record<string, string | undefined> = {}): string {
	const path = routeId
		.replace(/\[\[(\w+)(?:=\w+)?\]\]|\[(\w+)\]/g, (_, optional, required) => {
			const name = optional ?? required;
			return params[name] ?? '';
		})
		.replace(/\/{2,}/g, '/');

	const trimmed = path.replace(/\/$/, '');
	return `${base}${trimmed === '' ? '/' : `${trimmed}/`}`;
}
