import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const TRANSLATIONS_DIR = './src/lib/i18n/translations';

// Find all locale folders (uk, en)
const locales = readdirSync(TRANSLATIONS_DIR).filter((file) =>
	statSync(join(TRANSLATIONS_DIR, file)).isDirectory()
);

if (locales.length === 0) {
	console.error('No locales found');
	process.exit(1);
}

const baseLocale = 'uk';
if (!locales.includes(baseLocale)) {
	console.error(`Base locale '${baseLocale}' not found`);
	process.exit(1);
}

// Extract keys using a simple regex since they are TS files (e.g., 'key': 'value')
function extractKeys(filePath: string): string[] {
	try {
		const content = readFileSync(filePath, 'utf-8');
		const keys: string[] = [];
		// Match 'some.key': or "some.key":
		const regex = /['"]([\w.]+)['"]\s*:/g;
		let match;
		while ((match = regex.exec(content)) !== null) {
			keys.push(match[1]);
		}
		return keys;
	} catch {
		return [];
	}
}

// Collect all keys per locale by scanning their .ts files
const localeKeys: Record<string, string[]> = {};

for (const locale of locales) {
	const localeDir = join(TRANSLATIONS_DIR, locale);
	const files = readdirSync(localeDir).filter((f) => f.endsWith('.ts'));

	localeKeys[locale] = [];
	for (const file of files) {
		const keys = extractKeys(join(localeDir, file));
		localeKeys[locale].push(...keys);
	}
}

const baseKeys = new Set(localeKeys[baseLocale]);
let hasErrors = false;

for (const locale of locales) {
	if (locale === baseLocale) continue;

	const keys = localeKeys[locale];
	const missing = [...baseKeys].filter((k) => !keys.includes(k));
	const extra = keys.filter((k) => !baseKeys.has(k));

	if (missing.length || extra.length) {
		console.error(`[${locale}] missing: ${missing.length}, extra: ${extra.length}`);
		if (missing.length) console.error('  missing keys:', missing);
		hasErrors = true;
	}
}

if (hasErrors) {
	console.error('i18n check failed: missing or extra translation keys detected.');
	process.exit(1);
} else {
	console.log('i18n check passed: all translations are fully synced.');
}
