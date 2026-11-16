#!/bin/sh
# WrtWeb USB storage auto-mount + Samba export helper.
# Mounts USB block devices under the configured base and writes a minimal
# Samba share. Requires only blockd/hotplug for auto-mount; samba optional.

set -u
CONF=wrtweb

BASE="$(uci -q get wrtweb.storage.mountpoint)"; BASE="${BASE:-/mnt}"

mount_all() {
	mkdir -p "$BASE"
	# iterate block devices that look like USB (sd*) and mount each partition
	for dev in /dev/sd[a-z][0-9]; do
		[ -b "$dev" ] || continue
		name="$(basename "$dev")"
		mnt="$BASE/$name"
		mkdir -p "$mnt"
		mount "$dev" "$mnt" 2>/dev/null && echo "mounted $dev -> $mnt"
	done
}

samba_export() {
	en="$(uci -q get wrtweb.smb.enabled)"
	[ "$en" = "1" ] || { echo "samba disabled"; return 0; }
	name="$(uci -q get wrtweb.smb.name)"; name="${name:-usb}"
	guest="$(uci -q get wrtweb.smb.guest)"
	path="$BASE"
	conf=/etc/smb.conf
	cat > "$conf" <<EOF
[global]
   workgroup = WORKGROUP
   server string = WrtWeb
   security = ${guest:+user}
   map to guest = ${guest:+Bad User}
   guest account = nobody
   netbios name = WrtWeb
[$name]
   comment = USB Storage
   path = $path
   browseable = yes
   writeable = yes
   guest ok = ${guest:+yes}
   valid users = ${guest:+nobody}
EOF
	# prefer smbd from samba4 or samba3wrap
	if command -v smbd >/dev/null 2>&1; then
		smbd -D -s "$conf" 2>/dev/null && echo "smbd started (share=$name path=$path)"
	else
		echo "smbd not installed (apk add samba4-server / opkg install samba4)"
	fi
}

case "${1:-all}" in
	mount)  mount_all ;;
	samba)  samba_export ;;
	all)    mount_all; samba_export ;;
	*) echo "usage: $0 {mount|samba|all}" ;;
esac
