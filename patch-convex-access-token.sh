set -o errexit -o nounset -o pipefail -o noclobber

node -e '
const fs = require("fs");
const path = "node_modules/convex/dist/cli.bundle.cjs";
if (!fs.existsSync(path)) { console.log("Convex not installed yet, skipping patch"); process.exit(0); }
let src = fs.readFileSync(path, "utf-8");
if (src.includes("ACCESS_TOKEN_PATCHED")) { console.log("Already patched"); process.exit(0); }

// Use regex to handle parameter names changing between convex versions
const regex = /function readGlobalConfig\((\w+)\) \{\n  const configPath = globalConfigPath\(\);/;
const match = src.match(regex);
if (!match) { console.error("Cannot find readGlobalConfig in convex bundle — patch needs updating"); process.exit(1); }
src = src.replace(
  match[0],
  "function readGlobalConfig(" + match[1] + ") { /* ACCESS_TOKEN_PATCHED */ if (process.env.CONVEX_ACCESS_TOKEN) return { accessToken: process.env.CONVEX_ACCESS_TOKEN };\n  const configPath = globalConfigPath();"
);

fs.writeFileSync(path, src);
console.log("Patched convex to read CONVEX_ACCESS_TOKEN from env");
'
