import type { KnipConfig } from "knip";

const config: KnipConfig = {
	entry: [
		"frontend/main.tsx",
		"scripts/*.ts",
		// Convex backend files are entry points (exports consumed by Convex runtime)
		"backend/*.ts",
		"!backend/_*",
	],
	project: ["**/*.ts", "**/*.tsx"],
	ignoreDependencies: ["@biomejs/biome", "tsx"],
	ignore: [
		// Files/folders starting with underscore
		"**/_*/**",
		// Type declaration files
		"**/*.d.ts",
	],
	// Strict: all issue types are errors (not warnings or off)
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
