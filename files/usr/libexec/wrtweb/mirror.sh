#!/bin/sh
# WrtWeb package-mirror auto-selector.
# Picks a fast Chinese mirror (TUNA / USTC) for the currently running OpenWrt
# release and rewrites the apk feed list, falling back to the official mirror.
#
# Usage: mirror.sh [auto|tuna|ustc|official]

set -u

V=$(. /etc/openwrt_release 2>/dev/null; echo "${DISTRIB_RELEASE}")
ARCH=$(. /etc/openwrt_release 2>/dev/null; echo "${DISTRIB_ARCH}")
[ -n "$V" ] || V=$(grep -oE "releases/[0-9.]+" /etc/apk/repositories.d/distfeeds.list 2>/dev/null | head -1 | cut -d/ -f2)
[ -n "$ARCH" ] || ARCH=$(cat /etc/apk/arch 2>/dev/null)

F=/etc/apk/repositories.d/distfeeds.list
[ -f "$F" ] || F=/etc/apk/repositories
[ -f "$F" ] || exit 1

probe() { # $1 = base url
  url="$1/releases/$V/packages/$ARCH/base/packages.adb"
  wget -q -T 6 -O /dev/null "$url" 2>/dev/null
}

choose() {
  for b in "$@"; do
    if probe "$b"; then echo "$b"; return 0; fi
  done
  return 1
}

TUNA="https://mirrors.tuna.tsinghua.edu.cn/openwrt"
USTC="https://mirrors.ustc.edu.cn/openwrt"
OFFICIAL="https://downloads.openwrt.org"

case "${1:-auto}" in
  tuna) BASE="$TUNA" ;;
  ustc) BASE="$USTC" ;;
  official) BASE="$OFFICIAL" ;;
  *)
    BASE=$(choose "$TUNA" "$USTC" "$OFFICIAL") || BASE="$OFFICIAL"
    ;;
esac

# Normalize every feed line to BASE + the path starting at /releases/
tmp="${F}.tmp.$$"
sed -e 's#^.*\(/releases/\)#\1#' "$F" | sed -e "s#^#${BASE}#" > "$tmp" && mv "$tmp" "$F"
# drop the legacy duplicate feed file so indexes are not fetched twice
[ -f /etc/apk/repositories ] && : > /etc/apk/repositories

if apk update >/dev/null 2>&1; then
  echo "OK $BASE"
else
  echo "UPDATE_FAIL $BASE"
fi
