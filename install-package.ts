import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const name = basename(process.cwd());
if (!/^[a-z0-9-]+$/u.test(name)) {
	console.error(
		`Invalid folder name: "${name}" (only lowercase letters, numbers, and hyphens allowed)`,
	);
	process.exit(1);
}

const template = {
	name: name,
	version: "1.0.0",
	type: "module",
	scripts: {
		postinstall: "bash scripts/install-configs-and-patch.sh",
	},
	dependencies: {
		"convex": "^1.32.0",
		"solid-js": "^1.9.11",
	},
	devDependencies: {
		"@biomejs/biome": "^2.4.5",
		"@types/node": "^25.3.3",
		"esbuild": "^0.25.0",
		"esbuild-plugin-solid": "^0.6.0",
		"knip": "^5.85.0",
		"tsx": "^4.19.0",
		"typescript": "^5.9.3",
	},
};

const existing = existsSync("package.json")
	? JSON.parse(readFileSync("package.json", "utf-8"))
	: {};

Object.assign(template.dependencies, existing.dependencies);
Object.assign(template.devDependencies, existing.devDependencies);

writeFileSync("package.json", `${JSON.stringify(template, null, "\t")}\n`);
