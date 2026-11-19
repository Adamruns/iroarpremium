"""Export the extension and feature tour icons from the original paw-and-plus artwork."""
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]


def export_icons():
    with Image.open(ROOT / "image.png") as source:
        artwork = source.convert("RGBA")
    # Ignore near-transparent specks outside the paw when centering the artwork.
    bounds = artwork.getchannel("A").point(lambda alpha: 255 if alpha > 8 else 0).getbbox()
    paw = artwork.crop(bounds)
    side = max(paw.size)
    for size in (side, 16, 32, 48, 96, 128):
        # Chrome expects a 96-pixel mark centered inside its 128-pixel store icon.
        extent = 96 if size == 128 else size
        scaled = ImageOps.contain(paw, (extent, extent), method=Image.Resampling.LANCZOS)
        icon = Image.new("RGBA", (size, size))
        icon.alpha_composite(scaled, ((size - scaled.width) // 2, (size - scaled.height) // 2))
        filename = "icon.png" if size == side else f"icon-{size}.png"
        icon.save(ROOT / "icons" / filename, optimize=True)
        if size == 48:
            icon.save(ROOT / "docs/media/iroar-icon.png", optimize=True)


if __name__ == "__main__":
    export_icons()
