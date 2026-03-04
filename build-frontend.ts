import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { type BuildOptions, build, context } from "esbuild";
import { solidPlugin } from "esbuild-plugin-solid";

const isWatch = process.argv.includes("--watch");

// Ensure dist exists
if (!existsSync("dist")) {
	mkdirSync("dist");
}

// Generate HTML
writeFileSync(
	"dist/index.html",
	`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SplitUp</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💸</text></svg>">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" crossorigin="anonymous">
  <link rel="stylesheet" href="/main.css">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/main.js"></script>
</body>
</html>`,
);

const config: BuildOptions = {
	entryPoints: ["frontend/main.tsx"],
	bundle: true,
	outdir: "dist",
	format: "esm",
	platform: "browser",
	target: "es2020",
	plugins: [solidPlugin()],
	loader: { ".css": "css" },
	minify: true,
	sourcemap: false,
	logLevel: "warning",
	logLimit: 0,
	treeShaking: true,
	drop: ["console", "debugger"],
	legalComments: "none",
	define: {
		"process.env.NODE_ENV": JSON.stringify("production"),
		"process.env.CONVEX_URL": JSON.stringify(process.env.CONVEX_URL ?? ""),
	},
};

if (isWatch) {
	const ctx = await context(config);
	await ctx.watch();
	await ctx.serve({ servedir: "dist", port: 3000 });
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
