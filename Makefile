#
# WrtWeb - GL.iNet-style web management interface for OpenWrt
#
# A LuCI-based admin UI that reimplements the GL.iNet router feature set
# (repeater / client mode, USB cellular modem share, USB storage + Samba,
# guest Wi-Fi, AdGuard Home shortcuts, language switch, etc.) so it can be
# installed on ANY OpenWrt device as a .ipk (SDK 23.05 and earlier) or .apk
# (SDK 24.10 / 25.x).
#

include $(TOPDIR)/rules.mk

PKG_NAME:=wrtweb
PKG_VERSION:=0.3.4
PKG_RELEASE:=1

PKG_LICENSE:=MIT
PKG_MAINTAINER:=CodeOfMe <https://github.com/CodeOfMe>

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/wrtweb
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=GL.iNet-style web admin for OpenWrt
  DEPENDS:=+luci-base +luci-compat +rpcd +rpcd-mod-luci \
           +luci-i18n-base-zh-cn +lua +iwinfo +iw +ubus \
           +block-mount +kmod-fs-ext4
  URL:=https://github.com/CodeOfMe/WrtWeb
endef

define Package/wrtweb/description
  WrtWeb reimplements the GL.iNet router web features (Internet -> Repeater /
  Client mode, USB cellular modem share, USB storage + network share, guest
  Wi-Fi, AdGuard Home, and a Chinese language pack) as a set of LuCI views
  and shell helpers that work on any OpenWrt target.
endef

# The Lua / JS / shell / config sources are used verbatim from the source tree.
define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
	$(CP) ./luasrc $(PKG_BUILD_DIR)/
	$(CP) ./www $(PKG_BUILD_DIR)/
	$(CP) ./files $(PKG_BUILD_DIR)/
endef

define Build/Compile
endef

define Build/Install
endef

define Package/wrtweb/install
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci
	$(CP) $(PKG_BUILD_DIR)/luasrc/* $(1)/usr/lib/lua/luci/

	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) $(PKG_BUILD_DIR)/files/config/wrtweb $(1)/etc/config/wrtweb

	# WrtWeb SPA (full admin panel) served at /wrtweb/
	$(INSTALL_DIR) $(1)/www/wrtweb
	$(CP) $(PKG_BUILD_DIR)/www/index.html $(PKG_BUILD_DIR)/www/style.css $(PKG_BUILD_DIR)/www/i18n.js $(1)/www/wrtweb/
	$(INSTALL_DIR) $(1)/www/wrtweb/js
	$(CP) $(PKG_BUILD_DIR)/www/js/*.js $(1)/www/wrtweb/js/

	# JSON API backend (CGI)
	$(INSTALL_DIR) $(1)/www/cgi-bin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/files/www/cgi-bin/wrtweb-api $(1)/www/cgi-bin/wrtweb-api

	$(INSTALL_DIR) $(1)/usr/libexec/wrtweb
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/files/usr/libexec/wrtweb/*.sh $(1)/usr/libexec/wrtweb/

	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/files/etc/uci-defaults/* $(1)/etc/uci-defaults/

	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/files/usr/share/rpcd/acl.d/*.json $(1)/usr/share/rpcd/acl.d/
endef

$(eval $(call BuildPackage,wrtweb))
