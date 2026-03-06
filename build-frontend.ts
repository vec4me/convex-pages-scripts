import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { type BuildOptions, build, context } from "esbuild";
import { solidPlugin } from "esbuild-plugin-solid";

const isWatch = process.argv.includes("--watch");

mkdirSync("dist/", { recursive: true });
copyFileSync("frontend/index.html", "dist/index.html");

const config: BuildOptions = {
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
		"process.env.NODE_ENV": JSON.stringify("production"),
		"import.meta.env.CONVEX_URL": JSON.stringify(process.env.CONVEX_URL ?? ""),
	},
};

if (isWatch) {
	const ctx = await context(config);
	await ctx.watch();
	await ctx.serve({ servedir: "dist/", port: 3000 });
	console.log("Serving at http://localhost:3000");
} else {
	await build(config);

	// Show gzipped sizes
	const js = readFileSync("dist/main.js");
	const jsSize = (gzipSync(js).length / 1024).toFixed(1);
	if (existsSync("dist/main.css")) {
		const css = readFileSync("dist/main.css");
		const cssSize = (gzipSync(css).length / 1024).toFixed(1);
		console.log(`  gzip: ${jsSize}kb JS, ${cssSize}kb CSS`);
	} else {
		console.log(`  gzip: ${jsSize}kb JS`);
	}
}
