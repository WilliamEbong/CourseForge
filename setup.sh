#!/usr/bin/env sh
# CourseForge setup (macOS / Linux / Git Bash). Thin wrapper: checks Node, then runs scripts/bootstrap.mjs.
# Flags pass through: --ci --no-smoke --offline --json
set -eu
cd "$(dirname "$0")"

hint() {
  echo "CourseForge needs Node.js 22.12 or newer." >&2
  echo "  macOS:  brew install node@24" >&2
  echo "  Linux:  fnm install 24   (https://github.com/Schniz/fnm) or your distribution's Node 24 package" >&2
  echo "  Any:    https://nodejs.org/en/download" >&2
  echo "Then rerun ./setup.sh" >&2
  exit 2
}

command -v node >/dev/null 2>&1 || hint
ver=$(node -p 'process.versions.node')
major=${ver%%.*}
rest=${ver#*.}
minor=${rest%%.*}
if [ "$major" -lt 22 ] || { [ "$major" -eq 22 ] && [ "$minor" -lt 12 ]; }; then
  echo "Found Node.js $ver." >&2
  hint
fi

exec node scripts/bootstrap.mjs "$@"
