#!/usr/bin/env python3
"""Build WrtWeb .ipk (opkg) and .apk (Alpine-style) packages from this repo,
without the OpenWrt SDK. Outputs to dist/.
"""
import os, sys, tarfile, io, gzip, shutil, time, stat

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VER = "0.3.8"
PKG = "wrtweb"
DESC = "GL.iNet-style web admin panel for OpenWrt (repeater/hotspot/VPN/NAS/mirror/theme)"
DIST = os.path.join(ROOT, "dist")

# (source path relative to repo, install path, mode)
FILES = []
def add(src, dst, mode=0o644):
    FILES.append((src, dst, mode))

# LuCI lua
for d, _, fs in os.walk(os.path.join(ROOT, "luasrc")):
    for f in fs:
        s = os.path.join(d, f)
        rel = os.path.relpath(s, os.path.join(ROOT, "luasrc"))
        add(s, "/usr/lib/lua/luci/" + rel)
# SPA
for f in ["index.html", "style.css", "i18n.js"]:
    add(os.path.join(ROOT, "www", f), "/www/wrtweb/" + f)
for f in os.listdir(os.path.join(ROOT, "www", "js")):
    add(os.path.join(ROOT, "www", "js", f), "/www/wrtweb/js/" + f, 0o644)
# CGI backend
add(os.path.join(ROOT, "files/www/cgi-bin/wrtweb-api"), "/www/cgi-bin/wrtweb-api", 0o755)
# config + scripts
add(os.path.join(ROOT, "files/config/wrtweb"), "/etc/config/wrtweb", 0o644)
for f in os.listdir(os.path.join(ROOT, "files/usr/libexec/wrtweb")):
    add(os.path.join(ROOT, "files/usr/libexec/wrtweb", f), "/usr/libexec/wrtweb/" + f, 0o755)
for f in os.listdir(os.path.join(ROOT, "files/etc/uci-defaults")):
    add(os.path.join(ROOT, "files/etc/uci-defaults", f), "/etc/uci-defaults/" + f, 0o755)
for f in os.listdir(os.path.join(ROOT, "files/etc/init.d")):
    add(os.path.join(ROOT, "files/etc/init.d", f), "/etc/init.d/" + f, 0o755)
for f in os.listdir(os.path.join(ROOT, "files/usr/share/rpcd/acl.d")):
    add(os.path.join(ROOT, "files/usr/share/rpcd/acl.d", f), "/usr/share/rpcd/acl.d/" + f, 0o644)

# only include files that exist
FILES = [x for x in FILES if os.path.exists(x[0])]

def norm(name):
    return "." + name  # "./usr/..."

def add_to_tar(tf, arcname, data, mode, mtime):
    ti = tarfile.TarInfo(arcname)
    ti.size = len(data)
    ti.mode = mode
    ti.mtime = mtime
    ti.uid = 0; ti.gid = 0; ti.uname = "root"; ti.gname = "root"
    tf.addfile(ti, io.BytesIO(data))

def make_data_tar_gz():
    buf = io.BytesIO()
    now = int(time.time())
    with tarfile.open(fileobj=buf, mode="w:gz", format=tarfile.GNU_FORMAT) as tf:
        for src, dst, mode in FILES:
            with open(src, "rb") as fh:
                data = fh.read()
            add_to_tar(tf, norm(dst), data, mode, now)
    return buf.getvalue()

def build_ipk():
    data = make_data_tar_gz()
    # control.tar.gz
    cbuf = io.BytesIO()
    now = int(time.time())
    control = (
        f"Package: {PKG}\n"
        f"Version: {VER}\n"
        "Architecture: all\n"
        "Maintainer: CodeOfMe <https://github.com/CodeOfMe>\n"
        "Section: luci\n"
        "Priority: optional\n"
        "Depends: lua, iwinfo, iw, block-mount\n"
        f"Description: {DESC}\n"
    ).encode()
    with tarfile.open(fileobj=cbuf, mode="w:gz", format=tarfile.GNU_FORMAT) as tf:
        add_to_tar(tf, "./control", control, 0o644, now)
        # maintainer scripts
        postinst = (
            "#!/bin/sh\n"
            "[ -x /etc/init.d/rpcd ] && /etc/init.d/rpcd restart >/dev/null 2>&1\n"
            "[ -x /etc/init.d/uhttpd ] && /etc/init.d/uhttpd restart >/dev/null 2>&1\n"
            "exit 0\n"
        ).encode()
        add_to_tar(tf, "./postinst", postinst, 0o755, now)
    control_tgz = cbuf.getvalue()
    # OpenWrt-style ipk = outer tar.gz holding debian-binary, control.tar.gz,
    # data.tar.gz. (A Debian 'ar' archive is rejected by OpenWrt's opkg as
    # "Malformed package file".)
    out = os.path.join(DIST, f"{PKG}_{VER}_all.ipk")
    obuf = io.BytesIO()
    with tarfile.open(fileobj=obuf, mode="w:gz", format=tarfile.GNU_FORMAT) as tf:
        add_to_tar(tf, "./debian-binary", b"2.0\n", 0o644, now)
        add_to_tar(tf, "./control.tar.gz", control_tgz, 0o644, now)
        add_to_tar(tf, "./data.tar.gz", data, 0o644, now)
    with open(out, "wb") as fh:
        fh.write(obuf.getvalue())
    return out

def build_apk():
    """apk v3. apk-tools 3 (OpenWrt 24.10+) refuses v2 tar.gz packages, so the file is
    written in the ADB layout the device's apk can read."""
    import adb_writer
    files = [(dst, mode, open(src, "rb").read()) for src, dst, mode in FILES]
    meta = {"name": PKG, "version": VER, "desc": DESC, "arch": "noarch",
            "license": "MIT", "origin": PKG, "maintainer": "CodeOfMe",
            "url": "https://github.com/CodeOfMe/WrtWeb",
            "depends": ["lua", "iwinfo", "iw", "block-mount"]}
    return adb_writer.build(files, meta, os.path.join(DIST, f"{PKG}_{VER}_all.apk"))

def build_universal():
    import tempfile
    out = os.path.join(DIST, f"wrtweb-{VER}-universal.tar.gz")
    tmp = tempfile.mkdtemp()
    root = os.path.join(tmp, "root")
    for src, dst, mode in FILES:
        target = os.path.join(root, dst.lstrip("/"))
        os.makedirs(os.path.dirname(target), exist_ok=True)
        shutil.copyfile(src, target)
        os.chmod(target, mode)
    install = """#!/bin/sh
# WrtWeb universal installer (works on any OpenWrt: opkg or apk).
# Usage: ./install.sh [DEST]   (default DEST=/)
set -e
DEST="${1:-/}"
HERE=$(cd "$(dirname "$0")" && pwd)
cp -a "$HERE/root/." "$DEST"
chmod +x "$DEST"/usr/libexec/wrtweb/*.sh 2>/dev/null || true
chmod +x "$DEST"/etc/uci-defaults/90-wrtweb 2>/dev/null || true
[ -x "$DEST/etc/init.d/rpcd" ] && "$DEST/etc/init.d/rpcd" restart >/dev/null 2>&1 || true
[ -x "$DEST/etc/init.d/uhttpd" ] && "$DEST/etc/init.d/uhttpd" restart >/dev/null 2>&1 || true
echo "WrtWeb installed. Open https://<router>/wrtweb/"
"""
    with open(os.path.join(tmp, "install.sh"), "w") as f:
        f.write(install)
    os.chmod(os.path.join(tmp, "install.sh"), 0o755)
    with open(os.path.join(tmp, "README.txt"), "w") as f:
        f.write("WrtWeb universal package. Run ./install.sh as root on the router.\n")
    with tarfile.open(out, "w:gz") as tf:
        for name in ["root", "install.sh", "README.txt"]:
            tf.add(os.path.join(tmp, name), arcname=name)
    shutil.rmtree(tmp)
    return out

def main():
    os.makedirs(DIST, exist_ok=True)
    ipk = build_ipk()
    apk = build_apk()
    uni = build_universal()
    print("built:", ipk, os.path.getsize(ipk), "bytes")
    print("built:", apk, os.path.getsize(apk), "bytes (apk v3; install with apk add --allow-untrusted)")
    print("built:", uni, os.path.getsize(uni), "bytes")
    print("files:", len(FILES))

if __name__ == "__main__":
    main()
