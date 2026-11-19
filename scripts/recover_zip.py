"""Extract the complete entries of a (possibly truncated) streaming zip.

OneDrive "Download" zips are streamed with data descriptors and the server sometimes stops after
~15 minutes, leaving a zip without a central directory that `unzip` refuses to open. This walks
the local file headers instead, extracts every fully downloaded entry (CRC-checked) and prints
the first truncated one, so the rest can be downloaded separately.

Usage: .venv/bin/python -I scripts/recover_zip.py ZIP OUTDIR
"""

from __future__ import annotations

import mmap
import struct
import sys
import zlib
from pathlib import Path

LOCAL = b"PK\x03\x04"
DESCRIPTOR = b"PK\x07\x08"
HEADER = struct.Struct("<IHHHHHIIIHH")


def _find_descriptor(m: mmap.mmap, data_start: int) -> tuple[int, int, int] | None:
    """Locate the data descriptor that ends the entry starting at `data_start`."""
    search = data_start
    while (i := m.find(DESCRIPTOR, search)) != -1:
        dist = i - data_start
        crc = struct.unpack("<I", m[i + 4 : i + 8])[0]
        if i + 12 <= len(m) and struct.unpack("<I", m[i + 8 : i + 12])[0] == dist:
            return i, 16, crc
        if i + 16 <= len(m) and struct.unpack("<Q", m[i + 8 : i + 16])[0] == dist:
            return i, 24, crc
        search = i + 1
    return None


def recover(zip_path: Path, out: Path) -> int:
    """Extract complete entries; return how many were written."""
    with zip_path.open("rb") as f, mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ) as m:
        pos, count = 0, 0
        while pos + HEADER.size <= len(m) and m[pos : pos + 4] == LOCAL:
            _, _, flag, method, _, _, crc, csize, _, nlen, xlen = HEADER.unpack(m[pos : pos + HEADER.size])
            name = bytes(m[pos + 30 : pos + 30 + nlen]).decode("utf-8" if flag & 0x800 else "cp437")
            data_start = pos + 30 + nlen + xlen
            if flag & 0x08:
                found = _find_descriptor(m, data_start)
                if found is None:
                    print(f"truncated: {name}")
                    break
                end, dlen, crc = found
                csize, next_pos = end - data_start, end + dlen
            else:
                if data_start + csize > len(m):
                    print(f"truncated: {name}")
                    break
                next_pos = data_start + csize
            if not name.endswith("/"):
                data = bytes(m[data_start : data_start + csize])
                if method == 8:
                    data = zlib.decompress(data, -15)
                if zlib.crc32(data) & 0xFFFFFFFF != crc:
                    print(f"CRC mismatch, skipped: {name}")
                else:
                    target = out / name
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(data)
                    count += 1
            pos = next_pos
    print(f"extracted {count} files")
    return count


if __name__ == "__main__":
    recover(Path(sys.argv[1]), Path(sys.argv[2]))
