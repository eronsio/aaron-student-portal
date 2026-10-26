#!/bin/sh
# Run before committing a release of the site. Writes a fresh version stamp into build.js (loaded by the page) and
# version.json (fetched fresh by the page): when they differ, an open copy of the portal offers an "Update" button.
cd "$(git rev-parse --show-toplevel)" || exit 1
STAMP=$(date +%Y%m%d.%H%M%S)
printf 'window.APP_BUILD = "%s";\n' "$STAMP" > build.js
printf '{"build":"%s"}\n' "$STAMP" > version.json
echo "build stamp: $STAMP"
