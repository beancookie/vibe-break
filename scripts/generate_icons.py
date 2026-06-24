"""
将指定 PNG 图片转换为 src-tauri/icons 目录中所有图标尺寸

用法:
    python scripts/generate_icons.py <source_png> [output_dir]

参数:
    source_png  源图片路径(默认 assets/icon.png)
    output_dir  输出目录(默认 src-tauri/icons)
"""

import io
import os
import struct
import sys
from pathlib import Path

from PIL import Image

# 参考 src-tauri/icons 中所有图片: Windows/Linux PNG 系列 + Windows .ico + macOS .icns
PNG_TARGETS = [
    "32x32.png",
    "128x128.png",
    "128x128@2x.png",  # 256x256
    "Square30x30Logo.png",
    "Square44x44Logo.png",
    "Square71x71Logo.png",
    "Square89x89Logo.png",
    "Square107x107Logo.png",
    "Square142x142Logo.png",
    "Square150x150Logo.png",
    "Square284x284Logo.png",
    "Square310x310Logo.png",
    "StoreLogo.png",  # 50x50
    "icon.png",  # 应用主图标, 用于 Tauri 打包资源
]

# Windows .ico 多尺寸子集 (常见标准)
ICO_SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]

# macOS .icns 子集 (覆盖 ic09 ~ ic14 + ic07/ic08)
ICNS_ENTRIES = [
    ("ic07", 128),  # 128x128
    ("ic08", 256),  # 256x256
    ("ic09", 512),  # 512x512
    ("ic10", 1024),  # 1024x1024 (保留 2x retina 主图标)
    ("ic11", 32),  # 32x32
    ("ic12", 64),  # 64x64
    ("ic13", 256),  # 256x256
    ("ic14", 512),  # 512x512
]

# 解析尺寸字符串 "128x128" -> (128, 128), 处理 @2x 后缀
def parse_size_from_filename(filename: str) -> tuple[int, int]:
    stem = Path(filename).stem
    base = stem.split("@")[0]  # 去掉 @2x
    low = base.lower()
    if low.startswith("square") and low.endswith("logo"):
        nums = base[len("Square"):-len("Logo")]  # "30x30"
        w, h = nums.split("x")
        return (int(w), int(h))
    if low == "storelogo":
        return (50, 50)  # Microsoft Store logo 标准尺寸
    if low == "icon":
        return (1024, 1024)  # Tauri 打包资源主图标
    if "x" in base:
        w, h = base.split("x")
        return (int(w), int(h))
    raise ValueError(f"无法解析文件名: {filename}")


def resize_rgba(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    """LANCZOS 高质量缩放, 统一输出 RGBA"""
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    return img.resize(size, Image.Resampling.LANCZOS)


def write_pngs(source: Image.Image, out_dir: Path) -> None:
    """生成所有 PNG 尺寸"""
    for name in PNG_TARGETS:
        size = parse_size_from_filename(name)
        resized = resize_rgba(source, size)
        target = out_dir / name
        resized.save(target, format="PNG", optimize=True)
        print(f"  [PNG] {name:32s} {size[0]}x{size[1]}")


def write_ico(source: Image.Image, out_dir: Path) -> None:
    """生成多尺寸 Windows .ico (PIL 原生支持)"""
    base = resize_rgba(source, (256, 256))
    target = out_dir / "icon.ico"
    # PIL 的 sizes 参数会在 ICO 内嵌入多尺寸
    base.save(target, format="ICO", sizes=ICO_SIZES)
    print(f"  [ICO] icon.ico                           {'x'.join(map(str, ICO_SIZES[0]))} (含 {len(ICO_SIZES)} 种尺寸)")


def write_icns(source: Image.Image, out_dir: Path) -> None:
    """生成 macOS .icns (PIL 不直接支持, 手写 ICNS 容器格式)"""
    # 1) 把每种尺寸编码为 PNG bytes
    chunks = []
    for code, size in ICNS_ENTRIES:
        resized = resize_rgba(source, (size, size))
        buf = io.BytesIO()
        resized.save(buf, format="PNG")
        png_bytes = buf.getvalue()
        # ICNS entry: 4-byte type + 4-byte big-endian length (含 type+length 头 8 字节)
        entry_len = 8 + len(png_bytes)
        chunks.append(struct.pack(">4sI", code.encode("ascii"), entry_len) + png_bytes)

    # 2) 拼成完整 ICNS 文件
    body = b"".join(chunks)
    total_len = 8 + len(body)
    icns_bytes = struct.pack(">4sI", b"icns", total_len) + body

    target = out_dir / "icon.icns"
    target.write_bytes(icns_bytes)
    print(f"  [ICNS] icon.icns                         含 {len(ICNS_ENTRIES)} 种尺寸")


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    source_path = Path(sys.argv[1]) if len(sys.argv) > 1 else repo_root / "assets" / "icon.png"
    out_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else repo_root / "src-tauri" / "icons"

    if not source_path.is_file():
        print(f"[错误] 源图片不存在: {source_path}", file=sys.stderr)
        return 1

    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"源: {source_path}")
    print(f"输出: {out_dir}\n")

    source = Image.open(source_path)
    print(f"源图: {source.size[0]}x{source.size[1]} mode={source.mode}\n")

    print("生成 PNG:")
    write_pngs(source, out_dir)
    print("\n生成 ICO:")
    write_ico(source, out_dir)
    print("\n生成 ICNS:")
    write_icns(source, out_dir)

    print(f"\n完成, 共 {len(PNG_TARGETS) + 2} 个文件写入 {out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
