local _ = (type(_) == "function" and _) or require("luci.i18n").translate

-- System: interface language switch (GL.iNet "System" language selector).
-- Device info is shown on the WrtWeb Status page.

m = Map("luci", _("System"),
	_("Interface language for the web management UI."))

ls = m:section(TypedSection, "core", _("Interface Language"))
ls.addremove = false
ls.anonymous = true

lang = ls:option(ListValue, "lang", _("UI Language"),
	_("Select the web interface language. Reload the page after saving."))
lang:value("auto", _("Auto / Browser default"))
lang:value("en", _("English"))
lang:value("zh_CN", _("Chinese (Simplified) - 简体中文"))
lang.default = "auto"
lang.rmempty = false

return m
