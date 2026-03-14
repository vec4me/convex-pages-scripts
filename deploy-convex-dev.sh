set -o errexit -o nounset -o pipefail -o noclobber

CONVEX_DEPLOYMENT="${CONVEX_DEPLOYMENT_DEV}" npx convex dev --once --typecheck=enable
