import { writeFileSync } from "node:fs";

const schemaUrl = "https://biomejs.dev/schemas/2.4.5/schema.json";

const off = new Set([
	"a11y/noNoninteractiveElementInteractions",
	"a11y/noStaticElementInteractions",
	"a11y/useKeyWithClickEvents",
	"complexity/noExcessiveCognitiveComplexity",
	"complexity/noExcessiveLinesPerFunction",
	"complexity/noVoid",
	"correctness/noNodejsModules",
	"correctness/noProcessGlobal",
	"correctness/useImportExtensions",
	"correctness/useImageSize",
	"performance/noImgElement",
	"style/noDefaultExport",
	"style/noExportedImports",
	"style/noMagicNumbers",
	"style/noProcessEnv",
	"security/noSecrets",
	"style/useNamingConvention",
	"style/useConsistentObjectDefinitions",
	"style/useExportsLast",
	"suspicious/noConsole",
	"suspicious/noBitwiseOperators",
	"nursery/useDestructuring",
	"nursery/noContinue",
	"nursery/noExcessiveLinesPerFile",
	"nursery/noJsxLiterals",
	"style/noJsxLiterals",
	"nursery/noJsxPropsBind",
	"nursery/noTernary",
	"style/noNestedTernary",
	"nursery/noUnknownAttribute",
	"nursery/noUnresolvedImports",
	"nursery/useAwaitThenable",
	"nursery/useExplicitType",
	"nursery/useMaxParams",
	"nursery/useSpread",
	"style/useObjectSpread",
]);

interface SchemaCategory {
	properties: Record<string, unknown>;
}

interface Schema {
	$defs: Record<string, SchemaCategory>;
}

const response = await fetch(schemaUrl);
if (!response.ok) {
	throw new Error(
		`Failed to fetch biome schema: ${response.status} ${response.statusText}`,
	);
}
const schema: Schema = await response.json();

const ruleCategories = [
	"a11y",
	"complexity",
	"correctness",
	"nursery",
	"performance",
	"security",
	"style",
	"suspicious",
];

const frameworkPatterns = ["Vue", "Qwik", "React", "Next", "Playwright"];

function extractRules(
	schemaData: Schema,
): Record<string, Record<string, string>> {
	const rules: Record<string, Record<string, string>> = {};
	for (const category of ruleCategories) {
		const categoryDef =
			schemaData.$defs[
				`${category.charAt(0).toUpperCase()}${category.slice(1)}`
			];
		if (categoryDef?.properties) {
			rules[category] = {};
			for (const rule of Object.keys(categoryDef.properties)) {
				if (rule === "recommended" || rule === "all") {
					continue;
				}
				const isFrameworkSpecific = frameworkPatterns.some((pattern) =>
					rule.includes(pattern),
				);
				const isOff = off.has(`${category}/${rule}`) || isFrameworkSpecific;
				rules[category][rule] = isOff ? "off" : "error";
			}
		}
	}
	return rules;
}

const rules = extractRules(schema);

const config = {
	$schema: schemaUrl,
	plugins: ["biome-rules.grit"],
	vcs: {
		enabled: true,
		clientKind: "git",
		useIgnoreFile: true,
	},
	files: {
		includes: ["**", "!!**/dist", "!!**/_*"],
	},
	formatter: {
		enabled: true,
		indentStyle: "tab",
	},
	linter: {
		enabled: true,
		domains: {
			solid: "all",
			test: "all",
		},
		rules: Object.assign({ recommended: false }, rules),
	},
	javascript: {
		formatter: {
			quoteStyle: "double",
		},
		linter: {
			enabled: true,
		},
	},
	json: {
		formatter: {
			enabled: true,
		},
		linter: {
			enabled: true,
		},
		assist: {
			enabled: true,
		},
	},
	css: {
		formatter: {
			enabled: true,
		},
		linter: {
			enabled: true,
		},
	},
	assist: {
		enabled: true,
		actions: {
			source: {
				organizeImports: "on",
			},
		},
	},
};

function formatJson(obj: unknown, indent = 0): string {
	const tab = "\t".repeat(indent);
	const nextTab = "\t".repeat(indent + 1);

	if (obj === null) {
		return "null";
	}
	if (typeof obj === "string") {
		return JSON.stringify(obj);
	}
	if (typeof obj === "number" || typeof obj === "boolean") {
		return String(obj);
	}
	if (Array.isArray(obj)) {
		if (obj.length === 0) {
			return "[]";
		}
		const simple = obj.every(
			(item) => typeof item === "string" || typeof item === "number",
		);
		if (simple) {
			return `[${obj.map((item) => JSON.stringify(item)).join(", ")}]`;
		}
		const items = obj.map(
			(item) => `${nextTab}${formatJson(item, indent + 1)}`,
		);
		return `[\n${items.join(",\n")}\n${tab}]`;
	}
	if (typeof obj === "object") {
		const entries = Object.entries(obj);
		if (entries.length === 0) {
			return "{}";
		}
		const items = entries.map(
			([key, value]) =>
				`${nextTab}${JSON.stringify(key)}: ${formatJson(value, indent + 1)}`,
		);
		return `{\n${items.join(",\n")}\n${tab}}`;
	}
	return String(obj);
}

writeFileSync("biome.json", `${formatJson(config)}\n`);
console.log("biome.json created from schema");
