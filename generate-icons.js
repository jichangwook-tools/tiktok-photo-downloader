// generate-icons.js - Run with Node.js to generate extension icons
// Usage: node generate-icons.js
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const sizes = [16, 48, 128];
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir);

sizes.forEach(size => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background gradient (dark rounded)
  const r = size * 0.18;
  ctx.beginPath();
  roundRect(ctx, 0, 0, size, size, r);
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#1a0008');
  grad.addColorStop(1, '#0d0d0d');
  ctx.fillStyle = grad;
  ctx.fill();

  // TikTok-style download arrow
  ctx.fillStyle = '#fe2c55';
  const cx = size / 2;
  const cy = size / 2;
  const s = size * 0.28;

  // Arrow body
  ctx.fillRect(cx - s * 0.25, cy - s * 0.5, s * 0.5, s * 0.8);

  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.5, cy + s * 0.15);
  ctx.lineTo(cx + s * 0.5, cy + s * 0.15);
  ctx.lineTo(cx, cy + s * 0.7);
  ctx.closePath();
  ctx.fill();

  // Base line
  ctx.fillStyle = '#25f4ee';
  ctx.fillRect(cx - s * 0.6, cy + s * 0.75, s * 1.2, s * 0.15);

  const buf = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(iconsDir, `icon-${size}.png`), buf);
  console.log(`Generated icon-${size}.png`);
});

function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
