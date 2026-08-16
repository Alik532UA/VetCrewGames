// @vitest-environment node
// Перевірка читає файли стилів — DOM їй не потрібен.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { THEME_OPTIONS } from './themes';

/**
 * У теми зі списку мусить бути ЧИМ бути темою.
 *
 * Решту про повноту тут уже забезпечує не перевірка, а будова: `Theme`
 * виводиться з того самого масиву, з якого будується меню, тож тему не можна
 * завести повз список; значки лежать у `Record<Theme, …>`, тож тема без значка
 * — помилка збірки (перевірено зворотним експериментом). Підпис теж стереже
 * тип: `labelKey` звужений до `TranslationKey`.
 *
 * А от стилі нічим не стережуться. Тема без свого блоку `[data-theme='…']`
 * цілком «працює»: атрибут ляже на `<html>`, у сховище запишеться, пункт у меню
 * буде — а кольори лишаться ті, що були. Це не поламана сторінка, це сторінка,
 * яка мовчки не послухалася.
 */
const THEMES_DIR = 'src/lib/styles/themes';
const GLOBAL = 'src/lib/styles/global.css';

/** Теми, для яких десь у стилях є свій блок оголошень. */
function themesWithTokens(): Set<string> {
	const files = readdirSync(THEMES_DIR).map((file) => `${THEMES_DIR}/${file}`);
	const found = new Set<string>();
	for (const file of files) {
		for (const [, id] of readFileSync(file, 'utf8').matchAll(/\[data-theme='([^']+)'\]/g)) {
			found.add(id);
		}
	}
	return found;
}

describe('теми мають стилі', () => {
	it('перевірка жива: файли тем знайдено', () => {
		expect(themesWithTokens().size).toBeGreaterThan(1);
	});

	it('у кожної теми зі списку є свій набір токенів', () => {
		const styled = themesWithTokens();
		const bare = THEME_OPTIONS.map((option) => option.id).filter((id) => !styled.has(id));
		expect(
			bare,
			`тема є в меню й у сховищі, але кольорів для неї немає — вибір нічого не змінить: ${bare.join(', ')}`
		).toEqual([]);
	});

	it('кожен файл теми підключено до global.css', () => {
		const global = readFileSync(GLOBAL, 'utf8');
		const unlinked = readdirSync(THEMES_DIR).filter(
			(file) => !global.includes(`@import './themes/${file}'`)
		);
		expect(
			unlinked,
			`файл теми є, а в збірку не потрапляє — токени просто не існують: ${unlinked.join(', ')}`
		).toEqual([]);
	});

	it('немає файлу теми, якої вже немає в списку', () => {
		const known = new Set<string>(THEME_OPTIONS.map((option) => option.id));
		const orphans = [...themesWithTokens()].filter((id) => !known.has(id));
		expect(orphans, `стилі є, а теми немає — мертвий файл: ${orphans.join(', ')}`).toEqual([]);
	});
});
