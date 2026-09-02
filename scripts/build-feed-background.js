// Regenerates public/feed_background.webp from public/feed_background.png.
//
// The source PNG is 2172x724 and 1.7MB. Two things make it far smaller with no
// visible loss in the Activity Hub panel that uses it:
//
//   1. Crop the top 22%. That band is dark dithered "smoke" whose noise
//      dominates the WebP encode, and the panel anchors the image with
//      `bg-bottom`, so it was never visible anyway.
//   2. Downscale to 1400px. The feed column is capped at 640px, so 1400 still
//      covers 2x retina; 2172 was ~3.4x oversampled.
//
// Result: 1.7MB -> ~114KB.
//
// Usage: node scripts/build-feed-background.js

const sharp = require('sharp')
const fs = require('fs')

const SRC = 'public/feed_background.png'
const OUT = 'public/feed_background.webp'
const CROP_TOP_RATIO = 0.22
const TARGET_WIDTH = 1400

async function main() {
  const { width, height } = await sharp(SRC).metadata()
  const top = Math.round(height * CROP_TOP_RATIO)

  await sharp(SRC)
    .extract({ left: 0, top, width, height: height - top })
    .resize({ width: TARGET_WIDTH })
    .webp({ quality: 80, effort: 6 })
    .toFile(OUT)

  const kb = (fs.statSync(OUT).size / 1024).toFixed(1)
  console.log(`${OUT}: ${kb} KB (from ${(fs.statSync(SRC).size / 1024).toFixed(1)} KB)`)
}

main().catch((err) => { console.error(err); process.exit(1) })
