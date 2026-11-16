#!/bin/sh
# WrtWeb USB modem uplink helper.
# Sets up a WAN interface on a USB cellular modem (QMI/MBIM/NCM/RNDIS/PPP).

set -u
CONF=wrtweb

g() { uci -q get "$CONF.$1.$2" 2>/dev/null; }

detect_device() {
	# common cellular netdev names in priority order
	for d in wwan0 cdc-wdm0 ttyUSB3; do
		[ -e "/dev/$d" ] || [ -e "/sys/class/net/$d" ] && { echo "${d/cdc-wdm0/wwan0}"; return; }
	done
	echo "wwan0"
}

apply_modem() {
	[ "$(g usbmodem enabled)" = "1" ] || { echo "usbmodem disabled"; return 0; }
	proto="$(g usbmodem proto)"; proto="${proto:-dhcp}"
	dev="$(g usbmodem device)"; dev="${dev:-$(detect_device)}"
	apn="$(g usbmodem apn)"

	uci -q delete network.usbmodem
	uci set network.usbmodem='interface'
	case "$proto" in
		qmi)
			uci set network.usbmodem.proto='qmi'
			uci set network.usbmodem.device="$dev"
			[ -n "$apn" ] && uci set network.usbmodem.apn="$apn"
			;;
		mbim)
			uci set network.usbmodem.proto='mbim'
			uci set network.usbmodem.device="$dev"
			[ -n "$apn" ] && uci set network.usbmodem.apn="$apn"
			;;
		ppp)
			uci set network.usbmodem.proto='ppp'
			uci set network.usbmodem.device='/dev/ttyUSB0'
			uci set network.usbmodem.username=''
			uci set network.usbmodem.password=''
			uci set network.usbmodem.apn="$apn"
			uci set network.usbmodem.pnterm='/usr/bin/chat-ppp-watch'
			;;
		*) # dhcp (NCM/RNDIS/ECM)
			uci set network.usbmodem.proto='dhcp'
			uci set network.usbmodem.ifname="$dev"
			;;
	esac
	uci commit network

	# add to wan firewall zone if present
	uci -q add_list firewall.@zone[0].network='usbmodem' 2>/dev/null
	uci commit firewall

	ifdown wan 2>/dev/null
	ifup usbmodem 2>/dev/null
	echo "usbmodem applied: proto=$proto dev=$dev"
}

case "${1:-apply}" in
	apply) apply_modem ;;
	detect) detect_device ;;
	*) echo "usage: $0 {apply|detect}" ;;
esac
