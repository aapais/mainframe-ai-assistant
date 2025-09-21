const fs = require('fs');
const path = require('path');

// Create a 256x256 BMP file (simple Windows bitmap)
function createBMP() {
  const width = 256;
  const height = 256;
  const bytesPerPixel = 4; // RGBA
  const imageSize = width * height * bytesPerPixel;

  // BMP header (14 bytes)
  const fileHeader = Buffer.alloc(14);
  fileHeader.write('BM'); // Signature
  fileHeader.writeUInt32LE(14 + 40 + imageSize, 2); // File size
  fileHeader.writeUInt32LE(0, 6); // Reserved
  fileHeader.writeUInt32LE(14 + 40, 10); // Data offset

  // DIB header (40 bytes)
  const dibHeader = Buffer.alloc(40);
  dibHeader.writeUInt32LE(40, 0); // Header size
  dibHeader.writeInt32LE(width, 4); // Width
  dibHeader.writeInt32LE(-height, 8); // Height (negative for top-down)
  dibHeader.writeUInt16LE(1, 12); // Planes
  dibHeader.writeUInt16LE(32, 14); // Bits per pixel
  dibHeader.writeUInt32LE(0, 16); // Compression
  dibHeader.writeUInt32LE(imageSize, 20); // Image size
  dibHeader.writeInt32LE(2835, 24); // X pixels per meter
  dibHeader.writeInt32LE(2835, 28); // Y pixels per meter
  dibHeader.writeUInt32LE(0, 32); // Colors used
  dibHeader.writeUInt32LE(0, 36); // Important colors

  // Create image data (purple background with white A)
  const imageData = Buffer.alloc(imageSize);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;

      // Purple background (#A100FF)
      let b = 255, g = 0, r = 161, a = 255;

      // Draw a simple white "A" in center
      const cx = width / 2;
      const cy = height / 2;
      const size = 80;

      // Simple A shape
      if (x > cx - size/2 && x < cx + size/2 && y > cy - size && y < cy + size) {
        // Vertical lines of A
        if ((Math.abs(x - (cx - size/3)) < 10 && y > cy - size/2) ||
            (Math.abs(x - (cx + size/3)) < 10 && y > cy - size/2) ||
            // Horizontal bar
            (Math.abs(y - cy) < 10 && x > cx - size/3 && x < cx + size/3) ||
            // Top connection
            (Math.abs(y - (cy - size/2)) < 10 && Math.abs(x - cx) < size/3)) {
          b = 255; g = 255; r = 255; // White
        }
      }

      imageData[offset] = b;     // Blue
      imageData[offset + 1] = g; // Green
      imageData[offset + 2] = r; // Red
      imageData[offset + 3] = a; // Alpha
    }
  }

  return Buffer.concat([fileHeader, dibHeader, imageData]);
}

// Convert BMP to ICO format
function bmpToIco(bmpData) {
  // ICO header
  const icoHeader = Buffer.alloc(6);
  icoHeader.writeUInt16LE(0, 0); // Reserved
  icoHeader.writeUInt16LE(1, 2); // Type (1 for ICO)
  icoHeader.writeUInt16LE(1, 4); // Number of images

  // ICO directory entry
  const dirEntry = Buffer.alloc(16);
  dirEntry[0] = 0; // Width (0 = 256)
  dirEntry[1] = 0; // Height (0 = 256)
  dirEntry[2] = 0; // Color palette
  dirEntry[3] = 0; // Reserved
  dirEntry.writeUInt16LE(1, 4); // Color planes
  dirEntry.writeUInt16LE(32, 6); // Bits per pixel
  dirEntry.writeUInt32LE(bmpData.length, 8); // Image size
  dirEntry.writeUInt32LE(6 + 16, 12); // Image offset

  return Buffer.concat([icoHeader, dirEntry, bmpData]);
}

// Main function
function createIcons() {
  const buildDir = path.join(__dirname, '..', 'build');

  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  console.log('Creating 256x256 icons...');

  // Create BMP
  const bmpData = createBMP();

  // Save as BMP (can be used as icon)
  fs.writeFileSync(path.join(buildDir, 'icon.bmp'), bmpData);
  console.log('✅ Created icon.bmp (256x256)');

  // Convert to ICO
  const icoData = bmpToIco(bmpData.slice(14)); // Skip BMP file header
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoData);
  console.log('✅ Created icon.ico (256x256)');

  // Also save the BMP as PNG extension (Windows will handle it)
  fs.writeFileSync(path.join(buildDir, 'icon.png'), bmpData);
  console.log('✅ Created icon.png (256x256 BMP format)');

  console.log('\n✅ Successfully created 256x256 icons for Windows build!');
}

createIcons();