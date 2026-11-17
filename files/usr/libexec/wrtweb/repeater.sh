#!/bin/sh
# WrtWeb repeater helper.
#   apply  join the upstream network described by /etc/config/wrtweb [repeater]
#   watch  keep the association alive: re-associate, then bounce the interface
#
# Only the station interface is touched. An access point interface is never
# removed here, so the local Wi-Fi keeps working while the repeater is up.

set -u

CONF=wrtweb
SEC=wwan
NET=wwan
LOG=/tmp/wrtweb-repeater.log
PIDFILE=/tmp/wrtweb-repeater.pid
ACTION="${1:-apply}"

g() { uci -q get "$CONF.repeater.$1" 2>/dev/null; }

# iwinfo scan text -> the crypto name netifd expects
crypto() {
	case "$1" in
		none|psk|psk2|psk-mixed|sae) echo "$1" ;;
		NONE|OPEN|OWE) echo none ;;
		*WPA3*) case "$1" in *WPA2*) echo psk-mixed ;; *) echo sae ;; esac ;;
		*WPA2*) echo psk2 ;;
		*WPA*)  echo psk ;;
		*)      echo psk2 ;;
	esac
}

# name of the interface netifd created for our station section
live_iface() {
	ifn="$(ubus call network.interface."$NET" status 2>/dev/null \
		| jsonfilter -e '@.l3_device' 2>/dev/null)"
	# jsonfilter prints the word null for a missing key
	case "$ifn" in null|"") return 1 ;; esac
	echo "$ifn"
}

link_ok() {
	ifn="$(live_iface)"
	[ -n "$ifn" ] || return 1
	iw dev "$ifn" link 2>/dev/null | grep -q "Connected with"
}

station_section() {
	uci -q show wireless 2>/dev/null | grep -m1 "\.mode='sta'" \
		| sed "s/^wireless\.\([^\.]*\)\.mode.*/\1/"
}

ensure_iface() {
	sec="$(station_section)"
	[ -n "$sec" ] || sec="$SEC"

	uci -q get "wireless.$sec" >/dev/null 2>&1 || uci set "wireless.$sec=wifi-iface"

	radio="$(g radio)"
	# uci's `device=` refers to the wifi-device *section*, not its option name
	[ -n "$radio" ] || radio="$(uci -q show wireless 2>/dev/null | grep -m1 '=wifi-device' \
		| sed 's/^wireless\.\([^\.]*\)=.*/\1/')"
	[ -n "$radio" ] || radio=radio0

	enc="$(crypto "$(g encryption)")"
	[ -n "$enc" ] || enc=psk2

	uci set "wireless.$sec.device=$radio"
	uci set "wireless.$sec.mode=sta"
	uci set "wireless.$sec.ssid=$(g ssid)"
	uci set "wireless.$sec.encryption=$enc"
	if [ "$enc" != none ] && [ -n "$(g key)" ]; then
		uci set "wireless.$sec.key=$(g key)"
	fi
	uci set "wireless.$sec.network=$NET"
	uci set "wireless.$sec.disabled=0"
	if [ -n "$(g bssid)" ]; then uci set "wireless.$sec.bssid=$(g bssid)"; fi

	uci -q get network.$NET >/dev/null 2>&1 || uci set "network.$NET=interface"
	uci set "network.$NET.proto=dhcp"
	# preferred over the wired wan while the repeater link is up
	uci set "network.$NET.metric=5"
	uci -q show firewall 2>/dev/null | grep -q "$NET" || \
		uci add_list "firewall.@zone[0].network=$NET" 2>/dev/null

	uci commit wireless
	uci commit network
	uci commit firewall 2>/dev/null
	echo "$sec"
}

apply_repeater() {
	[ "$(g enabled)" = "1" ] || { echo "repeater disabled"; return 0; }
	[ -n "$(g ssid)" ] || { echo "no ssid"; return 1; }

	sec="$(ensure_iface)"
	# `uci commit` does not make netifd aware of a new interface, so reload first,
	# otherwise `ifup wwan` reports "Interface wwan not found"
	ubus call network reload 2>/dev/null
	wifi reload 2>/dev/null
	ifup "$NET" 2>/dev/null

	# give the association a moment to settle before reporting
	i=0
	while [ "$i" -lt 12 ]; do
		link_ok && break
		sleep 1
		i=$((i + 1))
	done

	if link_ok; then
		echo "ok: joined $(g ssid)"
	else
		echo "not associated yet (retrying in background)"
	fi

	if [ "$(g auto)" != "0" ]; then
		# the watchdog must not inherit stdout: the CGI reads this pipe until EOF, and a
		# background process holding it open would keep the join request hanging
		watch >> "$LOG" 2>&1 < /dev/null &
	fi
}

watch_loop() {
	if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE" 2>/dev/null)" 2>/dev/null; then
		return 0   # one watchdog is enough
	fi
	echo "$$" > "$PIDFILE"

	down=0
	wait=5
	while sleep "$wait"; do
		[ "$(g enabled)" = "1" ] || break
		if link_ok; then
			down=0
			wait=15
			continue
		fi
		down=$((down + 1))
		[ "$down" -ge 3 ] || continue

		ifn="$(live_iface)"
		{
			echo "$(date '+%H:%M:%S') link down, retrying"
			if [ -n "$ifn" ] && command -v wpa_cli >/dev/null 2>&1; then
				wpa_cli -i "$ifn" reassociate 2>/dev/null
			else
				ifdown "$NET" 2>/dev/null
				sleep 3
				ifup "$NET" 2>/dev/null
			fi
		} >> "$LOG" 2>&1
		down=0
		wait=60
	done
	rm -f "$PIDFILE"
}

case "$ACTION" in
	apply) apply_repeater ;;
	watch) watch_loop ;;
	*) echo "usage: $0 apply|watch" ;;
esac
