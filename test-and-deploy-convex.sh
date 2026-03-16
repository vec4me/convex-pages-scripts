set -o errexit -o nounset -o pipefail -o noclobber

DIR="$(dirname "$0")"

CONVEX_DEPLOYMENT="${CONVEX_DEPLOYMENT_DEV}" npx convex dev --once --typecheck=enable
bash "$DIR/validate-code.sh"
bash "$DIR/replay-journal.sh"
# I have no fucking clue why this doesn't work without export, but you can't
# prepend the environment variables to the command — for some reason it just
# doesn't work that way.
export CONVEX_DEPLOYMENT="${CONVEX_DEPLOYMENT_PROD}"
npx convex deploy --yes
npx tsx "$DIR/build-frontend.ts"
npx wrangler pages deploy .dist/ --project-name="$(node --print "require('./package.json').name")" --commit-dirty=true
