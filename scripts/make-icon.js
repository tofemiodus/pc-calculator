'use strict';

// Generates build/icon.png (512x512) with no external image dependencies.
// Run with: node scripts/make-icon.js

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const SIZE = 512;
const SS = 4; // supersampling per axis for anti-aliasing

const INK = [23, 27, 32];
const CREAM = [242, 241, 236];

const R = 96;
const LEFT = 148;
const RIGHT = 368;
const TOP = 132;
const BOTTOM = 380;
const BAR = 46;
const MID_X = 258;
const MID_Y = 256;

function insideRounded(x, y) {
  if (x < 0 || y < 0 || x > SIZE || y > SIZE) return false;
  const cx = Math.min(Math.max(x, R), SIZE - R);
  const cy = Math.min(Math.max(y, R), SIZE - R);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= R * R;
}

function insideRect(x, y, x0, y0, x1, y1) {
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function segmentPolygon(x1, y1, x2, y2, width) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (width / 2);
  const ny = (dx / len) * (width / 2);
  return [
    [x1 + nx, y1 + ny],
    [x2 + nx, y2 + ny],
    [x2 - nx, y2 - ny],
    [x1 - nx, y1 - ny],
  ];
}

function insidePolygon(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const DIAG_W = BAR * 0.82;
const glyphShapes = [
  (x, y) => insideRect(x, y, LEFT, TOP, RIGHT, TOP + BAR),
  (x, y) => insideRect(x, y, LEFT, BOTTOM - BAR, RIGHT, BOTTOM),
  (x, y) => insidePolygon(x, y, segmentPolygon(LEFT + BAR * 0.5, TOP + BAR * 0.5, MID_X, MID_Y, DIAG_W)),
  (x, y) => insidePolygon(x, y, segmentPolygon(LEFT + BAR * 0.5, BOTTOM - BAR * 0.5, MID_X, MID_Y, DIAG_W)),
];

const glyphAt = (x, y) => glyphShapes.some((shape) => shape(x, y));

const pixels = Buffer.alloc(SIZE * SIZE * 4);

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let bg = 0;
    let fg = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const px = x + (sx + 0.5) / SS;
        const py = y + (sy + 0.5) / SS;
        if (!insideRounded(px, py)) continue;
        bg++;
        if (glyphAt(px, py)) fg++;
      }
    }
    const total = SS * SS;
    const alpha = bg / total;
    const colour = bg === 0 ? INK : [0, 1, 2].map((i) => INK[i] + ((CREAM[i] - INK[i]) * fg) / bg);
    const o = (y * SIZE + x) * 4;
    pixels[o] = Math.round(colour[0]);
    pixels[o + 1] = Math.round(colour[1]);
    pixels[o + 2] = Math.round(colour[2]);
    pixels[o + 3] = Math.round(alpha * 255);
  }
}

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0; // filter: none
  pixels.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
};

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const outDir = path.join(__dirname, '..', 'build');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon.png'), png);
console.log(`Wrote build/icon.png (${SIZE}x${SIZE}, ${(png.length / 1024).toFixed(1)} KiB)`);
