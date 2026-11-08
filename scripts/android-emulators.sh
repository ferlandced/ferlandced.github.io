#!/usr/bin/env bash
# Android emulators for checking the site on phones, a foldable and tablets across Android versions.
#   scripts/android-emulators.sh create          install what is missing and create every emulator
#   scripts/android-emulators.sh list            show the emulators this script manages
#   scripts/android-emulators.sh start NAME      boot one emulator
#   scripts/android-emulators.sh open [PATH]     open the dev server (npm start) in Chrome on the running emulator
set -euo pipefail

SDK_ROOT="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
STUDIO_JAVA="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export JAVA_HOME="${JAVA_HOME:-$STUDIO_JAVA}"
export ANDROID_HOME="$SDK_ROOT"

COMMAND_LINE_TOOLS_BUILD="15859902"
COMMAND_LINE_TOOLS_SHA256_ARM64="835b62a26162b229b441d1f6d4680383815a270809eb33522c0d480fa5002c4e"
COMMAND_LINE_TOOLS_SHA256_X86_64="c5a6378ab5cf7e0d5701921405115befff13e9ff7417fb588389338f8bd050f3"

DEV_SERVER_PORT="${DEV_SERVER_PORT:-8080}"
DEFAULT_PATH="/ced/fr/"

# name | hardware profile | system image API level
EMULATORS="
ced-phone-pixel9-android17|pixel_9|android-37.0
ced-phone-pixel7-android15|pixel_7|android-35
ced-phone-pixel5-android12|pixel_5|android-31
ced-foldable-pixelfold-android16|pixel_fold|android-36
ced-tablet-pixeltablet-android16|pixel_tablet|android-36
ced-tablet-medium-android13|medium_tablet|android-33
"

if [[ "$(uname -m)" == "arm64" ]]; then
  ABI="arm64-v8a"
  TOOLS_ARCHIVE="commandlinetools-mac_arm64-${COMMAND_LINE_TOOLS_BUILD}_latest.zip"
  TOOLS_SHA256="$COMMAND_LINE_TOOLS_SHA256_ARM64"
else
  ABI="x86_64"
  TOOLS_ARCHIVE="commandlinetools-mac_x86_64-${COMMAND_LINE_TOOLS_BUILD}_latest.zip"
  TOOLS_SHA256="$COMMAND_LINE_TOOLS_SHA256_X86_64"
fi

SDKMANAGER="$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager"
AVDMANAGER="$SDK_ROOT/cmdline-tools/latest/bin/avdmanager"
EMULATOR="$SDK_ROOT/emulator/emulator"
ADB="$SDK_ROOT/platform-tools/adb"

system_image() {
  echo "system-images;$1;google_apis_playstore;$ABI"
}

install_command_line_tools() {
  [[ -x "$SDKMANAGER" ]] && return
  echo "Installing the Android command-line tools…"
  local download_folder
  download_folder="$(mktemp -d)"
  curl -fL --progress-bar -o "$download_folder/tools.zip" \
    "https://dl.google.com/android/repository/$TOOLS_ARCHIVE"
  echo "$TOOLS_SHA256  $download_folder/tools.zip" | shasum -a 256 -c -
  unzip -q "$download_folder/tools.zip" -d "$download_folder"
  mkdir -p "$SDK_ROOT/cmdline-tools"
  rm -rf "$SDK_ROOT/cmdline-tools/latest"
  mv "$download_folder/cmdline-tools" "$SDK_ROOT/cmdline-tools/latest"
  rm -rf "$download_folder"
}

create_emulators() {
  install_command_line_tools

  local packages=("platform-tools" "emulator")
  local api_levels
  api_levels="$(echo "$EMULATORS" | awk -F'|' 'NF == 3 { print $3 }' | sort -u)"
  for api_level in $api_levels; do
    packages+=("$(system_image "$api_level")")
  done

  echo "Android SDK licences: review and accept them below."
  "$SDKMANAGER" --licenses
  echo "Installing ${packages[*]}…"
  "$SDKMANAGER" --install "${packages[@]}"
  "$SDKMANAGER" --update

  local existing
  existing="$("$EMULATOR" -list-avds)"
  echo "$EMULATORS" | while IFS='|' read -r name hardware api_level; do
    [[ -z "$name" ]] && continue
    if grep -qx "$name" <<<"$existing"; then
      echo "Already there: $name"
      continue
    fi
    echo "Creating $name ($hardware, $api_level)…"
    echo "no" | "$AVDMANAGER" create avd --name "$name" --device "$hardware" \
      --package "$(system_image "$api_level")" >/dev/null
    local config="$HOME/.android/avd/$name.avd/config.ini"
    {
      echo "hw.keyboard=yes"
      echo "hw.gpu.mode=auto"
      echo "disk.dataPartition.size=6G"
    } >>"$config"
  done
  echo "Done. Start one with: $0 start <name>"
  list_emulators
}

list_emulators() {
  echo "$EMULATORS" | awk -F'|' 'NF == 3 { printf "  %-36s %-15s %s\n", $1, $2, $3 }'
}

start_emulator() {
  local name="${1:?Give an emulator name, see: $0 list}"
  "$EMULATOR" -avd "$name" -netdelay none -netspeed full >/dev/null 2>&1 &
  echo "Booting $name…"
  "$ADB" wait-for-device
  until [[ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; do
    sleep 2
  done
  echo "$name is ready."
}

open_site() {
  local path="${1:-$DEFAULT_PATH}"
  "$ADB" reverse "tcp:$DEV_SERVER_PORT" "tcp:$DEV_SERVER_PORT" >/dev/null
  "$ADB" shell am start -a android.intent.action.VIEW \
    -d "http://localhost:$DEV_SERVER_PORT$path" com.android.chrome >/dev/null
  echo "Opened http://localhost:$DEV_SERVER_PORT$path in Chrome."
}

case "${1:-}" in
  create) create_emulators ;;
  list) list_emulators ;;
  start) start_emulator "${2:-}" ;;
  open) open_site "${2:-}" ;;
  *)
    sed -n '2,6p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
