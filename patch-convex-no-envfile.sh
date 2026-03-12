set -o errexit -o nounset -o pipefail -o noclobber

node -e '
const fs = require("fs");
const path = "node_modules/convex/dist/cli.bundle.cjs";
if (!fs.existsSync(path)) { console.log("Convex not installed yet, skipping patch"); process.exit(0); }
let src = fs.readFileSync(path, "utf-8");
if (src.includes("NO_ENVFILE_PATCHED")) { console.log("Already patched"); process.exit(0); }

// Patch the low-level writeUtf8File to skip .env and .gitignore writes
const target = "writeUtf8File(path33, contents, mode) {\n    const fd";
if (!src.includes(target)) { console.error("Cannot find writeUtf8File in convex bundle — patch needs updating"); process.exit(1); }
src = src.replace(
  target,
  "writeUtf8File(path33, contents, mode) { /* NO_ENVFILE_PATCHED */ if (path33.includes(\".env\") || path33 === \".gitignore\") return;\n    const fd"
);

fs.writeFileSync(path, src);
console.log("Patched convex to never read or write .env.local");
'
