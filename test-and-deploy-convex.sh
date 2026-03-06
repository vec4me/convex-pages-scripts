set -o errexit -o nounset -o pipefail -o noclobber

npx convex dev --once --typecheck=enable
bash scripts/validate-code.sh
npx tsx scripts/build-frontend.ts
npx wrangler pages deploy dist/ --project-name="$(node --print "require('./package.json').name")" --commit-dirty=true
bash scripts/replay-journal.sh
npx convex deploy --yes --commit-dirty=true
