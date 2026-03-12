set -o errexit -o nounset -o pipefail -o noclobber

echo "Installing config files..."

npx tsx scripts/install-package.ts
cp scripts/tsconfig.json frontend/tsconfig.json
cp scripts/tsconfig.json backend/tsconfig.json
cp scripts/knip.ts knip.ts
cp scripts/convex.json convex.json
cp scripts/biome-rules.grit biome-rules.grit
cp scripts/stylelint.config.js stylelint.config.js
cp scripts/gitignore .gitignore
mkdir --parents public
echo '/* /index.html 200' >| public/_redirects

npx tsx scripts/create-biome-config.ts

bash scripts/patch-convex-journal.sh
bash scripts/patch-convex-no-envfile.sh

echo "Done."
