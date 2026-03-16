set -o errexit -o nounset -o pipefail -o noclobber

JOURNAL_DIR=".journal/"
PENDING=$(find "$JOURNAL_DIR" -maxdepth 1 -name "*.pending.json" 2>/dev/null | sort)

if [[ -z "$PENDING" ]]; then
	exit 0
fi

echo "Replaying $(echo "$PENDING" | wc --lines) journal entries..."

TEMP_DIR=$(mktemp --directory)
trap 'rm --recursive --force "$TEMP_DIR"' EXIT

# Copy required files for Convex deployment
cp convex.json "$TEMP_DIR/"
cp package.json "$TEMP_DIR/"
ln --symbolic "$PWD/node_modules" "$TEMP_DIR/node_modules"

for POINTER in $PENDING; do
	TS=$(basename "$POINTER" .pending.json)
	FILE=$(node --print "require('./$POINTER').file")
	NAME=$(node --print "require('./$POINTER').name")

	# Copy bundled snapshot
	cp --recursive "$JOURNAL_DIR$TS/" "$TEMP_DIR/backend/"

	# Deploy from snapshot
	(cd "$TEMP_DIR" && CONVEX_DEPLOYMENT="${CONVEX_DEPLOYMENT_PROD}" npx convex deploy --yes)

	# Run the migration
	CONVEX_DEPLOYMENT="${CONVEX_DEPLOYMENT_PROD}" npx convex run --prod "$FILE:$NAME"

	# Mark as finished
	mv "$POINTER" "$JOURNAL_DIR$TS.finished.json"
	rm --recursive --force "$TEMP_DIR/backend/"
	echo "  $TS $FILE:$NAME"
done
