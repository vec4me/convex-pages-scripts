import { readFileSync, readdirSync } from "node:fs";
import { dirname, relative } from "node:path";

// When this file runs from its source dir, scriptsDir is correct.
// When it runs as a copy at project root, derive from package.json postinstall.
const ownDir = relative(process.cwd(), import.meta.dirname);
const scriptsDir =
	ownDir ||
	dirname(
		JSON.parse(readFileSync("package.json", "utf-8")).scripts.postinstall.split(
			" ",
		)[1],
	);

const CORE_DIRS = new Set([
	"frontend",
	"backend",
	"shared",
	"public",
	scriptsDir,
]);

function hasTypeScriptFiles(dir: string): boolean {
	try {
		return readdirSync(dir).some(
			(f) => f.endsWith(".ts") || f.endsWith(".tsx"),
		);
	} catch {
		return false;
	}
}

const toolEntries = readdirSync(".", { withFileTypes: true })
	.filter(
		(d) =>
			d.isDirectory() &&
			!d.name.startsWith(".") &&
			!d.name.startsWith("node_modules") &&
			!CORE_DIRS.has(d.name) &&
			hasTypeScriptFiles(d.name),
	)
	.map((d) => `${d.name}/**/*.ts`);

const config: Record<string, unknown> = {
	entry: (
		[
			"frontend/main.tsx",
			"backend/_generated/api.d.ts",
			`${scriptsDir}/*.ts`,
		] as string[]
	).concat(toolEntries),
	project: ["**/*.ts", "**/*.tsx"],
	ignoreDependencies: ["@biomejs/biome", "tailwindcss", "tsx"],
	ignore: ["**/*.d.ts", "backend/schema.ts"],
	rules: {
		files: "error",
		dependencies: "error",
		unlisted: "error",
		binaries: "error",
		unresolved: "error",
		exports: "error",
		types: "error",
		enumMembers: "error",
		duplicates: "error",
		classMembers: "error",
	},
};

export default config;
