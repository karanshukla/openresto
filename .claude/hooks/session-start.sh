#!/bin/bash
#
# SessionStart hook — provisions a fresh Claude Code on the web container so the
# backend and frontend can be built, linted, and tested without manual setup.
#
# The container image ships Node but no .NET SDK, and only the frontend's
# node_modules are pre-populated. Without this, `dotnet build` / `dotnet test`
# are simply unavailable and the root `npm run dev` script has no dependencies.
#
# Local machines are left alone (see the CLAUDE_CODE_REMOTE guard) — developers
# manage their own toolchain per the README's prerequisites.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  SUDO="sudo"
fi

# ── .NET SDK ────────────────────────────────────────────────────────────────
# Ubuntu's own dotnet-sdk-10.0 package, not the dot.net install script: the
# environment's network policy blocks builds.dotnet.microsoft.com, so the
# Microsoft installer cannot fetch anything. The apt index shipped in the image
# is stale enough that install 404s on its own, hence the update first.
DOTNET_MAJOR=10

if command -v dotnet >/dev/null 2>&1 && dotnet --list-sdks | grep -q "^${DOTNET_MAJOR}\."; then
  echo "✓ .NET ${DOTNET_MAJOR} SDK already present ($(dotnet --version))"
else
  echo "Installing .NET ${DOTNET_MAJOR} SDK…"
  export DEBIAN_FRONTEND=noninteractive
  # Third-party PPAs in the image are unreachable through the proxy and make
  # update exit non-zero; the Ubuntu archives themselves still refresh, so don't
  # let those warnings abort the hook.
  $SUDO apt-get update -qq || true
  $SUDO apt-get install -y -qq "dotnet-sdk-${DOTNET_MAJOR}.0"
  echo "✓ .NET SDK $(dotnet --version)"
fi

# ── npm dependencies ────────────────────────────────────────────────────────
# `npm ci`, not `npm install`: install rewrites package-lock.json here (this npm
# strips the `libc` fields a newer npm wrote), so every session would start with
# a dirty working tree and risk that churn riding along in an unrelated commit.
# `ci` installs the lockfile verbatim and never writes it — the same thing CI
# does. The full reinstall cost is paid once, since container state is cached
# after this hook completes.
echo "Installing root npm dependencies…"
npm ci --no-audit --no-fund --silent

echo "Installing frontend npm dependencies…"
npm ci --prefix openresto-frontend --no-audit --no-fund --silent

# ── NuGet restore ───────────────────────────────────────────────────────────
# Warms ~/.nuget so the first `dotnet build`/`dotnet test` of the session isn't
# paying for a cold package graph.
echo "Restoring NuGet packages…"
dotnet restore openresto.sln --nologo --verbosity quiet

echo "✓ Environment ready — dotnet build/test and npm test are available."
