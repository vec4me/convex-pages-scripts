set -o errexit -o nounset -o pipefail -o noclobber

npx tsc --noEmit --project frontend/tsconfig.json
npx tsc --noEmit --project backend/tsconfig.json
npx biome check
npx knip
