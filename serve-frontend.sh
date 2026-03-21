set -o errexit -o nounset -o pipefail -o noclobber

CONVEX_URL="https://${CONVEX_DEPLOYMENT_DEV#*:}.convex.cloud" npx vite dev --host
