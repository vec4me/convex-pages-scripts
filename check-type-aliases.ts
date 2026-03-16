/**
 * Checks for:
 * 1. Inline type expressions that should use a named type alias
 * 2. Duplicate type definitions across files (with union member order normalization)
 *
 * Usage: npx tsx scripts/check-type-aliases.ts
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const ROOT = join(import.meta.dirname, "..");
const printer = ts.createPrinter({ removeComments: true });
const TRIVIAL_RHS = /^\w+$/u;

interface Decl {
	name: string;
	key: string;
	file: string;
	line: number;
	exported: boolean;
}

function walk(dir: string): string[] {
	const results: string[] = [];
	for (const entry of readdirSync(dir)) {
		if (
			entry === "node_modules" ||
			entry === "_generated" ||
			entry === ".git"
		) {
			continue;
		}
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			for (const f of walk(full)) {
				results.push(f);
			}
		} else if (full.endsWith(".ts") || full.endsWith(".tsx")) {
			results.push(full);
		}
	}
	return results;
}

function parse(path: string): ts.SourceFile {
	return ts.createSourceFile(
		path,
		readFileSync(path, "utf-8"),
		ts.ScriptTarget.Latest,
		true,
		path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
	);
}

// ── Canonical type representation (sorts unions, intersections, object members) ──

function canonicalize(node: ts.Node, sf: ts.SourceFile): string {
	if (ts.isUnionTypeNode(node)) {
		return node.types
			.map((t) => canonicalize(t, sf))
			.sort()
			.join(" | ");
	}
	if (ts.isIntersectionTypeNode(node)) {
		return node.types
			.map((t) => canonicalize(t, sf))
			.sort()
			.join(" & ");
	}
	if (ts.isParenthesizedTypeNode(node)) {
		return `(${canonicalize(node.type, sf)})`;
	}
	if (ts.isArrayTypeNode(node)) {
		return `${canonicalize(node.elementType, sf)}[]`;
	}
	if (ts.isTupleTypeNode(node)) {
		return `[${node.elements.map((e) => canonicalize(e, sf)).join(", ")}]`;
	}
	if (ts.isTypeReferenceNode(node)) {
		const name = node.typeName.getText(sf);
		if (node.typeArguments) {
			return `${name}<${node.typeArguments.map((a) => canonicalize(a, sf)).join(", ")}>`;
		}
		return name;
	}
	if (ts.isIndexedAccessTypeNode(node)) {
		return `${canonicalize(node.objectType, sf)}[${canonicalize(node.indexType, sf)}]`;
	}
	if (ts.isTypeQueryNode(node)) {
		return `typeof ${node.exprName.getText(sf)}`;
	}
	if (ts.isLiteralTypeNode(node)) {
		if (ts.isStringLiteral(node.literal)) {
			return `"${node.literal.text}"`;
		}
		return node.literal.getText(sf);
	}
	if (ts.isTypeLiteralNode(node)) {
		const members = node.members.map((m) => canonicalizeMember(m, sf)).sort();
		return `{ ${members.join("; ")} }`;
	}
	// Keywords, mapped types, conditional types, etc.
	return printer.printNode(ts.EmitHint.Unspecified, node, sf);
}

function canonicalizeMember(m: ts.TypeElement, sf: ts.SourceFile): string {
	if (ts.isPropertySignature(m)) {
		const readonly = m.modifiers?.some(
			(mod) => mod.kind === ts.SyntaxKind.ReadonlyKeyword,
		)
			? "readonly "
			: "";
		const name = m.name?.getText(sf) ?? "";
		const opt = m.questionToken ? "?" : "";
		const type = m.type ? canonicalize(m.type, sf) : "unknown";
		return `${readonly}${name}${opt}: ${type}`;
	}
	return printer.printNode(ts.EmitHint.Unspecified, m, sf);
}

function hasExportKeyword(
	node: ts.TypeAliasDeclaration | ts.InterfaceDeclaration,
): boolean {
	return (
		node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false
	);
}

// ── Main ────────────────────────────────────────────────────────────────────

const files = ["shared", "backend", "frontend"].flatMap((d) =>
	walk(join(ROOT, d)),
);

// Phase 1: collect all non-generic type aliases and interfaces
const decls: Decl[] = [];
for (const file of files) {
	const sf = parse(file);
	const rel = relative(ROOT, file);

	ts.forEachChild(sf, function visit(node) {
		if (ts.isTypeAliasDeclaration(node) && !node.typeParameters) {
			const key = canonicalize(node.type, sf);
			if (!TRIVIAL_RHS.test(key)) {
				decls.push({
					name: node.name.text,
					key: key,
					file: rel,
					line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
					exported: hasExportKeyword(node),
				});
			}
			return;
		}
		if (ts.isInterfaceDeclaration(node) && !node.typeParameters) {
			const members = node.members.map((m) => canonicalizeMember(m, sf)).sort();
			const key = `{ ${members.join("; ")} }`;
			if (!TRIVIAL_RHS.test(key)) {
				decls.push({
					name: node.name.text,
					key: key,
					file: rel,
					line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
					exported: hasExportKeyword(node),
				});
			}
			return;
		}
		ts.forEachChild(node, visit);
	});
}

let errors = 0;

// Phase 2: detect duplicate type definitions across files
const byKey = new Map<string, Decl[]>();
for (const d of decls) {
	const list = byKey.get(d.key) ?? [];
	list.push(d);
	byKey.set(d.key, list);
}

for (const [, group] of byKey) {
	const exportedInGroup = group.filter((d) => d.exported);
	const distinctFiles = new Set(exportedInGroup.map((d) => d.file));
	if (distinctFiles.size < 2) {
		continue;
	}
	console.log("Duplicate type definition:");
	for (const d of exportedInGroup) {
		console.log(`  ${d.name}  ${d.file}:${d.line}`);
	}
	console.log(`  canonical: ${group[0].key}\n`);
	errors += 1;
}

// Phase 3: detect inline usages of exported type aliases
const lookup = new Map<string, Decl>();
for (const d of decls) {
	if (d.exported) {
		lookup.set(d.key, d);
	}
}

for (const file of files) {
	const sf = parse(file);
	const rel = relative(ROOT, file);

	ts.forEachChild(sf, function visit(node) {
		// Skip the RHS of known declarations
		if (
			ts.isTypeAliasDeclaration(node) &&
			!node.typeParameters &&
			lookup.has(canonicalize(node.type, sf))
		) {
			return;
		}
		if (ts.isInterfaceDeclaration(node) && !node.typeParameters) {
			const members = node.members.map((m) => canonicalizeMember(m, sf)).sort();
			if (lookup.has(`{ ${members.join("; ")} }`)) {
				return;
			}
		}

		// Check type nodes against known exported type forms
		if (
			node.kind >= ts.SyntaxKind.FirstTypeNode &&
			node.kind <= ts.SyntaxKind.LastTypeNode
		) {
			const alias = lookup.get(canonicalize(node, sf));
			if (alias) {
				const pos = sf.getLineAndCharacterOfPosition(node.getStart(sf));
				console.log(
					`${rel}:${pos.line + 1}:${pos.character + 1} — use "${alias.name}" instead of "${node.getText(sf)}"`,
				);
				console.log(`  declared in ${alias.file}:${alias.line}\n`);
				errors += 1;
				return;
			}
		}

		ts.forEachChild(node, visit);
	});
}

if (errors === 0) {
	console.log("No type alias violations found.");
} else {
	console.log(`${errors} issue(s) found.`);
}
process.exit(errors > 0 ? 1 : 0);
