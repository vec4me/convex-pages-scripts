set -o errexit -o nounset -o pipefail

TARGET="node_modules/convex/bin/main.js"

if [[ ! -f "$TARGET" ]]; then
	echo "Convex not installed yet, skipping patch"
	exit 0
fi

if grep --quiet "JOURNAL_PATCHED" "$TARGET"; then
	exit 0
fi

cat > "$TARGET" << 'PATCH'
#!/usr/bin/env node
// JOURNAL_PATCHED
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { build } from "esbuild";

const [cmd, func] = process.argv.slice(2);
if (cmd === "run" && func?.includes(":")) {
	const [file, name] = func.split(":");

	if (!file.startsWith("_journal") && name.startsWith("migrate") && existsSync("backend/" + file + ".ts")) {
		const src = readFileSync("backend/" + file + ".ts", "utf-8");
		if (src.includes("mutation(")) {
			const ts = new Date().toISOString().replace(/[T:]/g, ".").replace(/-/g, ".").slice(0, 19);
			const dir = "_journal/" + ts + "/";

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
				platform: "neutral",
				external: ["convex/*"],
				minify: false,
			});

			// Copy schema.ts as-is
			cpSync("backend/schema.ts", dir + "schema.ts");

			// Write pointer
			writeFileSync("_journal/" + ts + ".pending.json", JSON.stringify({ file, name }));

			console.log("📝 " + ts);
		}
	}
}

import("../dist/cli.bundle.cjs");
PATCH

echo "Patched convex for journaling"
