# WrtWeb

A complete, open-source replacement for the GL.iNet router admin panel that runs
on **any** OpenWrt device.

WrtWeb is a single-page admin panel (same `#/internet`, `#/clients`, ... style
routing as GL.iNet's `gl-ui`) backed by a small portable JSON API built only on
`uci`, `ubus`, `iw`/`iwinfo`. It installs as an `.ipk` (OpenWrt ≤ 23.05) or
`.apk` (OpenWrt 24.10 / 25.x).

Open it at `https://<router>/wrtweb/` or from LuCI → **WrtWeb**.

## Panel sections (GL.iNet parity)

| Group | Screens |
|---|---|
| Internet | Overview, Internet (WAN status + **Repeater/Client** scan & join), WAN, Multi-WAN |
| Clients | Clients (live DHCP + Wi-Fi stations) |
| VPN | VPN Dashboard, WireGuard Client/Server, OpenVPN Client/Server, Tor |
| Applications | Plugins, AdGuard Home, Network Storage (Samba), Dynamic DNS, Parental Control, Tailscale, ZeroTier, AstroWarp, EdgeRouter |
| Network | Wireless, LAN, Guest Network, DNS, IPv6, Firewall, Port Forwarding, VLAN |
| System | System Status, Timezone, Logs, Upgrade, Advanced, Security, Backup/Restore, Reboot |

## What is fully functional today

- Live overview (model, firmware, uptime, load, memory, WAN IP, clients, storage)
- **Repeater / Client mode**: scans real nearby SSIDs and joins one as a `sta`
  uplink (re-broadcast on LAN) — this is the core GL "Internet" feature
- **USB modem uplink** (QMI / MBIM / NCM / PPP) via `usbmodem.sh`
- **Clients** list (DHCP leases + `iw station dump`)
- **Wireless** SSID/key/encryption editing per radio
- **LAN** IP / DHCP editing, **Guest Wi-Fi** (isolated SSID + zone)
- **Port forwarding** (list/add/delete firewall redirects)
- **AdGuard Home** status + start/stop, **NAS/Samba** toggle
- **Dynamic DNS** listing, **VPN** status (WireGuard/OpenVPN detection)
- **Plugins** (installed package list), **Logs**, **Timezone/hostname**, **Reboot**
- English + 简体中文 UI switch

Screens whose daemons may be absent (Tor, Tailscale, ZeroTier, parental control,
multi-WAN, VLAN, IPv6, firmware upgrade, backup) are present and wired to the
standard OpenWrt package for that feature; install the package to enable control.

## Architecture

```
www/index.html, style.css, i18n.js   SPA shell + styles + en/zh strings
www/js/app.js                        hash router + all views
files/www/cgi-bin/wrtweb-api         JSON API (Lua CGI, uci/ubus/iw only)
files/usr/libexec/wrtweb/*.sh        repeater / usbmodem / storage / guest helpers
luasrc/controller, model, view       LuCI entry + legacy CBI forms
```

The CGI backend has zero Lua dependencies beyond the interpreter and speaks
JSON via a built-in encoder, so it works on both `opkg` and `apk` releases.

## Install

```sh
# 25.x / 24.10 (apk)
apk update && apk add wrtweb
# 23.05 and older (ipk)
opkg update && opkg install wrtweb_*.ipk
# then
/etc/init.d/rpcd restart; /etc/init.d/uhttpd restart
```

## Build

```sh
# inside an OpenWrt SDK for your target
git clone https://github.com/CodeOfMe/WrtWeb package/wrtweb
./scripts/feeds update -a && ./scripts/feeds install luci
make package/wrtweb/compile V=s
# bin/packages/<arch>/wrtweb_*.{ipk,apk}
```

Build packages locally (no CI):

```sh
python3 scripts/build_pkg.py
```

Produces in `dist/`:
- `wrtweb_<ver>_all.ipk` — for opkg-based OpenWrt (<= 23.05)
- `wrtweb-<ver>-universal.tar.gz` — universal installer (`./install.sh`), works on opkg **and** apk (24.10/25.x) systems
- `wrtweb_<ver>_all.apk` — Alpine v2 reference (OpenWrt 24.10+ needs APK v3 from the OpenWrt buildroot)


## Requirements on the router

`lua`, `iwinfo`, `iw`, `ubus`, `block-mount` (for storage), plus whichever
feature packages you enable (adguardhome, samba4, wireguard-tools, openvpn,
tor, tailscale, zerotier, mwan3, ddns-scripts, auc ...).

## License

MIT.
