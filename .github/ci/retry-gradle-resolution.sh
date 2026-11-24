#!/usr/bin/env bash
# CI-only wrapper. Retry a narrowly classified HTTP 429 dependency resolution
# failure BEFORE test execution. Never retry a failing test or compiler error.
set -euo pipefail

if [[ $# -lt 1 || "$1" != "./gradlew" ]]; then
  echo "Expected ./gradlew followed by the original QA arguments." >&2
  exit 2
fi

log_dir="$(mktemp -d)"
trap 'rm -rf "$log_dir"' EXIT
for attempt in 1 2 3; do
  log="$log_dir/attempt-$attempt.log"
  set +e
  "$@" 2>&1 | tee "$log"
  result=("${PIPESTATUS[@]}")
  set -e
  if [[ "${#result[@]}" -ne 2 ]]; then
    echo "::error::Unable to capture Gradle and log writer exit codes." >&2
    exit 1
  fi
  # A logging error is not a successful verification.
  if [[ "${result[1]}" -ne 0 ]]; then exit "${result[1]}"; fi
  if [[ "${result[0]}" -eq 0 ]]; then exit 0; fi
  if [[ "$attempt" -eq 3 ]] ||
     ! grep -Eq 'Could not (resolve|GET|get resource)|Error resolving plugin' "$log" ||
     ! grep -Eq "Could not GET 'https://(repo\.maven\.apache\.org/maven2|plugins\.gradle\.org/m2|repo1\.maven\.org/maven2)/[^']+'\. Received status code 429 from server" "$log" ||
     grep -Eq '^> Task .*(:test[^ ]*UnitTest|:connected[^ ]*AndroidTest|:test)([[:space:]]|$)|^e: |^.*[Tt]ests? (completed.*failed|failed|FAILED)|^.*java\.lang\.AssertionError|^.*There were failing tests' "$log"; then
    exit "${result[0]}"
  fi
  # Keep attempts bounded, preserve the original command and all QA arguments.
  echo "::warning::Dependency server HTTP 429 before tests; retrying Gradle resolution ($attempt/2)." >&2
  sleep "$((attempt * 30))"
done
exit 1
