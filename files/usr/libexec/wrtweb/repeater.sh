#!/bin/sh
# WrtWeb repeater helper.
# Configures an OpenWrt "sta" wireless client interface from the
# /etc/config/wrtweb [repeater] section and renews DHCP.
# Safe: only writes wireless/wrtweb UCI, then `wifi; ifup wan` style actions.

set -u

CONF=wrtweb
ACTION="${1:-apply}"

g() { uci -q get "$CONF.$1.$2" 2>/dev/null; }

apply_repeater() {
	enabled="$(g repeater enabled)"
	[ "$enabled" = "1" ] || { echo "repeater disabled"; return 0; }

	ssid="$(g repeater ssid)"
	key="$(g repeater key)"
	enc="$(g repeater encryption)"
	mode="$(g repeater mode)"

	[ -n "$ssid" ] || { echo "no ssid"; return 1; }

	# Create/refresh a sta interface named 'wwan' on the first radio
	uci -q delete wireless.@wifi-iface[-1] 2>/dev/null
	# Find first ap/ap-mode iface radio
	radio="$(uci -q get wireless.@wifi-iface[0].radio)"
	radio="${radio:-radio0}"

	uci set wireless.wwan='wifi-iface'
	uci set wireless.wwan.device="$radio"
	uci set wireless.wwan.mode='sta'
	uci set wireless.wwan.ssid="$ssid"
	uci set wireless.wwan.network='wwan'
	case "$enc" in
		none)       uci set wireless.wwan.encryption='none' ;;
		sae)        uci set wireless.wwan.encryption='sae'; uci set wireless.wwan.key="$key" ;;
		psk-mixed)  uci set wireless.wwan.encryption='psk-mixed'; uci set wireless.wwan.key="$key" ;;
		*)          uci set wireless.wwan.encryption='psk2'; uci set wireless.wwan.key="$key" ;;
	esac
	uci commit wireless

	# Ensure wwan netif exists and is WAN-type
	uci -q delete network.wwan
	uci set network.wwan='interface'
	uci set network.wwan.proto='dhcp'
	uci add_list firewall.@zone[0].network='wwan' 2>/dev/null
	uci commit network

	wifi reload
	sleep 2
	ifup wwan 2>/dev/null
	echo "repeater applied: joined $ssid"
}

case "$ACTION" in
	apply) apply_repeater ;;
	*) echo "usage: $0 apply" ;;
esac
