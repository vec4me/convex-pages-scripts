set -o errexit -o nounset -o pipefail -o noclobber

TARGET="node_modules/convex/bin/main.js"

if [[ ! -f "$TARGET" ]]; then
	echo "Convex not installed yet, skipping patch"
	exit 0
fi

if grep -q "JOURNAL_PATCHED" "$TARGET"; then
	echo "Already patched"
	exit 0
fi

cat >| "$TARGET" << 'PATCH'
#!/usr/bin/env node
// JOURNAL_PATCHED
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { build } from "esbuild";

const args = process.argv.slice(2);
const cmd = args[0];
const func = args.find(a => !a.startsWith("-") && a.includes(":") && a !== cmd);
if (cmd === "run" && func) {
	const [file, name] = func.split(":");

	if (!args.includes("--prod") && !file.startsWith(".journal") && existsSync("backend/" + file + ".ts")) {
		const src = readFileSync("backend/" + file + ".ts", "utf-8");
		const funcRegex = new RegExp("export\\s+const\\s+" + name + "\\s*=\\s*(mutation|internalMutation)\\s*\\(");
		if (funcRegex.test(src)) {
			const ts = new Date().toISOString().replace("T", ".").replace(/-/g, ".").slice(0, 19);
			const dir = ".journal/" + ts + "/";

			mkdirSync(dir, { recursive: true });

			// Bundle all backend .ts files to .js (except schema)
			const entries = readdirSync("backend/")
				.filter(f => f.endsWith(".ts") && !f.startsWith("_") && f !== "schema.ts")
				.map(f => "backend/" + f);

			await build({
				entryPoints: entries,
				bundle: true,
				outdir: dir,
				format: "esm",
				platform: "node",
				external: ["convex/*"],
				minify: false,
			});

			// Copy schema.ts as-is
			cpSync("backend/schema.ts", dir + "schema.ts");

			// Write pointer
			writeFileSync(".journal/" + ts + ".pending.json", JSON.stringify({ file, name }));

			console.log("📝 " + ts);
		}
	}
}

import("../dist/cli.bundle.cjs");
PATCH

echo "Patched convex for journaling"
