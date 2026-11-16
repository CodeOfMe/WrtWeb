-- System: language + firmware info (GL.iNet "System" + language switch)
-- Sets LuCI UI language, shows device info.

m = Map("wrtweb",
	_("System"),
	_("Interface language and device information."))

-- language lives in luci.main.lang; expose it in a separate map target
l = Map("luci", _("Interface Language"))
l.redirect = false

ls = l:section(TypedSection, "main", _("Language"))
ls.addremove = false
ls.anonymous = true

lang = ls:option(ListValue, "lang", _("UI Language"))
lang:value("auto", _("Auto / Browser default"))
lang:value("en", _("English"))
lang:value("zh_CN", _("Chinese (Simplified) - 简体中文"))
lang.default = "auto"

return { m, l }
