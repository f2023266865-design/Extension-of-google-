// Generate simple solid-color PNG icons for Chrome Web Store submission
// Creates 16x16, 48x48, and 128x128 PNGs with the brand color (#5b5df1)
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

// Brand color #5b5df1 with a rounded-square "AI" look
const R = 91, G = 93, B = 241;

function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const combined = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(combined));
  return Buffer.concat([len, combined, crc]);
}

function createPNG(size) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);  // width
  ihdr.writeUInt32BE(size, 4);  // height
  ihdr.writeUInt8(8, 8);        // bit depth
  ihdr.writeUInt8(2, 9);        // color type (RGB)
  ihdr.writeUInt8(0, 10);       // compression
  ihdr.writeUInt8(0, 11);       // filter
  ihdr.writeUInt8(0, 12);       // interlace

  // Image data: rounded rectangle with "AI" letter shape
  const raw = Buffer.alloc(size * (size * 3 + 1)); // +1 for filter byte per row
  const radius = Math.floor(size * 0.2);
  
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 3 + 1);
    raw[rowStart] = 0; // no filter
    for (let x = 0; x < size; x++) {
      const px = rowStart + 1 + x * 3;
      
      // Check if inside rounded rectangle
      const margin = Math.floor(size * 0.06);
      const inRect = x >= margin && x < size - margin && y >= margin && y < size - margin;
      
      let inRounded = false;
      if (inRect) {
        const ix = x - margin, iy = y - margin;
        const w = size - margin * 2, h = size - margin * 2;
        const r = radius;
        
        // Check corners
        if (ix < r && iy < r) { // top-left
          inRounded = ((ix - r) ** 2 + (iy - r) ** 2) <= r * r;
        } else if (ix >= w - r && iy < r) { // top-right
          inRounded = ((ix - (w - r)) ** 2 + (iy - r) ** 2) <= r * r;
        } else if (ix < r && iy >= h - r) { // bottom-left
          inRounded = ((ix - r) ** 2 + (iy - (h - r)) ** 2) <= r * r;
        } else if (ix >= w - r && iy >= h - r) { // bottom-right
          inRounded = ((ix - (w - r)) ** 2 + (iy - (h - r)) ** 2) <= r * r;
        } else {
          inRounded = true;
        }
      }
      
      if (inRounded) {
        // Draw "AI" text region - white letter shapes on purple background
        const cx = (x - margin) / (size - margin * 2); // 0-1 normalized
        const cy = (y - margin) / (size - margin * 2);
        
        let isLetter = false;
        
        if (size >= 48) {
          // "A" letter (left side: 0.15-0.45)
          const ax = (cx - 0.15) / 0.30; // normalize within A region
          if (cx >= 0.15 && cx <= 0.45 && cy >= 0.25 && cy <= 0.75) {
            const peak = 0.5; // center of A
            const halfW = 0.15 + (cy - 0.25) * 0.35; // A gets wider toward bottom
            if (Math.abs(ax - 0.5) >= (0.5 - halfW * 0.6) && Math.abs(ax - 0.5) <= (0.5 - halfW * 0.6 + 0.25)) {
              isLetter = true;
            }
            // A crossbar
            if (cy >= 0.52 && cy <= 0.58 && cx >= 0.20 && cx <= 0.40) {
              isLetter = true;
            }
            // A legs
            const triX = (cx - 0.30);
            const triY = (cy - 0.25) / 0.50;
            const legW = 0.04 + triY * 0.06;
            if (Math.abs(triX - triY * 0.12) < legW || Math.abs(triX + triY * 0.12) < legW) {
              isLetter = true;
            }
          }
          
          // "I" letter (right side: simple vertical bar)
          if (cx >= 0.58 && cx <= 0.68 && cy >= 0.25 && cy <= 0.75) {
            isLetter = true;
          }
          // I serifs
          if (cx >= 0.53 && cx <= 0.73 && ((cy >= 0.25 && cy <= 0.32) || (cy >= 0.68 && cy <= 0.75))) {
            isLetter = true;
          }
        }
        
        if (isLetter) {
          raw[px] = 255; raw[px + 1] = 255; raw[px + 2] = 255; // white
        } else {
          raw[px] = R; raw[px + 1] = G; raw[px + 2] = B; // brand purple
        }
      } else {
        raw[px] = 0; raw[px + 1] = 0; raw[px + 2] = 0; // transparent (black bg)
      }
    }
  }

  const compressed = zlib.deflateSync(raw);
  const idatData = compressed;

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', idatData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

for (const size of [16, 48, 128]) {
  const png = createPNG(size);
  const path = join(outDir, `icon${size}.png`);
  writeFileSync(path, png);
  console.log(`Created ${path} (${png.length} bytes)`);
}

console.log('Done! Icons generated.');
