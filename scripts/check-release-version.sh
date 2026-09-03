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
# Read <Version> with sed rather than an XML tool: this ran on xmllint, which the
# GitHub runner image stopped shipping, and the `2>/dev/null` around it reported the
# missing binary as a missing version — so v2.0.0's release failed telling the
# maintainer to bump a field that already read 2.0.0. Only the property is an element
# named Version; every PackageReference carries it as an attribute, so the first match
# is the right one.
csproj_actual="$(sed -n 's:.*<Version>[[:space:]]*\([^<[:space:]]*\)[[:space:]]*</Version>.*:\1:p' \
  "$REPO_ROOT/$CSPROJ_FILE" | head -n 1)"
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
