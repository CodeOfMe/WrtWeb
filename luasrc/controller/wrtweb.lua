-- WrtWeb controller
-- The primary "WrtWeb" menu entry opens the full single-page admin panel at
-- /wrtweb/ (a complete GL.iNet-style panel). The legacy CBI forms remain
-- available under WrtWeb -> Legacy Forms.

module("luci.controller.wrtweb", package.seeall)

function index()
	-- Primary: redirect to the SPA panel
	entry({"admin", "wrtweb"}, call("go_panel"), _("WrtWeb"), 1).dependent = false
	entry({"admin", "wrtweb", "panel"}, call("go_panel"), nil).leaf = true

	if not nixio.fs.access("/etc/config/wrtweb") then
		return
	end

	-- Legacy CBI forms (kept for compatibility / low-level edits)
	entry({"admin", "wrtweb", "legacy"}, firstchild(), _("Legacy Forms"), 90).dependent = false
	entry({"admin", "wrtweb", "legacy", "repeater"}, cbi("wrtweb/repeater"), _("Repeater / Client"), 10)
	entry({"admin", "wrtweb", "legacy", "usbmodem"}, cbi("wrtweb/usbmodem"), _("USB Modem Share"), 20)
	entry({"admin", "wrtweb", "legacy", "storage"}, cbi("wrtweb/storage"), _("USB Storage & Share"), 30)
	entry({"admin", "wrtweb", "legacy", "guest"}, cbi("wrtweb/guest"), _("Guest Wi-Fi"), 40)
	entry({"admin", "wrtweb", "legacy", "status"}, template("wrtweb/status"), _("Status"), 50)
	entry({"admin", "wrtweb", "legacy", "adguard"}, template("wrtweb/adguard"), _("AdGuard Home"), 60)
	entry({"admin", "wrtweb", "legacy", "system"}, cbi("wrtweb/system"), _("System"), 70)
end

function go_panel()
	luci.http.redirect("/wrtweb/")
end
