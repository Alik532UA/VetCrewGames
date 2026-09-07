// \vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Світла тема оголошує `only light` — і ніде не оголошує голе `light`.
 *
 * ## Що це стереже
 *
 * Android Chrome із темною темою САМОГО браузера має Auto Dark Theme: він
 * перемальовує в темні кольори кожну сторінку, яку вважає світлою й без
 * власної темної теми. Ознака, за якою він це вирішує, — використана схема
 * документа, і саме голе `color-scheme: light` її й оголошує. Відмова
 * називається `only`.
 *
 * Заміряно на пристрої в сусідньому `teatralo4ka.odesa.ua` 7 вересня 2026:
 * автор надіслав знімок, де світлі теми сайту перефарбовані до невпізнання, а
 * після заміни на `only light` перемальовування зникло на тому самому телефоні.
 * Правило — UI-UX-v9 `UIUX-ONLY-LIGHT`.
 *
 * ## Чому кілька джерел, а не одне
 *
 * Схему присвоюють у кількох місцях: таблиця стилів, мета-тег у розмітці,
 * скрипт першого кадру й контролер теми. У школі гейт дивився лише на
 * `app.html` і був ЗЕЛЕНИЙ увесь час, поки скрипт рядком нижче переписував
 * значення на `light`. Тому перевірка читає всі джерела, де схема може
 * зʼявитися.
 *
 * ## Зворотний експеримент
 *
 * Проведено: `only light` повернено до `light` — перевірка почервоніла й
 * назвала файл із номером рядка.
 */
const ДЖЕРЕЛА = ["src/lib/styles/global.css", "src/app.html", "src/lib/services/settings.svelte.ts"];

describe("color-scheme світлої теми", () => {
	it("перевірка жива: джерела прочитано й схема в них є", () => {
		const усе = ДЖЕРЕЛА.map((ф) => readFileSync(ф, "utf8")).join("|");
		expect(усе.length, "джерела порожні").toBeGreaterThan(100);
		expect(усе, "жодного оголошення color-scheme — стерегти нема чого").toContain(
			"color-scheme"
		);
	});

	it("ніде немає голого `light`: ні в CSS, ні в мета-тезі, ні в скрипті", () => {
		const bad: string[] = [];
		for (const ф of ДЖЕРЕЛА) {
			readFileSync(ф, "utf8")
				.split("\n")
				.forEach((рядок, i) => {
					// Рядок, що ПРИСВОЮЄ схему: властивість CSS або значення мета-тега.
					const присвоєння = /color-scheme\s*:|colorScheme\s*=|name="color-scheme"/.test(
						рядок
					);
					if (!присвоєння) return;
					if (/(:|=)\s*["']?\s*light\s*["']?\s*;?\s*$|content="light"/.test(рядок)) {
						bad.push(`${ф}:${i + 1} — ${рядок.trim()}`);
					}
				});
		}
		expect(bad, `Auto Dark Theme перемалює світлу тему:\n${bad.join("\n")}`).toEqual([]);
	});

	it("світла тема справді звужена до `only light`", () => {
		const css = readFileSync("src/lib/styles/global.css", "utf8");
		expect(css, "світла тема не оголошує `only light`").toContain("color-scheme: only light");
	});
});
