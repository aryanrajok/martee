// generate-icons.js
// Run with: node generate-icons.js
// Generates PNG icons from SVG using sharp (if available) or saves SVGs directly.

const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir);

// SVG source — Cartee logo: dark bg + gradient lightning bolt
const svgTemplate = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#0d0d2b"/>
      <stop offset="100%" stop-color="#1a1a3e"/>
    </linearGradient>
    <linearGradient id="bolt" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <!-- Background -->
  <rect width="128" height="128" rx="22" fill="url(#bg)"/>
  <!-- Glow circle -->
  <circle cx="64" cy="64" r="42" fill="rgba(99,102,241,0.15)"/>
  <!-- Lightning bolt -->
  <polygon points="72,18 44,68 62,68 54,110 88,56 68,56" fill="url(#bolt)" filter="url(#glow)"/>
</svg>`;

const sizes = [16, 32, 48, 128];

sizes.forEach(size => {
    const svgPath = path.join(iconsDir, `icon${size}.svg`);
    fs.writeFileSync(svgPath, svgTemplate(size));
    console.log(`✅ Created icon${size}.svg`);
});

console.log('\n⚠️  SVG icons created. Chrome accepts PNG icons.');
console.log('To convert: install sharp with  npm install sharp  then run this script again,');
console.log('or manually export each SVG to PNG using a tool like Inkscape, Figma, or svg2png.\n');

// Try to convert with sharp if available
try {
    const sharp = require('sharp');
    const promises = sizes.map(size => {
        const svgPath = path.join(iconsDir, `icon${size}.svg`);
        const pngPath = path.join(iconsDir, `icon${size}.png`);
        return sharp(svgPath).resize(size, size).png().toFile(pngPath)
            .then(() => console.log(`🖼️  icon${size}.png generated`));
    });
    Promise.all(promises).then(() => console.log('\n✅ All PNG icons generated!'));
} catch {
    console.log('sharp not found — SVG files saved. Chrome will use them as fallback or convert manually.');
}
