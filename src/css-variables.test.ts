// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * A reference to a CSS variable that does not exist is the quietest class of
 * defect in the project (UI-UX-v8 § 4). It produces no build error, no
 * `svelte-check` warning and no failing test; the page renders, just
 * differently:
 *
 *  - `var(--x, #fff)` substitutes `#fff` — which looks right in the light theme
 *    and glows white in the dark one. The fallback is not insurance here, it is
 *    the way the mistake stays hidden from whoever made it;
 *  - `var(--x)` with no fallback makes the property INVALID at computed-value
 *    time. Not "a grey border instead of a blue one" but `border: 1px solid`
 *    with no colour, meaning no border at all.
 *
 * Ported from teatralo4ka, where the same check found 13 undeclared variables
 * across 120 references. Here it found five, and they told one story: the
 * styles were reading a token vocabulary that belongs to a different project.
 * This one names its tokens `--color-bg-surface`, `--color-text`,
 * `--color-border`, `--color-text-muted`; the five references asked for
 * `--bg-surface`, `--text-primary`, `--border-color`, `--text-muted` and
 * `--color-warning`.
 *
 * Every one carried a fallback, so nothing looked broken — and that is the
 * point. The log button was a fixed dark grey with a white icon in all FOUR
 * themes, including the two light ones; the version label a fixed #888; the
 * partial-answer segment a fixed #facc15. The theme files were doing nothing
 * for any of them.
 *
 * Reverse experiment (AI-AGENT-PITFALLS-v8 § 1.1): delete `--color-border` from the four
 * theme files — the check must go red listing every place that reads it. Done,
 * it fails.
 */

const ROOT = resolve(__dirname, '..');

/** Files that carry the GLOBAL declarations: themes and base styles. */
const GLOBAL_STYLE_FILES = [
	'src/lib/styles/global.css',
	'src/lib/styles/animations.css',
	'src/lib/styles/themes/dark.css',
	'src/lib/styles/themes/light-green.css',
	'src/lib/styles/themes/orange-purple.css',
	'src/lib/styles/themes/winter.css'
];

/**
 * Variables one file declares and another reads, through ordinary CSS
 * inheritance. That is a valid pattern, but it is also what could hide a real
 * slip, so each case is named rather than allowed as a class. A stale entry is
 * caught too: if the declaration disappears, the check fails on the list
 * itself.
 */
const ACCOUNT_PAGE = 'src/routes/[[lang=lang]]/account/+page.svelte';

/**
 * The account screen declares its own measures once and every panel inside it
 * reads them. Eight panels live there, each a component with its own scoped
 * CSS: the same numbers written into eight files would drift on the first edit.
 * The declaration sits on `.account-page`, so ordinary inheritance reaches all
 * of them — and nothing outside that page can read them by accident.
 */
const CROSS_COMPONENT: Record<string, { declaredIn: string; why: string }> = {
	'--account-card-radius': {
		declaredIn: ACCOUNT_PAGE,
		why: 'card corners for every panel of the account screen'
	},
	'--account-field-radius': {
		declaredIn: ACCOUNT_PAGE,
		why: 'input and button corners inside those panels'
	},
	'--account-control': {
		declaredIn: ACCOUNT_PAGE,
		why: 'height of inputs and buttons; PasswordInput and EmailField keep a fallback because they live in ui/ and auth/'
	},
	'--account-line': {
		declaredIn: ACCOUNT_PAGE,
		why: 'field border taken from the text colour, because --color-border equals the panel in two themes'
	},
	'--account-gap': { declaredIn: ACCOUNT_PAGE, why: 'gap between rows inside a panel' },
	'--account-pad': { declaredIn: ACCOUNT_PAGE, why: 'padding of a panel and of its controls' }
};

function walk(dir: string, keep: (name: string) => boolean, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full, keep, out);
		else if (keep(entry)) out.push(full.replace(/\\/g, '/'));
	}
	return out;
}

/**
 * Reads a file with comments stripped — the same discipline the sibling
 * invariants in this project already follow (`ci.test.ts`, `security.test.ts`,
 * `test-runners.test.ts`): a check that searches raw text finds its own
 * documentation and reports it as a defect.
 *
 * It was not hypothetical. `src/contrast.test.ts` documents its resolver with
 * "exactly one var() and nothing else: `var(--a)` or `var(--a, fallback)`", and
 * this check reported `--a` as an undeclared variable in a TypeScript file that
 * declares no styles at all.
 *
 * Line comments are only stripped when they START a line. A blanket `//` strip
 * would eat the rest of any line containing `https://` — including `url()` in a
 * `@font-face`, where the declarations this check needs actually live.
 */
const read = (p: string) =>
	readFileSync(p, 'utf8')
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/^\s*\/\/.*$/gm, '');

/** Declarations of the form `--name:` — in CSS, in a component `<style>`, in an inline `style`. */
function declarations(source: string): Set<string> {
	return new Set([...source.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
}

/**
 * Variables set at runtime rather than declared in CSS. Two forms, and both are
 * legitimate:
 *
 *  - `element.style.setProperty('--x', …)` — plain DOM;
 *  - `style:--x={value}` — the Svelte directive, which compiles to exactly that
 *    call. Left out of this list it reads as an undeclared variable, and the
 *    check reports the one place that is doing it properly.
 *
 * There is no CSS declaration for either, and there cannot be: the value
 * appears at runtime, and until then the fallback in `var()` is what applies —
 * which is why a fallback IS correct here, unlike in § 1.6.
 */
function runtimeDeclarations(source: string): Set<string> {
	return new Set([
		...[...source.matchAll(/setProperty\(\s*[`'"](--[\w-]+)/g)].map((m) => m[1]),
		...[...source.matchAll(/\bstyle:(--[\w-]+)/g)].map((m) => m[1])
	]);
}

describe('CSS variables', () => {
	const srcDir = join(ROOT, 'src');
	const sources = walk(
		srcDir,
		(n) => n.endsWith('.svelte') || n.endsWith('.ts') || n.endsWith('.html')
	);
	const globalCss = GLOBAL_STYLE_FILES.map((f) => read(join(ROOT, f)));

	const declaredGlobally = new Set<string>();
	for (const css of globalCss) for (const name of declarations(css)) declaredGlobally.add(name);

	const declaredAtRuntime = new Set<string>();
	for (const file of sources) {
		for (const name of runtimeDeclarations(read(file))) declaredAtRuntime.add(name);
	}

	const references = sources.flatMap((file) =>
		[...read(file).matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => ({ file, name: m[1] }))
	);

	it('finds sources, declarations and references — the check is alive', () => {
		expect(sources.length).toBeGreaterThan(20);
		expect(globalCss.length).toBe(GLOBAL_STYLE_FILES.length);
		expect(declaredGlobally.size).toBeGreaterThan(40);
		expect(references.length).toBeGreaterThan(200);
	});

	it('every cross-component variable is in fact declared somewhere', () => {
		const stale: string[] = [];
		for (const [name, { declaredIn }] of Object.entries(CROSS_COMPONENT)) {
			if (!declarations(read(join(ROOT, declaredIn))).has(name)) {
				stale.push(`${name}: no declaration in ${declaredIn} — the exemption is out of date`);
			}
		}
		expect(stale, stale.join('\n')).toEqual([]);
	});

	it('no references to undeclared CSS variables', () => {
		const own = new Map(sources.map((f) => [f, declarations(read(f))] as const));

		const problems = new Map<string, Set<string>>();
		for (const { file, name } of references) {
			if (declaredGlobally.has(name)) continue;
			if (declaredAtRuntime.has(name)) continue;
			if (own.get(file)!.has(name)) continue;
			if (name in CROSS_COMPONENT) continue;

			if (!problems.has(name)) problems.set(name, new Set());
			problems.get(name)!.add(file.replace(`${ROOT.replace(/\\/g, '/')}/`, ''));
		}

		const report = [...problems.entries()]
			.map(([name, files]) => `${name} — ${[...files].join(', ')}`)
			.join('\n');

		expect(
			[...problems.keys()],
			`undeclared variables (the fallback applies, or the property becomes invalid):\n${report}`
		).toEqual([]);
	});
});
