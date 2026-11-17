#!/usr/bin/env python3
"""Minimal apk v3 (ADB format) package writer.

OpenWrt 24.10+ ships apk-tools 3, which only reads v3 packages - a v2 tar.gz is
refused with "v2 package format error". A v3 file is an 8-byte header ("ADB" + the
compression byte + the schema id), then one ADB block that holds all the metadata,
then one DATA block per file. Unsigned packages install with
`apk add --allow-untrusted <file>.apk`.
"""
import hashlib
import struct
import time

SCHEMA_PACKAGE = 0x676B6370  # "pckg"

# adb_val_t: top nibble is the type, the low 28 bits are the value or an offset
# into the ADB block
NULL, INT, INT32 = 0, 1, 2
BLOB8, BLOB16, BLOB32 = 8, 9, 10
ARRAY, OBJECT = 13, 14
ALIGN = 8


class Block:
    """The ADB block: 8-byte header (root value) plus the objects and blobs it points to."""

    def __init__(self):
        # offsets are relative to the start of the block payload, which begins with
        # the 8-byte header, so reserve room for it up front
        self.body = bytearray(8)

    def put(self, data, align):
        self.body += b"\0" * ((-len(self.body)) % align)
        offs = len(self.body)
        self.body += data
        return offs

    def blob(self, data):
        if not data:
            return v(NULL, 0)
        if len(data) <= 0xFF:
            return v(BLOB8, self.put(bytes([len(data)]) + data, 1))
        if len(data) <= 0xFFFF:
            return v(BLOB16, self.put(struct.pack("<H", len(data)) + data, 2))
        return v(BLOB32, self.put(struct.pack("<I", len(data)) + data, 4))

    def int(self, n):
        if n < 0x10000000:
            return v(INT, n)
        return v(INT32, self.put(struct.pack("<I", n), 4))

    def obj(self, values, kind=OBJECT):
        """values are the fields; entry 0 of the stored array is the entry count."""
        data = struct.pack("<I", len(values) + 1)
        data += b"".join(struct.pack("<I", x) for x in values)
        return v(kind, self.put(data, 4))

    def render(self, root):
        self.body[0:8] = struct.pack("<BBHI", 0, 0, 0, root)
        return bytes(self.body)


def v(type_, value):
    return (type_ << 28) | value


def block(kind, payload):
    raw = 4 + len(payload)
    return struct.pack("<I", (kind << 30) | raw) + payload + b"\0" * ((-raw) % ALIGN)


def build(files, meta, out_path, now=None):
    """files: [(install path, mode, bytes)]; meta: name/version/desc/arch/license/..."""
    now = int(now or time.time())
    b = Block()

    # file tree, in the order the caller gave us
    groups, order = {}, []
    for path, mode, data in files:
        parts = path.strip("/").split("/")
        d = "/".join(parts[:-1])
        if d not in groups:
            groups[d] = []
            order.append(d)
        groups[d].append((parts[-1], mode, data))

    def acl(mode):
        return b.obj([b.int(mode), b.blob(b"root"), b.blob(b"root")])

    def file_obj(name, mode, data):
        return b.obj([b.blob(name.encode()), acl(mode), b.int(len(data)),
                      b.int(now), b.blob(hashlib.sha256(data).digest())])

    paths = [b.obj([b.blob(d.encode() or b""), acl(0o755),
                    b.obj([file_obj(*f) for f in groups[d]], ARRAY)]) for d in order]

    pkginfo = b.obj([b.blob(meta["name"].encode()), b.blob(meta["version"].encode()),
                     v(NULL, 0), b.blob(meta["desc"].encode()),
                     b.blob(meta["arch"].encode()), b.blob(meta["license"].encode()),
                     b.blob(meta["origin"].encode()), b.blob(meta["maintainer"].encode()),
                     b.blob(meta["url"].encode()), v(NULL, 0), b.int(now),
                     b.int(sum(len(x[2]) for x in files)), v(NULL, 0), v(NULL, 0),
                     b.obj([b.obj([b.blob(dep.encode())]) for dep in meta["depends"]], ARRAY)])

    root = b.obj([pkginfo, b.obj(paths, ARRAY)])

    out = b"ADB." + struct.pack("<I", SCHEMA_PACKAGE) + block(0, b.render(root))
    # one DATA block per file, in the same order as the paths array
    for i, d in enumerate(order, start=1):
        for j, (_, _, data) in enumerate(groups[d], start=1):
            out += block(2, struct.pack("<II", i, j) + data)

    with open(out_path, "wb") as fh:
        fh.write(out)
    return out_path
