set -o errexit -o nounset -o pipefail -o noclobber

npx tsx scripts/build-frontend.ts
