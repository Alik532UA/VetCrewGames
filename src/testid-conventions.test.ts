// @vitest-environment node
// Перевірка лише читає файли — DOM їй не потрібен, а jsdom стоїть не в кожному
// з проєктів. Закріплення середовища тут прибирає цю залежність.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Перевірка конвенцій data-testid за TESTID-AND-NAMING-v8.md § 1.9.1.
 *
 * Читає джерела, а не DOM, і тому бачить усі testid — включно з тими, що
 * всередині {#if}, модалок і гілок помилок, куди браузерна перевірка після
 * page.goto() не дістається ніколи. Це єдина з двох перевірок, що взагалі
 * здатна валідувати суфікси; рантайм-дублікати ловить Playwright-інваріант.
 */

const CANON = new Set([
	// інтерактивні
	"btn", "link", "input", "textarea", "checkbox", "radio", "select", "toggle", "slider", "option",
	// форми
	"form", "fieldset", "label", "error", "hint",
	// оверлеї
	"modal", "drawer", "backdrop", "overlay", "tooltip", "toast",
	// структура
	"card", "list", "item", "row", "cell", "tabs", "tab", "panel",
	"section", "header", "footer", "nav", "banner", "menu", "toolbar", "container",
	// медіа
	"icon", "img",
	// read-only контент
	"title", "text", "message", "warning", "value", "count", "status",
	"badge", "progress", "spinner", "skeleton"
]);

/**
 * Заборонено в позиції типу — тобто останнім статичним сегментом.
 *
 * Саме в позиції, а не будь-де: ці слова цілком легітимні як частина назви
 * фічі. `block-mode-toggle` у грі — це режим блокування ходів, а не «блок»;
 * `rich-text-editor` — назва редактора. Заборона в будь-якій позиції зробила б
 * перевірку такою, що бореться з предметною областю.
 */
const BANNED_AS_TYPE: Record<string, string> = {
	wrapper: "container",
	wrap: "container",
	box: "container",
	root: "container",
	block: "section",
	area: "section",
	group: "fieldset | toolbar | section",
	content: "panel",
	grid: "list",
	widget: "card | panel | section",
	display: "value",
	switcher: "select | toggle | tabs",
	trigger: "btn",
	help: "hint",
	dialog: "modal",
	popup: "modal",
	step: "item",
	dot: "item | badge",
	subtab: "tab"
};

/**
 * Заборонено в будь-якій позиції: щойно в проєкті співіснують `-btn` і
 * `-button`, кожен локатор стає здогадкою про те, який з двох обрав автор.
 */
const BANNED_ANYWHERE: Record<string, string> = { button: "btn", buttons: "btn | toolbar" };

/**
 * Легасі-id, що чекають на міграцію (§ 1.10). Список тільки скорочується.
 * Порожній = міграцію завершено.
 */
const LEGACY_ALLOWED = new Set<string>([]);

/**
 * Свідомі повтори в межах одного файлу: той самий елемент у взаємовиключних
 * гілках `{#if}/{:else}`, коли тесту потрібен один локатор незалежно від гілки
 * (той самий підсумковий рахунок у компактному й звичайному режимі).
 *
 * Не плутати з реальним дублікатом, коли обидва елементи в DOM одночасно —
 * такий треба розводити, а не вносити сюди. Список видно в кожному diff.
 */
const ALLOWED_DUPLICATES = new Set<string>([]);

/**
 * Чим замінюємо `{…}` та `${…}` перед розбором. Саме літера, а не порожній
 * рядок: інакше `news-card-${id}` перетворюється на `news-card-`, і перевірка
 * kebab-case падає на висячому дефісі, якого в коді немає.
 */
const DYNAMIC = "x";

function svelteFiles(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			if (["node_modules", ".svelte-kit", "build"].includes(entry)) continue;
			svelteFiles(full, out);
		} else if (entry.endsWith(".svelte")) out.push(full);
	}
	return out;
}

/**
 * Прибирає те, що не є розміткою: `<style>` (там testid трапляється в
 * селекторах `:global([data-testid="…"])`) і HTML-коментарі (там лишаються
 * старі назви та пояснення). Без цього перевірка рахує їх за окремі елементи
 * і повідомляє про дублікати, яких у DOM немає.
 */
const markupOnly = (text: string) =>
	text.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<!--[\s\S]*?-->/g, "");

function collect(): { id: string; file: string }[] {
	const found: { id: string; file: string }[] = [];
	for (const file of svelteFiles("src")) {
		const text = markupOnly(readFileSync(file, "utf8"));
		const re = /data-testid=(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\}|\{'([^']*)'\})/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(text))) {
			found.push({ id: m[1] ?? m[2] ?? m[3] ?? m[4], file: file.replace(/\\/g, "/") });
		}
	}
	return found;
}

/**
 * Динаміку замінюємо на `-x-`, а не просто на `x`: вставка трапляється без
 * дефіса (`…-all-link{suffix}`), і без штучної межі тип злипався б із нею в
 * один сегмент `linkx`, якого в каноні немає — перевірка сварилась би на
 * цілком правильний id.
 */
const segmentsOf = (id: string) =>
	id.replace(/\$?\{[^}]*\}/g, `-${DYNAMIC}-`).split("-").filter(Boolean);

/** Останній сегмент, що не є динамічним чи числовим дискримінатором. */
function typeSegment(id: string): string {
	const segs = segmentsOf(id);
	while (segs.length && (segs.at(-1) === DYNAMIC || /^\d+$/.test(segs.at(-1) as string))) segs.pop();
	return segs.at(-1) ?? "";
}

describe("data-testid conventions (v8)", () => {
	const all = collect();
	const checked = all.filter(({ id }) => !LEGACY_ALLOWED.has(id));

	it("знаходить testid у джерелах — сама перевірка жива", () => {
		expect(all.length).toBeGreaterThan(0);
	});

	it("не вживає заборонених слів у позиції типу (§ 1.4)", () => {
		const bad = checked
			.filter(({ id }) => typeSegment(id) in BANNED_AS_TYPE)
			.map(({ id, file }) => `${id}  (${file}) — «${typeSegment(id)}» → ${BANNED_AS_TYPE[typeSegment(id)]}`);
		expect(bad, `Заборонений тип:\n${bad.join("\n")}`).toEqual([]);
	});

	it("не змішує -btn і -button (§ 1.4)", () => {
		const bad = checked
			.filter(({ id }) => segmentsOf(id).some((s) => s in BANNED_ANYWHERE))
			.map(({ id, file }) => `${id}  (${file}) — «button» → btn`);
		expect(bad, `Заборонене слово в будь-якій позиції:\n${bad.join("\n")}`).toEqual([]);
	});

	it("кожен testid має канонічний тип (§ 1.3)", () => {
		const bad = checked
			.filter(({ id }) => !segmentsOf(id).some((s) => CANON.has(s)))
			.map(({ id, file }) => `${id}  (${file})`);
		expect(bad, `Без канонічного типу:\n${bad.join("\n")}`).toEqual([]);
	});

	/**
	 * Тип має відповідати HTML-семантиці, а не візуальному враженню (§ 1.3).
	 *
	 * Перевіряється саме `label`, бо це єдиний тип, чию правильність видно з
	 * розмітки однозначно: `-label` означає підпис поля, тобто елемент
	 * `<label>`. Канонічна перевірка § 1.9.1 цього не бачить — `label` є в
	 * CANON, тому `hero-title-label` на `<h1>` формально проходить.
	 *
	 * Решту типів так перевіряти не можна: `-btn` законно стоїть на
	 * `<a role="button">`, `-card` на `<article>`, `-value` на будь-чому. Тому
	 * одне правило, а не таблиця відповідностей.
	 */
	it("тип -label стоїть лише на елементі <label> (§ 1.3)", () => {
		const bad: string[] = [];
		for (const file of svelteFiles("src")) {
			const text = markupOnly(readFileSync(file, "utf8"));
			// Тег і його атрибути до `data-testid`; `[^>]*?` не перетинає межу тегу.
			const re = /<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?data-testid=(?:"([^"]*)"|\{`([^`]*)`\})/g;
			let m: RegExpExecArray | null;
			while ((m = re.exec(text))) {
				const tag = m[1].toLowerCase();
				const id = m[2] ?? m[3];
				if (typeSegment(id) === "label" && tag !== "label") {
					bad.push(`${id}  (<${tag}> у ${file.replace(/\\/g, "/")}) — тип за змістом: -title / -text / -message / -status / -value`);
				}
			}
		}
		expect(bad, `Тип -label не на <label>:\n${bad.join("\n")}`).toEqual([]);
	});

	it("тільки kebab-case ASCII (§ 1.2)", () => {
		const bad = all
			.filter(({ id }) => /[A-Z]|[Ѐ-ӿ]|--|^-|-$/.test(id.replace(/\$?\{[^}]*\}/g, DYNAMIC)))
			.map(({ id, file }) => `${id}  (${file})`);
		expect(bad, `Порушення kebab-case:\n${bad.join("\n")}`).toEqual([]);
	});

	it("немає недетермінованих id (§ 1.6)", () => {
		const bad = all
			.filter(({ id }) => /randomUUID|Math\.random|Date\.now/.test(id))
			.map(({ id, file }) => `${id}  (${file})`);
		expect(bad, `Недетерміновані id:\n${bad.join("\n")}`).toEqual([]);
	});

	it("немає дублікатів у межах одного компонента (§ анти-патерн HIGH)", () => {
		const byFile = new Map<string, string[]>();
		// Динамічні id пропускаємо: той самий шаблон у двох циклах дає різні
		// значення в DOM, тому це не колізія. Статичний id, повторений у файлі,
		// колізія завжди — компонент рендериться цілком.
		for (const { id, file } of all) {
			if (id.includes("{") || ALLOWED_DUPLICATES.has(id)) continue;
			byFile.set(file, [...(byFile.get(file) ?? []), id]);
		}

		const dupes: string[] = [];
		for (const [file, ids] of byFile) {
			const seen = new Set<string>();
			for (const id of ids) {
				if (seen.has(id)) dupes.push(`${id}  (${file})`);
				seen.add(id);
			}
		}
		expect(dupes, `Дублікати в одному файлі:\n${dupes.join("\n")}`).toEqual([]);
	});
});
