import { existsSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { build } from "esbuild";
import { config, setupDist } from "./frontend-config.ts";

setupDist();
await build(config());

const js = readFileSync(".dist/main.js");
const jsSize = (gzipSync(js).length / 1024).toFixed(1);
if (existsSync(".dist/main.css")) {
	const css = readFileSync(".dist/main.css");
	const cssSize = (gzipSync(css).length / 1024).toFixed(1);
	console.log(`  gzip: ${jsSize}kb JS, ${cssSize}kb CSS`);
} else {
	console.log(`  gzip: ${jsSize}kb JS`);
}
