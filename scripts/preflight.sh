#!/usr/bin/env bash
#
# Pre-publish checks for `eas update`. Invoked by the update:* npm scripts.
#
# WHY THIS EXISTS
# An OTA publish has none of the safety a build has. Metro bundles without
# typechecking, so a broken bundle publishes happily and breaks the app on next
# launch — with no store review in between. And under the `fingerprint`
# runtimeVersion policy, an update whose fingerprint no longer matches the
# installed binary publishes "successfully" and is then silently never served.
# Both failures have already happened on this project once.
#
# WHY IT LIVES HERE AND NOT IN package.json
# Files under scripts/ are NOT fingerprint sources, so this file can be rewritten
# freely without invalidating OTA compatibility with binaries already shipped.
# package.json IS a source (scripts included), so keep its wrapper a stable
# one-liner and put all the logic here.
#
# Usage: bash scripts/preflight.sh <channel>

set -euo pipefail

CHANNEL="${1:?usage: bash scripts/preflight.sh <channel>}"

echo "▸ typecheck"
npx tsc --noEmit

echo "▸ tests"
npm test -- --silent

echo "▸ fingerprint vs latest finished '$CHANNEL' build"

TREE=$(node -e '
  require("@expo/fingerprint")
    .createFingerprintAsync(process.cwd(), { platforms: ["android"] })
    .then((r) => console.log(r.hash));
')

BUILD=$(npx eas-cli build:list \
  --platform android \
  --channel "$CHANNEL" \
  --status finished \
  --limit 1 \
  --json --non-interactive 2>/dev/null | node -e '
  let s = "";
  process.stdin.on("data", (d) => (s += d)).on("end", () => {
    try {
      const b = JSON.parse(s)[0];
      console.log(b ? b.runtimeVersion : "");
    } catch {
      console.log("");
    }
  });
')

if [ -z "$BUILD" ]; then
  echo "  ✗ no finished build found on channel '$CHANNEL' — cannot verify compatibility."
  echo "    Publishing blind risks an update no binary will accept. Aborting."
  exit 1
fi

if [ "$TREE" != "$BUILD" ]; then
  echo "  ✗ FINGERPRINT MISMATCH"
  echo "      tree  : $TREE"
  echo "      build : $BUILD"
  echo
  echo "    This update would publish and then never reach that build. A"
  echo "    fingerprint source changed since it was made — package.json (scripts"
  echo "    included), app.json, eas.json, or a config plugin."
  echo "    The fix is a rebuild, not a republish."
  exit 1
fi

echo "  ✓ $TREE"
echo "▸ all checks passed"
