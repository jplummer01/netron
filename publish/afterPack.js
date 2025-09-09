import * as fs from 'fs';
import * as path from 'path';

export const afterPack = async (context) => {
    if (context.electronPlatformName !== "linux") {
        return;
    }
    if (context.targets.length !== 1) {
        throw new Error(`Expected exactly one 'linux' target.`);
    }
    const target = context.targets[0].name;
    const executable = context.packager.executableName;
    const file = path.join(context.appOutDir, executable);
    if (target === 'appImage' && !fs.existsSync(`${file}.bin`)) {
        const bash = `#!/usr/bin/env bash
set -euo pipefail
dir="$(dirname "$(readlink -f "$0")")"
bin="$dir/${executable}.bin"
read_knob() {
  # usage: read_knob /path default_value
  local v
  if [ -r "$1" ]; then
    v="$(cat "$1" 2>/dev/null || true)"
    printf '%s' "\${v}"
  else
    printf '%s' "\${2:-}"
  fi
}
no_sandbox=0
# Is root user
if [ "$(id -u)" -eq 0 ]; then
  no_sandbox=1
fi
val="$(read_knob /proc/sys/kernel/unprivileged_userns_clone "")"
if [ -n "$val" ] && [ "$val" != "1" ]; then
  no_sandbox=1;
fi
val="$(read_knob /proc/sys/kernel/apparmor_restrict_unprivileged_userns "")"
if [ "$val" = "1" ]; then
  no_sandbox=1;
fi
# Check for --no-sandbox or --force-sandbox
for arg in "$@"; do
  if [ "$arg" = "--no-sandbox" ]; then
    no_sandbox=0;
  fi
  if [ "$arg" = "--force-sandbox" ]; then
    no_sandbox=0;
  fi
done
if [ "$no_sandbox" -eq 1 ]; then
  echo "WARNING! Running WITHOUT Chromium sandbox."
  exec -a "$0" "$bin" --no-sandbox "$@"
else
  exec -a "$0" "$bin" "$@"
fi
`;
        fs.renameSync(file, `${file}.bin`);
        fs.writeFileSync(file, bash, { mode: 0o755 });
    } else if (target !== 'appImage' && fs.existsSync(`${file}.bin`)) {
        fs.renameSync(`${file}.bin`, file);
    }
};