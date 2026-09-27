// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * КОМПОНЕНТ, ВИБРАНИЙ ПІД ЧАС ВИКОНАННЯ, НЕ ГІДРУЄТЬСЯ ПОВЕРХ ЧУЖОГО ПРЕРЕНДЕРА.
 *
 * ## Що це стереже
 *
 * Двічі той самий дефект: значок теми (2026-09-13) і плитка аватарки (2026-09-27) після
 * перезавантаження малювали СУМІШ двох значків. Пререндер кладе в HTML значок типового
 * стану, клієнт зі сховища хоче інший, а Svelte 5 під час гідрації не звіряє, ЯКИЙ
 * компонент лежить у розмітці: `<Icon />` зі змінною замість імені гідрується поверх
 * чужих вузлів (механізм — у `ui/DynamicIcon.svelte`). Те саме робить `svelte:element`.
 * Першого разу виправлено одну кнопку, і наступне місце про це не знало.
 *
 * Тому правило одне на весь проєкт: тег, ім'я якого — НЕ статичний імпорт, стоїть лише в
 * `DynamicIcon` (він перестворює значок після гідрації) або в `LAZY` — там, де компонента
 * під час гідрації не існує взагалі, бо він приходить `import()`-ом. Решта — червоне.
 *
 * ## Чого це НЕ бачить
 *
 * Статичний імпорт змінного обʼєкта (`import { box } …` і `<box.icon />`) — для нього
 * корінь імені імпортований, і сканер вважає тег статичним. Такого в проєкті немає; сам
 * дефект, хоч би звідки він прийшов, ловить e2e `tests/icon-hydration.spec.ts`, що звіряє
 * кожен намальований значок з його `iconNode`.
 *
 * Зворотні експерименти описані біля тестів, яких вони стосуються.
 */

const DYNAMIC_ICON = 'src/lib/components/ui/DynamicIcon.svelte';
const HYDRATION = 'src/lib/services/hydration.svelte.ts';
const LAYOUT = 'src/routes/+layout.svelte';

/**
 * Компоненти, яких під час гідрації НЕМАЄ: вони приходять `import()`-ом і малюються лише
 * після нього. Для кожного — рядок, що це доводить, і він мусить стояти у файлі.
 */
const LAZY: Record<string, { name: string; guard: RegExp; why: string }> = {
	'src/lib/components/reserve/ReserveStage.svelte': {
		name: 'Scene',
		guard: /\{#if Scene\b/,
		why: '`three` приїжджає в `onMount`, і до того `Scene === null`'
	},
	'src/lib/components/Toast.svelte': {
		name: 'ToastReport',
		guard: /\{#await import\('\.\/ToastReport\.svelte'\) then \{ default: ToastReport \}\}/,
		why: 'гілка `then` існує лише після того, як шматок доїхав'
	}
};

const walk = (dir: string, keep = (path: string) => path.endsWith('.svelte')): string[] =>
	readdirSync(dir).flatMap((name) => {
		const path = join(dir, name).split('\\').join('/');
		if (statSync(path).isDirectory()) return walk(path, keep);
		return keep(path) ? [path] : [];
	});

/** Імена, що прийшли статичним імпортом: типовим, іменованим чи `* as`. */
function importedNames(source: string): Set<string> {
	const scripts = [...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
	const names = new Set<string>();
	for (const [, clause] of scripts
		.join('\n')
		.matchAll(/import\s+(?:type\s+)?([\s\S]*?)\s+from\s+['"][^'"]+['"]/g)) {
		const head = clause.match(/^([A-Za-z_$][\w$]*)/);
		if (head) names.add(head[1]);
		const namespace = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
		if (namespace) names.add(namespace[1]);
		for (const part of clause.match(/\{([\s\S]*?)\}/)?.[1].split(',') ?? []) {
			const local = part
				.trim()
				.split(/\s+as\s+/)
				.pop()
				?.replace(/^type\s+/, '');
			if (local) names.add(local);
		}
	}
	return names;
}

/** Теги з іменем, вибраним під час виконання, — у розмітці без скриптів, стилів і коментарів. */
export function runtimeTags(source: string): string[] {
	const imported = importedNames(source);
	const markup = source
		.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '')
		.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '')
		.replace(/<!--[\s\S]*?-->/g, '');
	const found = new Set<string>();
	for (const [, tag] of markup.matchAll(/<([A-Z][\w$]*|[a-z_$][\w$]*(?:\.[\w$]+)+)[\s/>]/g)) {
		if (!imported.has(tag.split('.')[0])) found.add(tag);
	}
	for (const [tag] of markup.matchAll(/<svelte:(?:component|element)\b/g)) found.add(tag.slice(1));
	return [...found];
}

const read = (path: string) => readFileSync(path, 'utf8');

describe('гідрація: компонент, вибраний під час виконання', () => {
	/*
	 * Зворотний експеримент: повернути в `Avatar.svelte` рядок `<Icon size={glyph} … />` —
	 * червоне з назвою файлу й тегу. Так само з `{@const Icon = …}` у будь-якому переліку.
	 */
	it('стоїть лише в `DynamicIcon` або там, де його під час гідрації немає', () => {
		const offenders: string[] = [];
		for (const file of walk('src')) {
			const tags = runtimeTags(read(file));
			if (file === DYNAMIC_ICON) {
				expect(tags, 'DynamicIcon малює рівно один змінний тег — сам значок').toEqual(['Icon']);
				continue;
			}
			const lazy = LAZY[file];
			for (const tag of tags) {
				if (lazy && tag === lazy.name) continue;
				offenders.push(`${file}: <${tag}>`);
			}
		}
		expect(offenders, 'значок зі змінної — через `<DynamicIcon icon={…} />`').toEqual([]);
	});

	it('лінивий компонент справді малюється лише після `import()`', () => {
		for (const [file, lazy] of Object.entries(LAZY)) {
			expect(read(file), `${file}: ${lazy.why}`).toMatch(lazy.guard);
			expect(runtimeTags(read(file)), `${file}: у переліку зайвий рядок`).toContain(lazy.name);
		}
	});

	/*
	 * Зворотний експеримент — прибрати `{#key hydrated()}` (значок лишається, але вже не
	 * перестворюється): червоне тут, а e2e `icon-hydration` показує ту саму суміш у
	 * `pairs-avatar-toggle-btn`, що бачив автор. Прибрати `onMount(finishHydration)` з
	 * layout — червоне в наступному тесті. Обидва прогнано.
	 */
	it('`DynamicIcon` перестворює значок, щойно гідрацію скінчено', () => {
		expect(read(DYNAMIC_ICON)).toMatch(
			/\{#key hydrated\(\)\}\s*<Icon \{\.\.\.rest\} \/>\s*\{\/key\}/
		);
	});

	it('гідрацію закінчує кореневий layout — і лише він', () => {
		expect(read(LAYOUT)).toMatch(/onMount\(finishHydration\)/);
		const code = (path: string) => /\.(svelte|ts)$/.test(path) && !path.endsWith('.test.ts');
		const users = walk('src', code).filter((file) => /\bfinishHydration\b/.test(read(file)));
		expect(users.sort(), 'оголошує сервіс, кличе лише layout').toEqual([HYDRATION, LAYOUT].sort());
	});

	/*
	 * Сам сканер. Без цього «нуль знахідок» могло б означати «регулярка нічого не бачить» —
	 * саме так уже тихо мовчали гейти в цьому проєкті.
	 */
	it('сканер бачить змінний тег і не плутає його з імпортом чи коментарем', () => {
		const source = [
			'<script lang="ts">',
			"\timport { Sun } from 'lucide-svelte';",
			// Оголошений пакет, а не шлях: гейти залежностей і досяжності читають і рядки тестів.
			"\timport Row, { type Item } from 'svelte';",
			'</script>',
			'<!-- <Ghost /> -->',
			'{#each items as item}{@const Icon = item.icon}<Icon /><item.glyph size={2} />{/each}',
			'<Sun /><Row /><svelte:element this={tag} /><div class="Big"></div>'
		].join('\n');
		expect(runtimeTags(source).sort()).toEqual(['Icon', 'item.glyph', 'svelte:element']);
	});
});
