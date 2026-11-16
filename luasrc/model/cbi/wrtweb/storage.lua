-- USB storage + network share (GL.iNet "USB / Network Storage")
-- Auto-mounts USB block devices and exports them over Samba (SMB).

m = Map("wrtweb",
	_("USB Storage & Share"),
	_("Auto-mount attached USB storage and export it over the network."))

mout = m:section(TypedSection, "storage", _("Auto-mount"))
mout.addremove = false
mout.anonymous = true

mout_en = mout:option(Flag, "automount", _("Auto-mount USB drives"))
mout_en.rmempty = false
mout_en.default = "1"

mout_pt = mout:option(Value, "mountpoint", _("Mount base directory"))
mout_pt.default = "/mnt"
mout_pt.rmempty = false

msh = m:section(TypedSection, "smb", _("Samba share"))
msh.addremove = false
msh.anonymous = true

smb_en = msh:option(Flag, "enabled", _("Enable Samba share"))
smb_en.rmempty = false
smb_en.default = "0"

smb_g = msh:option(Flag, "guest", _("Allow guest (no password) access"))
smb_g.rmempty = false
smb_g.default = "1"

smb_n = msh:option(Value, "name", _("Share name"))
smb_n.default = "usb"
smb_n.rmempty = false

return m
