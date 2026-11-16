# WrtWeb

GL.iNet-style web management for any OpenWrt router.

WrtWeb reimplements the feature set of the GL.iNet router web UI as a
set of LuCI views and shell helpers that work on any OpenWrt device:

- Status dashboard
- Internet
  - Repeater / Client Mode (join an upstream Wi-Fi and re-share it)
  - USB Modem Share (4G/5G USB cellular as WAN: QMI, MBIM, NCM/RNDIS, PPP)
- USB
  - USB Storage auto-mount + Samba network share
- Guest Wi-Fi (isolated SSID with its own firewall zone)
- AdGuard Home integration link
- Interface language switch (English / 简体中文 zh-CN)

The package builds and installs as a `.ipk` on OpenWrt SDK ≤ 23.05 and as
an `.apk` on OpenWrt SDK ≥ 24.10 (including 25.x on the OpenWrt One).

## Features

| Feature | Status | Notes |
|---|---|---|
| Status page | ✅ | Device, firmware, uptime, load |
| Repeater / Client Mode | ✅ | 802.11 `sta` iface on `wireless` |
| USB Modem Share | ✅ | QMI/MBIM/NCM/PPP uplink |
| USB Storage auto-mount | ✅ | mounts `/dev/sd*[0-9]` under `/mnt` |
| Samba share | ⚠️ | writes `/etc/smb.conf`, requires `smbd` present |
| Guest Wi-Fi | ✅ | own zone, isolation, DHCP via dnsmasq instance |
| AdGuard link | ✅ | link-out to localhost:3000 |
| Language zh-CN | ✅ | ships `luci-i18n-base-zh-cn` dependency + switch |

## Install

Prebuilt files are attached to each release: `wrtweb_*.ipk` for the older
SDK, `wrtweb_*.apk` for the newer one.

```sh
# OpenWrt 23.05 and older (ipk)
opkg update
opkg install wrtweb_0.2.0_all.ipk

# OpenWrt 24.10 / 25.x and newer (apk)
apk update
apk add wrtweb
```

Restart `uhttpd` (or `rpcd`) to pick up the new menu entries:

```sh
/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart
```

WrtWeb appears under the LuCI top menu as "WrtWeb".

## Build from the OpenWrt SDK

```sh
# Get the SDK for your target, e.g. OpenWrt 24.10 aarch64_generic
tar xJf openwrt-sdk-24.10.1-aarch64_generic_gcc_r9-a51-769-g981c978eff.bin

# Drop the package in
git clone https://github.com/CodeOfMe/WrtWeb package/wrtweb
cd openwrt-sdk-*
./scripts/feeds update -a
./scripts/feeds install -a luci
make package/wrtweb/compile V=s
# Output: bin/packages/<arch>/wrtweb_*.{ipk,apk}
```

GitHub Actions in `.github/workflows/build.yml` builds ipk + apk artefacts
for every push on a selection of common architectures.

## Layout

```
.
├── Makefile                       # OpenWrt package definition
├── luasrc/
│   ├── controller/wrtweb.lua      # menu registration
│   ├── model/cbi/wrtweb/*.lua     # CBI form models (per feature)
│   └── view/wrtweb/*.htm          # status + adguard templates
├── files/
│   ├── config/wrtweb              # default UCI config
│   ├── etc/uci-defaults/          # first-boot hook
│   ├── usr/libexec/wrtweb/*.sh    # helpers called from UI/apply
│   └── usr/share/rpcd/acl.d/*.json
└── .github/workflows/build.yml    # CI: build ipk + apk artefacts
```

## Roadmap / help wanted

- USB printer (CUPS) share
- Wake-on-LAN
- OpenVPN / WireGuard / Tailscale shortcuts
- Backup / Restore wizard
- Attended Sysupgrade frontend with rollback

## License

MIT. Bundled OpenWrt/LuCI components retain their own licenses.
