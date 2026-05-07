---
status: completed
date: 2026-05-07
subject: 2026-05-07.web-images-skill
topics: [web-images, imagemagick, cli-tools, image-optimization, smartcrop, webp, avif, png-optimization]
informs: [plan-web-images-skill.md]
---

# Research: CLI Image Tools for Web Image Editing Skill

## Summary

Researched CLI tools for a web-focused image editing skill. ImageMagick 7 is already installed and handles all core editing operations (crop, resize, convert). Purpose-built optimization tools (oxipng, jpegoptim, pngquant, svgo) outperform ImageMagick for compression and should be installed as optional additions.

## Key Findings

### ImageMagick 7 (already installed, ImageMagick 7.1.2-21 Q16-HDRI)
- ✅ Core editing: crop, resize, convert, composite, annotate
- ✅ Rich format support: JPEG, PNG, WebP, AVIF, JPEG XL, HEIC, TIFF, etc.
- ✅ Built-in delegates for compression
- ⚠️ Not the best at file-size optimization — purpose-built tools do better
- ⚠️ Smart/content-aware cropping not native (needs external tools)

### Performance Comparison (from research)
- **Sharp/libvips**: 4-5× faster than ImageMagick, streaming, lower memory
- **ImageMagick**: General purpose, slower, higher memory, sufficient for this use case
- **Conclusion**: Since ImageMagick is already installed and ImageMagick 7 is decent for single-image editing, stick with it as the primary tool.

### Purpose-Built Optimization Tools (all available in Arch pacman)

| Tool | Purpose | Why Better Than IM |
|------|---------|-------------------|
| `oxipng` | Lossless PNG optimization | Uses libdeflate + zopfli, ~10% better than OptiPNG, multi-threaded |
| `jpegoptim` | Lossless JPEG optimization | Strips metadata, re-encodes Huffman tables |
| `pngquant` | Lossy PNG quantization | 24-bit → 8-bit + alpha, 60-80% size reduction |
| `svgo` | SVG optimization | Removes junk/minifies, ~30-50% smaller |

### Smart Crop Options
- **smartcrop-cli**: Content-aware cropping via entropy/face detection, JS-based, requires npm
- **ImageMagick built-in**: `-fuzz N% -trim +repage` for border cropping
- **Decision**: Built-in trim is sufficient for most use cases; smartcrop-cli is an enhancement for later

### Format Decision Guide
- PNG (photo) → WebP @ 80-85 (30-60% smaller)
- PNG (logo/illustration) → PNG optimized or SVG
- PNG (transparency) → WebP (lossless) or PNG
- JPEG (photo) → WebP @ 80 or JPEG @ 85
- BMP/TIFF → WebP or JPEG
- SVG → SVG (svgo optimized)

## Recommended Tool Stack
- **Primary**: ImageMagick 7 (editing: crop, resize, convert)
- **Optional**: oxipng, jpegoptim, pngquant, svgo (optimization/compression)
- **Future**: smartcrop-cli for content-aware cropping

## Installation
```bash
# Arch Linux
sudo pacman -S --needed oxipng jpegoptim pngquant svgo

# macOS (via Homebrew)
brew install oxipng jpegoptim pngquant svgo
```

## Sources
- https://github.com/clroot/slimg
- https://github.com/nucliweb/optimo
- https://github.com/picminjs/picmin
- https://sharp.pixelplumbing.com/performance
- https://github.com/jwagner/smartcrop-cli
- https://github.com/garystafford/ai-image-cropper-v2
