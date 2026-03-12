set -o errexit -o nounset -o pipefail -o noclobber

bash scripts/validate-code.sh
CONVEX_DEPLOYMENT="${CONVEX_DEPLOYMENT_PROD}" npx tsx scripts/build-frontend.ts
npx wrangler pages deploy dist/ --project-name="$(node --print "require('./package.json').name")" --commit-dirty=true
cd backend && flyctl deploy --now
