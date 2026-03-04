set -o errexit -o nounset -o pipefail -o noclobber

echo "Removing derived config files..."

rm --force package.json
rm --force frontend/tsconfig.json
rm --force knip.json
rm --force convex.json
rm --force biome.json
rm --force biome-rules.grit
rm --force .gitignore
rm --force backend/tsconfig.json

echo "Done."
