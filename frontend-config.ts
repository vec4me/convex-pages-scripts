import { copyFileSync, cpSync, mkdirSync } from "node:fs";
import type { BuildOptions } from "esbuild";
import { solidPlugin } from "esbuild-plugin-solid";

const DEPLOYMENT_PREFIX_REGEX = /^\w+:/u;

export function setupDist() {
	mkdirSync("dist/", { recursive: true });
	copyFileSync("frontend/index.html", "dist/index.html");
	cpSync("public/", "dist/", { recursive: true });
}

export const config = (): BuildOptions => ({
	entryPoints: ["frontend/main.tsx"],
	bundle: true,
	outdir: "dist/",
	format: "esm",
	platform: "browser",
	target: "es2020",
	plugins: [solidPlugin()],
	loader: { ".css": "css" },
	minify: true,
	logLevel: "warning",
	drop: ["console", "debugger"],
	legalComments: "none",
	define: {
		"import.meta.env.CONVEX_URL": JSON.stringify(
			`https://${process.env.CONVEX_DEPLOYMENT?.replace(DEPLOYMENT_PREFIX_REGEX, "")}.convex.cloud`,
		),
	},
});
