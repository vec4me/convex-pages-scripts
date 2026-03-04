set -o errexit -o nounset -o pipefail -o noclobber

echo "Installing config files..."

cp scripts/package.json package.json
npm pkg set name="$(basename "$PWD")"
cp scripts/tsconfig-frontend.json frontend/tsconfig.json
cp scripts/knip.json knip.json
cp scripts/convex.json convex.json
cp scripts/biome-rules.grit biome-rules.grit
cp scripts/gitignore .gitignore
cp scripts/tsconfig-backend.json backend/tsconfig.json

npx tsx scripts/create-biome-config.ts

echo "Done."
