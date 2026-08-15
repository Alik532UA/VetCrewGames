/**
 * Підняття patch-версії й синхронізація `static/app-version.json`.
 *
 * Розширення `.mjs`, а не `.js`: у проєкті з `"type": "module"` різниці для
 * рантайму немає, але назва одразу каже, що це ESM, і `require` тут не працює
 * (PROJECT-STRUCTURE-v8 § 1, VERSIONING-v8 § 1.1).
 *
 * Модель версіонування — «бамп на коміт», записана в PROJECT-CONTEXT.md.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const packageJsonPath = resolve(process.cwd(), 'package.json');
const appVersionPath = resolve(process.cwd(), 'static/app-version.json');

const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

const [major, minor, patch] = pkg.version.split('.');
const previousVersion = pkg.version;
const newVersion = [major, minor, String(Number(patch) + 1)].join('.');

pkg.version = newVersion;
writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, '\t')}\n`);

/**
 * У файл іде РІВНО версія. `buildDate` тут був артефактом моменту збірки:
 * після кожного локального прогону робоче дерево ставало брудним, і ця зміна
 * раз по раз потрапляла в коміти як шум (VERSIONING-v8 § 1.4). Якщо час
 * збірки колись знадобиться в рантаймі — його інжектує Vite через `define`,
 * а не зберігає git.
 */
writeFileSync(appVersionPath, `${JSON.stringify({ version: `v${newVersion}` }, null, '\t')}\n`);

// Раніше тут друкувалося `versionParts.join('.')` як «стара» версія — а масив
// на той момент був уже змінений, тож рядок звітував «from 0.0.61 to 0.0.61».
console.log(`[Version Bump] ${previousVersion} → ${newVersion}`);
