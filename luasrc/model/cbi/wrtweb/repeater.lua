local _ = (type(_) == "function" and _) or require("luci.i18n").translate

-- Repeater / Client mode (GL.iNet "Internet" feature)
-- Scans nearby Wi-Fi, lets the user join an upstream SSID as a client
-- (sta) and re-broadcast on the local AP. Implemented over OpenWrt's
-- wireless "sta" interface (remode relay).

local fs = require "nixio.fs"
local iwinfo = nil
local ok, iw = pcall(require, "iwinfo")
if ok then iwinfo = iw end

local radio = luci.util.exec("uci -q get wireless.@wifi-iface[0].radio 2>/dev/null")
if not radio or radio == "" then radio = "radio0" end

-- Build SSID list via `iwinfo <if> scan` if iwinfo present, else scan via iw.
local function scan_ssids()
	local res = {}
	local ifname = luci.util.exec("uci -q get wireless.@wifi-iface[-1].ifname 2>/dev/null")
	if not ifname or ifname == "" then ifname = "wlan0" end
	if iwinfo then
		local t = iwinfo.gettype and iwinfo.gettype(ifname)
		if t then
			local list = iwinfo.getscanlist and iwinfo.getscanlist(ifname) or {}
			for _, net in ipairs(list) do
				local ssid = (net.ssid ~= nil and net.ssid ~= "") and net.ssid or "<hidden>"
				res[#res+1] = { ssid, ssid }
			end
		end
	end
	if #res == 0 then
		-- fallback: raw iw scan
		local out = luci.util.exec("iw dev " .. ifname .. " scan 2>/dev/null | awk -F': ' '/^SSID:/{print $2}'")
		for line in (out or ""):gmatch("[^\r\n]+") do
			if line ~= "" then res[#res+1] = { line, line } end
		end
	end
	if #res == 0 then res = { { "none", _("No networks found") } } end
	return res
end

m = Map("wrtweb",
	_("Repeater / Client Mode"),
	_("Join an upstream Wi-Fi network as a client and share it on your own network."))

m_on = SectionValue and nil or nil -- unused

s = m:section(TypedSection, "repeater", _("Repeater"))
s.addremove = false
s.anonymous = true

en = s:option(Flag, "enabled", _("Enable Repeater / Client mode"))
en.rmempty = false
en.default = "0"

mode = s:option(ListValue, "mode", _("Operation mode"))
mode:value("client", _("Client / Repeater (join upstream)"))
mode:value("router", _("Router (local upstream on WAN)"))
mode.default = "client"

ssid = s:option(Value, "ssid", _("Upstream network (SSID)"))
for _, o in ipairs(scan_ssids()) do ssid:value(o[1], o[2]) end

bssid = s:option(Value, "bssid", _("BSSID (optional)"))
bssid.rmempty = true

enc = s:option(ListValue, "encryption", _("Encryption"))
enc:value("none", _("Open / None"))
enc:value("psk2", _("WPA2-Personal"))
enc:value("psk-mixed", _("WPA/WPA2-Personal"))
enc:value("sae", _("WPA3-Personal"))
enc.default = "psk2"

key = s:option(Value, "key", _("Upstream password"))
key.password = true
key.rmempty = true
key:depends("encryption", "psk2")
key:depends("encryption", "psk-mixed")
key:depends("encryption", "sae")

band = s:option(ListValue, "band", _("Band to scan"))
band:value("any", _("Auto"))
band:value("2g", _("2.4 GHz"))
band:value("5g", _("5 GHz"))
band.default = "any"

apply = s:option(Button, "_apply", _("Apply changes"))
apply.inputtitle = _("Connect")
apply.inputstyle = "apply"
apply.write = function(self, section)
	luci.sys.call("/usr/libexec/wrtweb/repeater.sh apply " ..
		luci.util.shellquote(m:get(self.option and self.option or "")) )
	return true
end

return m
