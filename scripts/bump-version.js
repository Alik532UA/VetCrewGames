import fs from 'fs';
import path from 'path';

// Resolve paths relative to project root
const packageJsonPath = path.resolve(process.cwd(), 'package.json');
const appVersionPath = path.resolve(process.cwd(), 'static/app-version.json');

// Read and parse package.json
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

// Split the version string (e.g., '1.0.0')
const versionParts = pkg.version.split('.');
const patch = parseInt(versionParts[2], 10);

// Increment patch version
versionParts[2] = (patch + 1).toString();
const newVersion = versionParts.join('.');

// Update package.json object
pkg.version = newVersion;

// Write updated package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, '\t') + '\n');

// Write app-version.json to static/
const versionObj = {
	version: `v${newVersion}`,
	buildDate: new Date().toISOString()
};
fs.writeFileSync(appVersionPath, JSON.stringify(versionObj, null, '\t') + '\n');

console.log(
	`[Version Bump] Successfully bumped version from ${versionParts.join('.')} (old) to ${newVersion}`
);
