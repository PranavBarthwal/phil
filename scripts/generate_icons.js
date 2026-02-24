/**
 * generate_icons.js
 * Generates PNG icons for the extension using the Canvas API (Node + canvas package).
 * Run: node generate_icons.js
 * Requires: npm install canvas
 */

const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");

const sizes = [16, 48, 128];
const outDir = path.join(__dirname, "..", "icons");

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

sizes.forEach((size) => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // Background gradient – purple
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, "#667eea");
  grad.addColorStop(1, "#764ba2");

  // Rounded rect background
  const r = size * 0.22;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Sparkle emoji / text
  const emoji = "✨";
  const fontSize = Math.round(size * 0.55);
  ctx.font = `${fontSize}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, size / 2, size / 2 + size * 0.04);

  const buffer = canvas.toBuffer("image/png");
  const outPath = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(outPath, buffer);
  console.log(`Generated: ${outPath}`);
});

console.log("✅ All icons generated.");
