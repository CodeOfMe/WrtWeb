-- WrtWeb main controller
-- Provides a GL.iNet-style menu tree: Status, Internet (Repeater/Client),
-- USB (Modem share + Storage/Samba), Guest Wi-Fi, AdGuard, System (language).
--
-- Uses CBI (Lua) views through luci-compat so it works on both old
-- (SDK 23.05) and new (SDK 24.10+/25.x, apk) OpenWrt releases.

module("luci.controller.wrtweb", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/wrtweb") then
		return
	end

	-- Top level entry into the GL-like dashboard
	entry({"admin", "wrtweb"}, alias("admin", "wrtweb", "status"),
		_("WrtWeb"), 4).dependent = false

	entry({"admin", "wrtweb", "status"},
		template("wrtweb/status"), _("Status"), 10)

	-- Internet: Repeater / Client mode (GL "Internet" section)
	entry({"admin", "wrtweb", "repeater"},
		cbi("wrtweb/repeater"), _("Repeater / Client"), 20)

	entry({"admin", "wrtweb", "usbmodem"},
		cbi("wrtweb/usbmodem"), _("USB Modem Share"), 30)

	-- USB storage + network share (GL "USB" section)
	entry({"admin", "wrtweb", "storage"},
		cbi("wrtweb/storage"), _("USB Storage & Share"), 40)

	-- Guest Wi-Fi
	entry({"admin", "wrtweb", "guest"},
		cbi("wrtweb/guest"), _("Guest Wi-Fi"), 50)

	-- AdGuard Home shortcut / status
	entry({"admin", "wrtweb", "adguard"},
		template("wrtweb/adguard"), _("AdGuard Home"), 60)

	-- System: language + info
	entry({"admin", "wrtweb", "system"},
		cbi("wrtweb/system"), _("System"), 90)
end
