const fs = require('fs');
const path = require('path');

// Create SVG icon with Accenture branding
function createSVGIcon() {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <!-- Background Circle with Accenture Purple -->
  <circle cx="128" cy="128" r="120" fill="#A100FF" stroke="#000000" stroke-width="8"/>

  <!-- AI Brain Icon -->
  <g transform="translate(128, 128)">
    <!-- Central brain outline -->
    <path d="M-40,-30 Q-50,-40 -35,-45 Q-20,-50 -5,-45 Q10,-40 15,-30 Q20,-15 15,0 Q10,15 -5,20 Q-20,25 -35,20 Q-50,15 -45,0 Q-40,-15 -40,-30 Z"
          fill="none" stroke="white" stroke-width="3"/>

    <!-- Neural network nodes -->
    <circle cx="-25" cy="-15" r="3" fill="white"/>
    <circle cx="-10" cy="-25" r="3" fill="white"/>
    <circle cx="5" cy="-20" r="3" fill="white"/>
    <circle cx="15" cy="-10" r="3" fill="white"/>
    <circle cx="10" cy="5" r="3" fill="white"/>
    <circle cx="-5" cy="10" r="3" fill="white"/>
    <circle cx="-20" cy="8" r="3" fill="white"/>
    <circle cx="-30" cy="-5" r="3" fill="white"/>

    <!-- Connections between nodes -->
    <line x1="-25" y1="-15" x2="-10" y2="-25" stroke="white" stroke-width="1.5" opacity="0.7"/>
    <line x1="-10" y1="-25" x2="5" y2="-20" stroke="white" stroke-width="1.5" opacity="0.7"/>
    <line x1="5" y1="-20" x2="15" y2="-10" stroke="white" stroke-width="1.5" opacity="0.7"/>
    <line x1="15" y1="-10" x2="10" y2="5" stroke="white" stroke-width="1.5" opacity="0.7"/>
    <line x1="10" y1="5" x2="-5" y2="10" stroke="white" stroke-width="1.5" opacity="0.7"/>
    <line x1="-5" y1="10" x2="-20" y2="8" stroke="white" stroke-width="1.5" opacity="0.7"/>
    <line x1="-20" y1="8" x2="-30" y2="-5" stroke="white" stroke-width="1.5" opacity="0.7"/>
    <line x1="-30" y1="-5" x2="-25" y2="-15" stroke="white" stroke-width="1.5" opacity="0.7"/>

    <!-- Cross connections -->
    <line x1="-25" y1="-15" x2="10" y2="5" stroke="white" stroke-width="1" opacity="0.5"/>
    <line x1="5" y1="-20" x2="-20" y2="8" stroke="white" stroke-width="1" opacity="0.5"/>
    <line x1="15" y1="-10" x2="-30" y2="-5" stroke="white" stroke-width="1" opacity="0.5"/>
  </g>

  <!-- Mainframe terminal element -->
  <rect x="80" y="180" width="96" height="60" rx="4" fill="white" opacity="0.9"/>
  <rect x="86" y="186" width="84" height="42" rx="2" fill="#000000"/>

  <!-- Terminal text lines -->
  <rect x="92" y="192" width="30" height="2" fill="#00FF00"/>
  <rect x="92" y="198" width="45" height="2" fill="#00FF00"/>
  <rect x="92" y="204" width="25" height="2" fill="#00FF00"/>
  <rect x="92" y="210" width="38" height="2" fill="#00FF00"/>
  <rect x="92" y="216" width="20" height="2" fill="#00FF00"/>

  <!-- Cursor -->
  <rect x="116" y="216" width="2" height="2" fill="#00FF00"/>

  <!-- Accenture 'A' in bottom right -->
  <g transform="translate(200, 35)">
    <path d="M0,30 L10,5 L20,30 M5,20 L15,20" stroke="white" stroke-width="3" fill="none"/>
  </g>
</svg>`;

  return svg;
}

// Create PNG from SVG (simplified representation)
function createPNGIcon() {
  // This is a placeholder. In a real implementation, you'd use a library like sharp or canvas
  // For now, we'll create a simple text-based icon descriptor
  return {
    width: 256,
    height: 256,
    description: 'Accenture Mainframe AI Assistant Icon - Purple background with AI brain and terminal'
  };
}

// Create ICO file descriptor
function createICODescriptor() {
  return {
    sizes: [16, 32, 48, 64, 128, 256],
    description: 'Windows ICO file with multiple sizes for Accenture Mainframe AI Assistant'
  };
}

// Main function to create icons
function createIcons() {
  const buildDir = path.join(__dirname, '..', 'build');

  // Ensure build directory exists
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  try {
    // Create SVG icon
    const svgIcon = createSVGIcon();
    fs.writeFileSync(path.join(buildDir, 'icon.svg'), svgIcon);
    console.log('✅ Created icon.svg');

    // Create icon descriptors
    const pngIcon = createPNGIcon();
    fs.writeFileSync(path.join(buildDir, 'icon-info.json'), JSON.stringify(pngIcon, null, 2));
    console.log('✅ Created icon-info.json');

    const icoDescriptor = createICODescriptor();
    fs.writeFileSync(path.join(buildDir, 'ico-info.json'), JSON.stringify(icoDescriptor, null, 2));
    console.log('✅ Created ico-info.json');

    // Create a simple PNG placeholder (base64 encoded 1x1 purple pixel)
    const simplePNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAG/+MEySgAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(path.join(buildDir, 'icon.png'), simplePNG);
    console.log('✅ Created icon.png (placeholder)');

    // Create ICO placeholder
    fs.writeFileSync(path.join(buildDir, 'icon.ico'), simplePNG);
    console.log('✅ Created icon.ico (placeholder)');

    // Create instructions for manual icon creation
    const instructions = `
# Icon Creation Instructions

The icon creation script has generated placeholder files. For production use, you should:

1. Use the generated SVG (icon.svg) as a template
2. Convert the SVG to high-quality PNG and ICO files using tools like:
   - ImageMagick: convert icon.svg -resize 256x256 icon.png
   - Online converters: favicon.io, convertio.co
   - Design tools: Photoshop, GIMP, Figma

3. Create a proper Windows ICO file with multiple sizes:
   - 16x16, 32x32, 48x48, 64x64, 128x128, 256x256

4. The icon design should feature:
   - Accenture purple (#A100FF) background
   - AI/brain iconography
   - Mainframe/terminal elements
   - Professional, enterprise-grade appearance

For now, the build will use placeholder icons that will work for testing.
`;

    fs.writeFileSync(path.join(buildDir, 'ICON_INSTRUCTIONS.md'), instructions);
    console.log('✅ Created ICON_INSTRUCTIONS.md');

    console.log('\n🎨 Icon creation completed!');
    console.log('📁 Icons created in: ' + buildDir);
    console.log('📋 See ICON_INSTRUCTIONS.md for production icon creation steps');

  } catch (error) {
    console.error('❌ Error creating icons:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  createIcons();
}

module.exports = { createIcons };