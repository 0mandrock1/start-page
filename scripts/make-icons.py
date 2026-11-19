"""Генерує іконки розширення без залежностей: темний квадрат + акцентна ">_"."""
import struct, zlib, pathlib

BG = (30, 0, 8, 255)        # ≈ --background
FG = (240, 50, 95, 255)     # ≈ --accent-crimson
EDGE = (110, 20, 45, 255)

def render(n):
    px = [[BG] * n for _ in range(n)]
    def rect(x0, y0, x1, y1, c):
        for y in range(max(0, int(y0)), min(n, int(y1))):
            for x in range(max(0, int(x0)), min(n, int(x1))):
                px[y][x] = c
    b = max(1, n // 32)
    rect(0, 0, n, b, EDGE); rect(0, n - b, n, n, EDGE); rect(0, 0, b, n, EDGE); rect(n - b, 0, n, n, EDGE)
    t = max(2, n // 9)  # товщина штриха
    # шеврон ">"
    for i in range(int(n * 0.22)):
        x = n * 0.24 + i
        rect(x, n * 0.30 + i, x + t, n * 0.30 + i + t, FG)
        rect(x, n * 0.70 - i - t, x + t, n * 0.70 - i, FG)
    # курсор "_"
    rect(n * 0.55, n * 0.66, n * 0.80, n * 0.66 + t, FG)
    return px

def png(n, path):
    px = render(n)
    raw = b''.join(b'\x00' + b''.join(bytes(p) for p in row) for row in px)
    def chunk(k, d):
        c = struct.pack('>I', len(d)) + k + d
        return c + struct.pack('>I', zlib.crc32(k + d) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', n, n, 8, 6, 0, 0, 0)) \
        + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    pathlib.Path(path).write_bytes(data)

out = pathlib.Path(__file__).resolve().parent.parent / 'icons'
out.mkdir(exist_ok=True)
for n in (16, 32, 48, 128):
    png(n, out / f'icon{n}.png')
print('ok')
