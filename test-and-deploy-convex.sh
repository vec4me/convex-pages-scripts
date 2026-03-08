set -o errexit -o nounset -o pipefail -o noclobber

npx convex dev --once --typecheck=enable
bash scripts/validate-code.sh
bash scripts/replay-journal.sh
npx convex deploy --yes --cmd="npx tsx scripts/build-frontend.ts" --cmd-url-env-var-name=CONVEX_URL
npx wrangler pages deploy dist/ --project-name="$(node --print "require('./package.json').name")" --commit-dirty=true
