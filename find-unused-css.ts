/**
 * Find unused CSS selectors by comparing CSS files against TSX/TS source files.
 * Uses PurgeCSS in "reject" mode to report selectors NOT found in any source file.
 */
import { PurgeCSS } from "purgecss";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SAFELIST = [
	/^active$/u,
	/^has-unread$/u,
	/^saved$/u,
	/^dark$/u,
	/^data-/u,
	/^badge-/u,
	/^filter-pill-active$/u,
];

function collectFiles(dir: string, ext: string): string[] {
	const results: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.name === "node_modules" || entry.name === ".git") {
			continue;
		}
		if (entry.isDirectory()) {
			for (const f of collectFiles(full, ext)) {
				results.push(f);
			}
		} else if (entry.name.endsWith(ext)) {
			results.push(full);
		}
	}
	return results;
}

async function main() {
	const cssFiles = collectFiles(join(ROOT, "frontend/css"), ".css");
	const contentFiles = collectFiles(
		join(ROOT, "frontend/components"),
		".tsx",
	).concat(
		collectFiles(join(ROOT, "frontend"), ".ts").filter(
			(f) => !f.includes("/css/"),
		),
	);

	const results = await new PurgeCSS().purge({
		content: contentFiles.map((f) => ({
			raw: readFileSync(f, "utf8"),
			extension: "tsx",
		})),
		css: cssFiles.map((f) => ({ raw: readFileSync(f, "utf8") })),
		rejected: true,
		safelist: SAFELIST,
	});

	let totalUnused = 0;
	for (const result of results) {
		const rejected = result.rejected ?? [];
		if (rejected.length > 0) {
			totalUnused += rejected.length;
		}
	}

	if (totalUnused > 0) {
		console.log(`Found ${totalUnused} potentially unused CSS selectors.`);
		for (const result of results) {
			const rejected = result.rejected ?? [];
			if (rejected.length > 0) {
				for (const selector of rejected.slice(0, 50)) {
					console.log(`  ${selector}`);
				}
				if (rejected.length > 50) {
					console.log(`  ... and ${rejected.length - 50} more`);
				}
			}
		}
	} else {
		console.log("No unused CSS selectors found.");
	}
}

void main();
