#!/bin/sh
# WrtWeb guest Wi-Fi helper.
# Creates an isolated guest SSID on the primary radio with its own
# firewall zone (no forwarding to LAN when isolate=1).

set -u
CONF=wrtweb

g() { uci -q get "$CONF.$1.$2" 2>/dev/null; }

apply_guest() {
	[ "$(g guest enabled)" = "1" ] || { echo "guest disabled"; return 0; }
	ssid="$(g guest ssid)"; ssid="${ssid:-guest}"
	enc="$(g guest encryption)"; enc="${enc:-psk2}"
	key="$(g guest key)"
	isolate="$(g guest isolate)"

	radio="$(uci -q get wireless.@wifi-iface[0].radio)"; radio="${radio:-radio0}"

	# guest wireless iface
	uci -q delete wireless.guest
	uci set wireless.guest='wifi-iface'
	uci set wireless.guest.device="$radio"
	uci set wireless.guest.mode='ap'
	uci set wireless.guest.ssid="$ssid"
	uci set wireless.guest.network='guest'
	case "$enc" in
		none) uci set wireless.guest.encryption='none' ;;
		sae)  uci set wireless.guest.encryption='sae'; uci set wireless.guest.key="$key" ;;
		*)    uci set wireless.guest.encryption='psk2'; uci set wireless.guest.key="$key" ;;
	esac
	uci commit wireless

	# guest netif (own subnet)
	uci -q delete network.guest
	uci set network.guest='interface'
	uci set network.guest.proto='static'
	uci set network.guest.ifname='guest'
	uci set network.guest.ipaddr='10.10.20.1'
	uci set network.guest.netmask='255.255.255.0'
	uci commit network

	# guest firewall zone
	uci -q delete firewall.guest
	uci set firewall.guest='zone'
	uci set firewall.guest.name='guest'
	uci set firewall.guest.input='REJECT'
	uci set firewall.guest.forward='REJECT'
	uci set firewall.guest.output='ACCEPT'
	uci add_list firewall.guest.network='guest'
	if [ "$isolate" = "1" ]; then
		uci set firewall.guest.hide_dns='1'
	else
		# allow guests to reach router/LAN
		uci set firewall.guest.masq='1'
		uci add_list firewall.guest.network='lan' 2>/dev/null
	fi
	uci commit firewall

	wifi reload
	sleep 1
	ifup guest 2>/dev/null
	/etc/init.d/firewall reload 2>/dev/null
	echo "guest applied: ssid=$ssid isolate=$isolate"
}

case "${1:-apply}" in
	apply) apply_guest ;;
	*) echo "usage: $0 apply" ;;
esac
