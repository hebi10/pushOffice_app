#!/usr/bin/env bash
set -euo pipefail

version="8.14.3"
expected_sha256="bd71102213493060956ec229d946beee57158dbd89d0e62b91bca0fa2c5f3531"
archive="$HOME/.cache/push-office/gradle-$version-bin.zip"
wrapper="android/gradle/wrapper/gradle-wrapper.properties"

[[ -f "$wrapper" ]] || { echo "::error::Android Gradle wrapper is missing." >&2; exit 1; }
mkdir -p "$(dirname "$archive")"

verify() {
  [[ -f "$archive" ]] && printf '%s  %s\n' "$expected_sha256" "$archive" | sha256sum --check --status
}

if ! verify; then
  rm -f "$archive"
  for url in \
    "https://mirrors.huaweicloud.com/gradle/gradle-$version-bin.zip" \
    "https://mirrors.aliyun.com/github/releases/gradle/gradle-distributions/v$version/gradle-$version-bin.zip" \
    "https://services.gradle.org/distributions/gradle-$version-bin.zip"
  do
    echo "Trying Gradle $version distribution from $(echo "$url" | cut -d/ -f3)..."
    temp="$archive.partial"
    rm -f "$temp"
    if curl --fail --silent --show-error --location --connect-timeout 15 --max-time 270 \
      --retry 2 --retry-delay 3 --retry-all-errors --output "$temp" "$url"; then
      if printf '%s  %s\n' "$expected_sha256" "$temp" | sha256sum --check --status; then
        mv "$temp" "$archive"
        echo "Gradle distribution SHA-256 verified."
        break
      else
        echo "::warning::Gradle download checksum mismatch; rejecting mirror response." >&2
      fi
    else
      echo "::warning::Gradle mirror download failed; trying next verified source." >&2
    fi
    rm -f "$temp"
  done
fi

if ! verify; then
  echo "::error::No trusted Gradle $version distribution available; build stopped safely." >&2
  exit 1
fi

python3 - "$wrapper" "$archive" "$expected_sha256" <<'PY'
from pathlib import Path
import sys
from urllib.parse import quote

path, archive, digest = Path(sys.argv[1]), Path(sys.argv[2]).resolve(), sys.argv[3]
entries = path.read_text(encoding="utf-8").splitlines()
options = {}
for line in entries:
    if "=" in line and not line.lstrip().startswith("#"):
        key, value = line.split("=", 1)
        options[key.strip()] = value.strip()

old_url = options.get("distributionUrl", "").replace("\\:", ":")
if not old_url.endswith("/gradle-8.14.3-bin.zip"):
    raise SystemExit("Unexpected Gradle wrapper version; distribution left unchanged.")

options["distributionUrl"] = "file\\:" + quote(str(archive), safe="/")
options["distributionSha256Sum"] = digest
options["networkTimeout"] = "120000"
wanted = {"distributionUrl", "distributionSha256Sum", "networkTimeout"}
result = [line for line in entries if line.split("=", 1)[0].strip() not in wanted]
result += [f"{key}={options[key]}" for key in ("distributionUrl", "distributionSha256Sum", "networkTimeout")]
path.write_text("\n".join(result) + "\n", encoding="utf-8")
print("Gradle wrapper configured to use a local SHA-256 verified 8.14.3 distribution.")
PY
