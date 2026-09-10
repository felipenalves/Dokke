#!/usr/bin/env python3
"""Normalize mascot 4x4 sheets into fixed-box WebP sprite strips.

The source art is generated as a 4x4 sheet. This script removes isolated
alpha speckles, trims each cell to its visible artwork, then places every
pose in the same visual box. The character keeps its aspect ratio while its
    target height and bottom baseline stay stable across tracks.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter


CANVAS_SIZE = 256
SOURCE_SIZE = 1254
VISUAL_HEIGHT = 234
VISUAL_BASELINE = 246
ALPHA_THRESHOLD = 20
GRID_COLUMNS = 4
GRID_ROWS = 4

TRACKS = {
    "workingStart": ("working-start.png", "dokke-mascot-working-start-strip.webp", "start"),
    "workingLoop": ("working-loop.png", "dokke-mascot-working-loop-strip.webp", "loop"),
    "workingEnd": ("working-end.png", "dokke-mascot-working-end-strip.webp", "end"),
    "thinkingStart": ("thinking-start.png", "dokke-mascot-thinking-start-strip.webp", "start"),
    "thinkingLoop": ("thinking-loop.png", "dokke-mascot-thinking-loop-strip.webp", "loop"),
    "thinkingEnd": ("thinking-end.png", "dokke-mascot-thinking-end-strip.webp", "end"),
    "idlePrincipal": ("idle-principal.png", "dokke-mascot-idle-principal-strip.webp", "ambient"),
    "idleOne": ("idle1.png", "dokke-mascot-idle-one-strip.webp", "ambient"),
    "idleTwo": ("idle2.png", "dokke-mascot-idle-two-strip.webp", "ambient"),
    "idleCoffee": ("idle-coffe.png", "dokke-mascot-idle-coffee-strip.webp", "ambient"),
}


def clean_mask(alpha: Image.Image) -> Image.Image:
    thresholded = alpha.point(lambda value: 255 if value >= ALPHA_THRESHOLD else 0)
    # Opening removes isolated generated-image speckles while retaining the
    # mascot and the larger thought/cup bubbles in their cells.
    return thresholded.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))


def remove_ground_shadow(mask: Image.Image) -> Image.Image:
    """Remove a detached ground shadow without touching the mascot.

    The working-end source has a generated horizontal shadow under the four
    notebook-closing poses. It becomes a second artwork component, which both
    adds the unwanted line and makes the mascot itself smaller during fit.
    Keep this deliberately narrow so detached thought/cup accessories remain.
    """
    width, height = mask.size
    pixels = mask.load()
    visited = bytearray(width * height)
    components = []

    for y in range(height):
        for x in range(width):
            offset = y * width + x
            if visited[offset] or pixels[x, y] == 0:
                continue
            visited[offset] = 1
            stack = [(x, y)]
            points = []
            x0 = x1 = x
            y0 = y1 = y
            while stack:
                point_x, point_y = stack.pop()
                points.append((point_x, point_y))
                x0 = min(x0, point_x)
                x1 = max(x1, point_x)
                y0 = min(y0, point_y)
                y1 = max(y1, point_y)
                for next_y in range(max(0, point_y - 1), min(height, point_y + 2)):
                    for next_x in range(max(0, point_x - 1), min(width, point_x + 2)):
                        next_offset = next_y * width + next_x
                        if not visited[next_offset] and pixels[next_x, next_y] != 0:
                            visited[next_offset] = 1
                            stack.append((next_x, next_y))
            components.append((points, x0, y0, x1 + 1, y1 + 1))

    for points, x0, y0, x1, y1 in components:
        component_width = x1 - x0
        component_height = y1 - y0
        is_detached_ground_shadow = (
            y0 >= round(height * 0.86)
            and component_height <= 24
            and component_width >= 100
            and component_width >= component_height * 5
            and len(points) < 5000
        )
        if is_detached_ground_shadow:
            for point_x, point_y in points:
                pixels[point_x, point_y] = 0
    return mask


def normalize_cell(cell: Image.Image, drop_ground_shadows: bool = False) -> Image.Image:
    alpha = cell.getchannel("A")
    mask = clean_mask(alpha)
    if drop_ground_shadows:
        # working-end's detached ground shadow must not affect the shared fit.
        mask = remove_ground_shadow(mask)
    bbox = mask.getbbox()
    if bbox is None:
        return Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))

    cleaned_alpha = ImageChops.multiply(alpha, mask)
    cleaned = cell.copy()
    cleaned.putalpha(cleaned_alpha)
    artwork = cleaned.crop(bbox)

    # Normalize the complete visible pose, rather than a component such as the
    # head panel. Generated sheets contain seated/standing poses and detached
    # accessories; one common artwork height prevents visible growth or
    # collapse as the strip advances.
    scale = VISUAL_HEIGHT / artwork.height
    scale = min(
        scale,
        CANVAS_SIZE / artwork.width,
        (VISUAL_BASELINE - 8) / artwork.height,
    )
    width = max(1, round(artwork.width * scale))
    height = max(1, round(artwork.height * scale))
    resized = artwork.resize((width, height), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    x = (CANVAS_SIZE - width) // 2
    y = VISUAL_BASELINE - height
    canvas.alpha_composite(resized, (x, y))
    return canvas


def make_strip(source: Path, drop_ground_shadows: bool = False) -> Image.Image:
    with Image.open(source) as opened:
        if opened.size != (SOURCE_SIZE, SOURCE_SIZE):
            raise ValueError(f"source sheet must be exactly {SOURCE_SIZE}x{SOURCE_SIZE}: {source}")
        sheet = opened.convert("RGBA")

    frames = []
    for row in range(GRID_ROWS):
        for column in range(GRID_COLUMNS):
            x0 = round(column * sheet.width / GRID_COLUMNS)
            x1 = round((column + 1) * sheet.width / GRID_COLUMNS)
            y0 = round(row * sheet.height / GRID_ROWS)
            y1 = round((row + 1) * sheet.height / GRID_ROWS)
            frames.append(
                normalize_cell(
                    sheet.crop((x0, y0, x1, y1)),
                    drop_ground_shadows=drop_ground_shadows,
                )
            )

    strip = Image.new("RGBA", (CANVAS_SIZE * len(frames), CANVAS_SIZE), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * CANVAS_SIZE, 0))
    return strip


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="directory containing the 4x4 PNG sheets")
    parser.add_argument("output", type=Path, help="mascot asset directory")
    args = parser.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)
    manifest_tracks = {}
    for key, (source_name, output_name, phase) in TRACKS.items():
        source = args.source / source_name
        if not source.is_file():
            raise FileNotFoundError(source)
        strip = make_strip(source, drop_ground_shadows=key == "workingEnd")
        # The mascot renders at roughly 42–64 CSS px. 256px frames at q75
        # retain enough density while keeping the duplicated PWA/native
        # bundles inside the macOS package budget.
        strip.save(args.output / output_name, "WEBP", quality=75, method=6)
        manifest_tracks[key] = {
            "phase": phase,
            "source": source_name,
            "frames": GRID_COLUMNS * GRID_ROWS,
            "output": output_name,
        }

    source_size = Image.open(args.source / next(iter(TRACKS.values()))[0]).size
    manifest = {
        "canvas": {"width": CANVAS_SIZE, "height": CANVAS_SIZE},
        "sourceGrid": {
            "columns": GRID_COLUMNS,
            "rows": GRID_ROWS,
            "sourceWidth": source_size[0],
            "sourceHeight": source_size[1],
        },
        "normalization": "trimmed-artwork-fixed-height-baseline-preserving-aspect",
        "cleanup": {
            "workingEnd": "remove-detached-ground-shadow-components",
        },
        "visualBox": {
            "width": CANVAS_SIZE,
            "height": CANVAS_SIZE,
            "visualHeight": VISUAL_HEIGHT,
            "baseline": VISUAL_BASELINE,
        },
        "frameCount": GRID_COLUMNS * GRID_ROWS,
        "tracks": manifest_tracks,
    }
    (args.output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
