/**
 * generate_icons_svg.js
 * Generates simple PNG icons using pure Node.js (no dependencies).
 * Creates minimal valid PNGs via raw pixel data.
 * Run: node scripts/generate_icons_svg.js
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const outDir = path.join(__dirname, "..", "icons");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

/**
 * Creates a minimal PNG with a gradient purple background and a white "✦" star.
 */
function createPNG(size) {
  const pixels = [];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Gradient: top-left purple → bottom-right deep purple
      const t = (x + y) / (2 * size);
      const r = Math.round(102 + t * (118 - 102));
      const g = Math.round(126 + t * (75 - 126));
      const b = Math.round(234 + t * (162 - 234));

      // Draw simple sparkle cross in the centre
      const cx = size / 2;
      const cy = size / 2;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const arm =
        (Math.abs(x - cx) < size * 0.06 && dist < size * 0.38) ||
        (Math.abs(y - cy) < size * 0.06 && dist < size * 0.38) ||
        (Math.abs(x - cx - (y - cy)) < size * 0.055 && dist < size * 0.26) ||
        (Math.abs(x - cx + (y - cy)) < size * 0.055 && dist < size * 0.26);

      // Rounded corner mask
      const cornerR = size * 0.22;
      const inBounds =
        (x >= cornerR || y >= cornerR) &&
        (x <= size - cornerR || y >= cornerR) &&
        (x >= cornerR || y <= size - cornerR) &&
        (x <= size - cornerR || y <= size - cornerR);

      // Simple corner rounding check
      const corners = [
        [cornerR, cornerR],
        [size - cornerR, cornerR],
        [cornerR, size - cornerR],
        [size - cornerR, size - cornerR],
      ];
      let inCorner = false;
      for (const [cx2, cy2] of corners) {
        if (Math.sqrt((x - cx2) ** 2 + (y - cy2) ** 2) < cornerR) {
          if (
            (x < cornerR || x > size - cornerR) &&
            (y < cornerR || y > size - cornerR)
          ) {
            inCorner = true;
          }
        }
      }

      // Actually check if pixel is inside the rounded rect
      const inRoundedRect = isInRoundedRect(x, y, 0, 0, size, size, cornerR);

      let pr = r, pg = g, pb = b, pa = 255;
      if (!inRoundedRect) {
        pa = 0;
      } else if (arm) {
        pr = 255; pg = 255; pb = 255;
      }

      pixels.push(pr, pg, pb, pa);
    }
  }

  return encodePNG(size, size, pixels);
}

function isInRoundedRect(x, y, rx, ry, rw, rh, r) {
  if (x < rx || x >= rx + rw || y < ry || y >= ry + rh) return false;

  const corners = [
    [rx + r, ry + r],
    [rx + rw - r, ry + r],
    [rx + r, ry + rh - r],
    [rx + rw - r, ry + rh - r],
  ];

  // Only corners need checking; edges are always inside
  if (x < rx + r && y < ry + r) return dist(x, y, corners[0]) < r;
  if (x >= rx + rw - r && y < ry + r) return dist(x, y, corners[1]) < r;
  if (x < rx + r && y >= ry + rh - r) return dist(x, y, corners[2]) < r;
  if (x >= rx + rw - r && y >= ry + rh - r) return dist(x, y, corners[3]) < r;
  return true;
}

function dist(x, y, [cx, cy]) {
  return Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
}

// ── Minimal PNG encoder ────────────────────────────────────────────────────────

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const ihdrChunk = makeChunk("IHDR", ihdr);

  // Raw image data
  const rawRows = [];
  for (let y = 0; y < height; y++) {
    rawRows.push(0); // filter type = None
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      rawRows.push(rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]);
    }
  }
  const compressed = zlib.deflateSync(Buffer.from(rawRows));
  const idatChunk = makeChunk("IDAT", compressed);

  // IEND
  const iendChunk = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, "ascii");
  const crc = crc32(Buffer.concat([typeBuffer, data]));
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// CRC32 implementation
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ── Generate ────────────────────────────────────────────────────────────────

[16, 48, 128].forEach((size) => {
  const png = createPNG(size);
  const outPath = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`✅ Generated: ${outPath} (${png.length} bytes)`);
});
