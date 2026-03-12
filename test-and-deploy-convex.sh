set -o errexit -o nounset -o pipefail -o noclobber

CONVEX_DEPLOYMENT="${CONVEX_DEPLOYMENT_DEV}" npx convex dev --once --typecheck=enable
bash scripts/validate-code.sh
bash scripts/replay-journal.sh
CONVEX_DEPLOYMENT="${CONVEX_DEPLOYMENT_PROD}" npx convex deploy --yes
CONVEX_DEPLOYMENT="${CONVEX_DEPLOYMENT_PROD}" npx tsx scripts/build-frontend.ts
npx wrangler pages deploy dist/ --project-name="$(node --print "require('./package.json').name")" --commit-dirty=true
