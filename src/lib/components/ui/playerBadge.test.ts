// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ПОЗНАЧКИ БІЛЯ ІМЕНІ — ПІЛЮЛІ, А НЕ ТЕКСТ У ДУЖКАХ.
 *
 * ## Що це стереже
 *
 * Скарга автора: «мітка (ви) (немає зʼязку) — актуальний результат: звичайна
 * текстова; очікуваний: стильна графічна», зі взірцем із сусіднього `MindStep`.
 * І друга, про той самий рядок: «кожен гравець в окремому графічному контейнері
 * (і Ходів теж), щоб візуально виглядало окремо».
 *
 * Обидва дефекти повертаються ОДНАКОВО легко й однаково непомітно: хтось
 * дописує третю позначку звичайним `<span>({t(...)})</span>` — і вона виглядає
 * правильною сама по собі, поки не стане поруч із пілюлею. Або згортає табло
 * назад в одну панель, бо «так менше рядків CSS».
 *
 * ## Чому по джерелах
 *
 * Вигляд перевіряється оком, і він перевірений: знімки табла в двох темах, у
 * стані «онлайн» і «немає звʼязку». Тут — інваріанти, які око НЕ ловить:
 * скільком місцям належить один і той самий вигляд і чи не зрослися плитки
 * назад.
 *
 * Зворотні експерименти (AI-AGENT-PITFALLS-v8 § 1.1) — три, кожен червонив рівно
 * свій пункт: дописано другу пілюлю власними правилами в `OnlineRoom`;
 * повернуто `text-panel` на `.board__score`; `.board__who` переведено на
 * `inline-flex`, тобто рядкового потоку знову немає. Усі три зроблені.
 */

const BADGE = 'src/lib/components/ui/PlayerBadge.svelte';
const YOU = 'src/lib/components/ui/YouTag.svelte';
const ROOM = 'src/lib/components/pairs/OnlineRoom.svelte';

const read = (path: string) => readFileSync(path, 'utf8');

/** Коментар може цитувати те, чого в коді немає, — знімаємо перед пошуком. */
const code = (path: string) =>
	read(path)
		.replace(/\/\*[\s\S]*?\*\//g, ' ')
		.replace(/<!--[\s\S]*?-->/g, ' ')
		.replace(/(^|[^:])\/\/.*/g, '$1 ');

function svelteFiles(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) svelteFiles(full, out);
		else if (entry.endsWith('.svelte')) out.push(full.split(String.fromCharCode(92)).join('/'));
	}
	return out;
}

describe('позначки гравця', () => {
	it('перевірка жива: пілюля існує і має два тони', () => {
		const badge = code(BADGE);
		expect(badge).toMatch(/tone: 'me' \| 'away'/);
		expect(badge, 'нейтральний тон').toContain('.badge--me');
		expect(badge, 'тон попередження').toContain('.badge--away');
	});

	it('позначка лишається СЛОВОМ, а не самим лише кольором', () => {
		/*
		 * WCAG 1.4.1: колір і форма не бувають єдиним носієм. Пілюля — підсилення,
		 * і текст усередині обовʼязковий, тож `children` тут не для гнучкості.
		 */
		expect(code(BADGE)).toMatch(/children: Snippet/);
		expect(code(YOU), 'позначка «це ви» без тексту').toContain("t('pairs.you')");
		expect(code(ROOM), 'позначка «немає звʼязку» без тексту').toContain("t('pairs.away')");
	});

	it('вигляд пілюлі живе в ОДНОМУ місці', () => {
		/*
		 * Друга копія того самого вигляду розійшлася б із першою на першій же
		 * правці, і розійшлася б непомітно. Тому клас `badge` оголошує рівно один
		 * файл, а всі, кому потрібна позначка, беруть компонент.
		 */
		const owners = svelteFiles('src').filter((file) => /^\t*\.badge[-\s{]/m.test(code(file)));
		expect(owners, 'правила пілюлі оголошено більш ніж в одному файлі').toEqual([BADGE]);
	});

	it('табло — не спільна панель: у кожного блоку своя', () => {
		/*
		 * Прохання автора дослівно. Доти всі троє лежали в одній панелі, і рядок
		 * читався як одне речення: де закінчується один гравець і починається
		 * другий, доводилося визначати по двокрапках.
		 */
		const room = code(ROOM);
		expect(room, 'табло знову спільна панель').not.toMatch(/class="board__score text-panel"/);
		expect(room, 'у гравця немає своєї плитки').toMatch(/class="board__player text-panel/);
		expect(room, 'у рахунку ходів немає своєї плитки').toMatch(/class="board__moves text-panel"/);
	});

	it('двокрапка не відʼїжджає від позначки', () => {
		/*
		 * `.board__player` — це `inline-flex` із проміжком (прапор і аватар інакше
		 * злітають на базову лінію), а проміжок стосується КОЖНОЇ дитини. Без
		 * рядкового потоку навколо імені виходило «Дикий Манул ВИ : 0».
		 */
		expect(code(ROOM), 'імʼя, позначка й рахунок не в одному потоці').toMatch(/class="board__who"/);
		expect(code(ROOM)).toMatch(/\.board__who\s*\{[^}]*display:\s*inline;/);
	});
});
