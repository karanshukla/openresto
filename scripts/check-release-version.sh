#!/usr/bin/env bash
# Asserts every version field in the repo agrees with the release version, and
# that CHANGELOG.md has a section for it. Run before tagging; the release
# workflow runs it too, so a mismatch fails before any image is published.
#
#   ./scripts/check-release-version.sh 1.6.1
#   ./scripts/check-release-version.sh v1.6.1

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ $# -ne 1 ]; then
  echo "usage: $(basename "$0") <version>" >&2
  exit 2
fi

VERSION="${1#v}"

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "error: '$1' is not a semver version (expected x.y.z or vx.y.z)" >&2
  exit 2
fi

VERSIONED_FILES=(
  package.json
  package-lock.json
  openresto-frontend/package.json
  openresto-frontend/package-lock.json
  openresto-cli/package.json
  openresto-cli/package-lock.json
)

failures=0

for file in "${VERSIONED_FILES[@]}"; do
  actual="$(jq -r '.version // "<missing>"' "$REPO_ROOT/$file")"
  if [ "$actual" != "$VERSION" ]; then
    echo "FAIL $file: version is '$actual', expected '$VERSION'" >&2
    failures=$((failures + 1))
  else
    echo "ok   $file"
  fi
done

CSPROJ_FILE="OpenRestoApi/OpenRestoApi.csproj"
csproj_actual="$(xmllint --xpath 'string(//Version)' "$REPO_ROOT/$CSPROJ_FILE" 2>/dev/null || true)"
if [ -z "$csproj_actual" ]; then
  csproj_actual="<missing>"
fi
if [ "$csproj_actual" != "$VERSION" ]; then
  echo "FAIL $CSPROJ_FILE: version is '$csproj_actual', expected '$VERSION'" >&2
  failures=$((failures + 1))
else
  echo "ok   $CSPROJ_FILE"
fi

if grep -q "^## \[$VERSION\]" "$REPO_ROOT/CHANGELOG.md"; then
  echo "ok   CHANGELOG.md has a [$VERSION] section"
else
  echo "FAIL CHANGELOG.md: no '## [$VERSION]' section" >&2
  failures=$((failures + 1))
fi

if [ "$failures" -gt 0 ]; then
  cat >&2 <<EOF

$failures check(s) failed. To fix:
  - bump "version" in package.json, openresto-frontend/package.json, and openresto-cli/package.json to $VERSION
  - bump <Version> in OpenRestoApi/OpenRestoApi.csproj to $VERSION
  - run 'npm install --package-lock-only' in each of those directories
  - add a '## [$VERSION] - YYYY-MM-DD' section to CHANGELOG.md
EOF
  exit 1
fi

echo
echo "All version fields agree on $VERSION."
