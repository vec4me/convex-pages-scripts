import { existsSync, readFileSync, writeFileSync } from "node:fs";

const target = `${import.meta.dirname}/../node_modules/convex/bin/main.js`;

if (!existsSync(target)) {
	console.log("Convex not installed yet, skipping patch");
	process.exit(0);
}

if (readFileSync(target, "utf-8").includes("JOURNAL_PATCHED")) {
	process.exit(0);
}

writeFileSync(
	target,
	`#!/usr/bin/env node
// JOURNAL_PATCHED
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { build } from "esbuild";
import ts from "typescript";

function findUsedIdentifiers(node) {
	const ids = new Set();
	function visit(n) {
		if (ts.isIdentifier(n)) ids.add(n.text);
		ts.forEachChild(n, visit);
	}
	visit(node);
	return ids;
}

function extractMinimalCode(bundledCode, targetName) {
	const sourceFile = ts.createSourceFile("bundle.ts", bundledCode, ts.ScriptTarget.Latest, true);
	const printer = ts.createPrinter();

	// Find all top-level declarations
	const decls = new Map();
	for (const stmt of sourceFile.statements) {
		if (ts.isVariableStatement(stmt)) {
			for (const d of stmt.declarationList.declarations) {
				if (ts.isIdentifier(d.name)) {
					decls.set(d.name.text, stmt);
				}
			}
		} else if (ts.isFunctionDeclaration(stmt) && stmt.name) {
			decls.set(stmt.name.text, stmt);
		}
	}

	// Find target and its dependencies recursively
	const needed = new Set();
	const queue = [targetName];

	while (queue.length > 0) {
		const name = queue.shift();
		if (needed.has(name)) continue;

		const decl = decls.get(name);
		if (!decl) continue;

		needed.add(name);
		const usedIds = findUsedIdentifiers(decl);
		for (const id of usedIds) {
			if (decls.has(id) && !needed.has(id)) {
				queue.push(id);
			}
		}
	}

	// Collect in dependency order (reverse of discovery)
	const orderedNames = [];
	const visited = new Set();

	function addWithDeps(name) {
		if (visited.has(name)) return;
		visited.add(name);

		const decl = decls.get(name);
		if (!decl) return;

		const usedIds = findUsedIdentifiers(decl);
		for (const id of usedIds) {
			if (decls.has(id) && needed.has(id)) {
				addWithDeps(id);
			}
		}
		orderedNames.push(name);
	}

	addWithDeps(targetName);

	// Print just the needed declarations
	const parts = [];
	for (const name of orderedNames) {
		const decl = decls.get(name);
		if (decl) {
			parts.push(printer.printNode(ts.EmitHint.Unspecified, decl, sourceFile));
		}
	}

	return parts.join("\\n\\n");
}

function cleanCode(code, opNum, targetName) {
	// Remove esbuild source file comments
	code = code.replace(/^\\/\\/ backend\\/[^\\n]+\\n/gm, "");

	// Rename target mutation to "operationN" and export it
	const re = new RegExp("\\\\bvar " + targetName + "\\\\b", "g");
	code = code.replace(re, "export const operation" + opNum);
	code = code.replace(new RegExp("\\\\b" + targetName + "\\\\b", "g"), "operation" + opNum);

	return code;
}

const [cmd, func] = process.argv.slice(2);
if (cmd === "run" && func && func.includes(":")) {
	const [file, name] = func.split(":");
	const filePath = "backend/" + file + ".ts";

	if (file !== "_journal" && existsSync(filePath)) {
		const src = readFileSync(filePath, "utf-8");
		if (src.includes("mutation(") || src.includes("internalMutation(")) {
			try {
				let journal = "";
				try { journal = readFileSync("backend/_journal.ts", "utf-8"); } catch {}

				const opNum = (journal.match(/export const operation\\d+/g) || []).length + 1;

				// Bundle with all local deps inlined
				const result = await build({
					stdin: {
						contents: "export { " + name + " } from './" + file + "';",
						resolveDir: "./backend",
						loader: "ts"
					},
					bundle: true,
					write: false,
					format: "esm",
					platform: "neutral",
					external: ["convex/*", "./_generated/*"],
					minify: false,
				});

				let bundled = result.outputFiles[0].text;

				const importLines = (bundled.match(/^import .+$/gm) || []).join("\\n");
				let minimal = extractMinimalCode(bundled, name);
				minimal = cleanCode(minimal, opNum, name);

				// Append operation with its own imports
				const block = "// operation" + opNum + " (" + file + ":" + name + ")\\n" + importLines + "\\n\\n" + minimal;
				journal = journal.trim() + (journal ? "\\n\\n" : "") + block + "\\n";
				writeFileSync("backend/_journal.ts", journal);
				console.log("📝 operation" + opNum);
			} catch (e) { console.error("Journal error:", e.message); }
		}
	}
}

import("../dist/cli.bundle.cjs");
`,
);

console.log("Patched convex for journaling");
