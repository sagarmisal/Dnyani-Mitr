#!/usr/bin/env bash
# R1.6 — pre-flight, not post-mortem.
#
# The APKs installed on the NGO devices were signed by ~/.android/debug.keystore
# on the owner's laptop. An APK signed by any other key CANNOT install over them:
# Android refuses with INSTALL_FAILED_UPDATE_INCOMPATIBLE, and the volunteer sees
# "App not installed". The internet's universal advice for that message is
# "uninstall the old one first" — which destroys their visitor data.
#
# So: check the signature BEFORE anything is sent to anybody.
#
#   ./scripts/verify-apk.sh android/app/build/outputs/apk/debug/app-debug.apk

set -euo pipefail

APK="${1:-android/app/build/outputs/apk/debug/app-debug.apk}"
EXPECTED="${DNYANI_MITR_SHA1:-70e96a218c5d353c21c69188a86515b6c92e7fdd}"

if [ ! -f "$APK" ]; then
  echo "✗ APK not found: $APK" >&2
  exit 1
fi

APKSIGNER="$(find "${ANDROID_HOME:-$HOME/Android/Sdk}" -name apksigner -type f 2>/dev/null | sort -r | head -1 || true)"
if [ -z "$APKSIGNER" ]; then
  echo "✗ apksigner not found. Install Android build-tools, or set ANDROID_HOME." >&2
  exit 1
fi

ACTUAL="$("$APKSIGNER" verify --print-certs "$APK" 2>/dev/null \
  | grep -i 'SHA-1 digest' | head -1 | awk '{print $NF}' | tr -d ':' | tr 'A-Z' 'a-z')"

echo "APK      : $APK"
echo "expected : $EXPECTED"
echo "actual   : ${ACTUAL:-<none>}"
echo

if [ -z "$ACTUAL" ]; then
  echo "✗ Could not read a signature. Do NOT distribute this APK." >&2
  exit 1
fi

if [ "$ACTUAL" = "$EXPECTED" ]; then
  echo "✓ Signature matches. This APK will install over the existing app."
  exit 0
fi

cat >&2 <<'WARN'
✗ SIGNATURE MISMATCH — DO NOT DISTRIBUTE THIS APK.

It cannot install over the app already on the NGO devices. Every volunteer who
tries will see "App not installed", and anyone who follows the usual advice to
uninstall first will lose all their visitor data.

Most likely cause: this APK was built on a different machine, or by GitHub
Actions, which generates a fresh throwaway debug keystore on every run.

Fix: rebuild on the machine holding the original ~/.android/debug.keystore.
WARN
exit 2
