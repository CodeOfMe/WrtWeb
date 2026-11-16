local _ = (type(_) == "function" and _) or require("luci.i18n").translate

-- USB cellular modem share (GL.iNet "USB Modem / Tethering")
-- Brings up a USB QMI/MBIM/NCM/PPP cellular modem as a WAN uplink and
-- routes LAN traffic through it.

m = Map("wrtweb",
	_("USB Modem Share"),
	_("Share a USB cellular modem (4G/5G) as the router uplink."))

s = m:section(TypedSection, "usbmodem", _("USB Modem"))
s.addremove = false
s.anonymous = true

en = s:option(Flag, "enabled", _("Enable USB modem uplink"))
en.rmempty = false
en.default = "0"

proto = s:option(ListValue, "proto", _("Modem protocol"))
proto:value("dhcp", _("DHCP (NCM / RNDIS / ECM)"))
proto:value("qmi", _("QMI"))
proto:value("mbim", _("MBIM"))
proto:value("ppp", _("PPP"))
proto.default = "dhcp"

apn = s:option(Value, "apn", _("APN"))
apn.rmempty = true
apn.placeholder = _("internet")

pin = s:option(Value, "pin", _("SIM PIN (optional)"))
pin.password = true
pin.rmempty = true

device = s:option(Value, "device", _("Modem net device (auto if empty)"))
device.rmempty = true
device.placeholder = "wwan0"

return m
