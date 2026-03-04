set -o errexit -o nounset -o pipefail -o noclobber

: "${DIST_DIR:=dist}"

project_name=$(node --print "require('./package.json').name")

npx convex dev --once --typecheck=enable
bash scripts/validate-code.sh

bash scripts/build-frontend.sh

npx convex deploy --dry-run --yes --typecheck=enable

npx wrangler pages deploy "$DIST_DIR" --project-name="$project_name"
npx convex deploy --yes --typecheck=enable

if [[ -f backend/_journal.ts ]]; then
	operations=$(grep --only-matching 'operation[0-9]*' backend/_journal.ts | sort --unique --version-sort || true)
	if [[ -z "$operations" ]]; then
		echo "No journal operations found, skipping replay."
	else
		count=$(echo "$operations" | wc --lines)

		echo "Replaying $count journal operations..."
		for operation in $operations; do
			echo "  $operation"
			npx convex run --prod "_journal:$operation"
		done

		mv backend/_journal.ts "backend/_journal.$(date +%Y.%m.%d.%H:%M:%S).ts"
	fi
fi
