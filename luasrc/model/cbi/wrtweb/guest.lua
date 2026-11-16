-- Guest Wi-Fi (GL.iNet "Guest Network")
-- Creates a guest SSID on the primary radio, isolated from the LAN.

m = Map("wrtweb",
	_("Guest Wi-Fi"),
	_("Broadcast an isolated guest wireless network."))

s = m:section(TypedSection, "guest", _("Guest Network"))
s.addremove = false
s.anonymous = true

en = s:option(Flag, "enabled", _("Enable guest network"))
en.rmempty = false
en.default = "0"

ssid = s:option(Value, "ssid", _("Guest SSID"))
ssid.default = "guest"
ssid.rmempty = false

enc = s:option(ListValue, "encryption", _("Encryption"))
enc:value("none", _("Open"))
enc:value("psk2", _("WPA2-Personal"))
enc:value("sae", _("WPA3-Personal"))
enc.default = "psk2"

key = s:option(Value, "key", _("Guest password"))
key.password = true
key.rmempty = true

isolate = s:option(Flag, "isolate", _("Isolate guests from LAN"))
isolate.rmempty = false
isolate.default = "1"

return m
