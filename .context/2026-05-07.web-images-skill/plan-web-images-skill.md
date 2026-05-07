---
status: completed
date: 2026-05-07
subject: 2026-05-07.web-images-skill
topics: [web-images, imagemagick, pi-skill, image-optimization, chezmoi, packages]
research: [research-cli-image-tools.md]
memory: [web-images-skill-2026-05-07.md]
---

# Plan: Create web-images Pi Skill

## Goal

Create a Pi skill for editing and optimizing images for web projects. ImageMagick handles all editing; optional tools (oxipng, jpegoptim, pngquant, svgo) handle optimization.

## Implementation

### 1. Create skill directory
- `~/.pi/agent/skills/web-images/` — standard Pi skills location
- Subdirs: `scripts/`, `references/` (created, not yet populated with scripts)

### 2. Write SKILL.md

Full skill covering:
- **ImageMagick commands**: crop, resize, convert, strip metadata, composite, batch
- **Format decision guide**: when to use WebP, JPEG, PNG, SVG
- **Quality recommendations**: per format with use cases
- **Web dimensions reference table**: hero, content, thumbnail, avatar, OG, Twitter
- **Smart crop**: ImageMagick trim, note smartcrop-cli for future
- **Batch operations**: resize all, convert all, optimize all
- **Composite/watermark**: overlay and text annotations
- **Responsive images**: generate srcset sizes
- **Optimization pipeline**: step-by-step for "optimize for web"
- **Helper scripts**: scripts/optimize.sh, scripts/smart-crop.sh (described, not implemented yet)
- **When to ask**: smart crop target, quality vs. size, format choice, transparency

**Trigger phrases**: crop, resize, optimize, web images, convert image format, prepare images, batch process images

### 3. Add packages to chezmoi packages.yaml

Added to all four platforms:
- `linux.pacman.core`: oxipng, jpegoptim, pngquant, svgo
- `linux.aur`: same four (mirrors pacman)
- `linux_server.apt.core`: imagemagick (tree/build-essential were accidentally dropped and restored)
- `darwin.brew.core`: oxipng, jpegoptim, pngquant, svgo

### 4. Not done (deferred)
- `scripts/optimize.sh` — batch optimize script
- `scripts/smart-crop.sh` — entropy-based smart crop script
- `references/` — ImageMagick quick reference card

## Verification

- [x] Skill loads: placed at `~/.pi/agent/skills/web-images/SKILL.md`
- [x] Description is specific enough for Pi to auto-trigger
- [x] Packages added to packages.yaml for all platforms
- [ ] Scripts directory created but empty — add later if needed
- [ ] Skill not yet tested with a real image editing request

## Next Steps
- Test the skill with a real image editing task
- Consider adding scripts/optimize.sh and scripts/smart-crop.sh
- Consider adding references/imagemagick-web.md as a quick reference
