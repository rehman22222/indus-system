// Generates the Expo app-icon PNGs from the INDUS "H" monogram (no design tool
// needed). Run:  node scripts/make-icons.cjs
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const assets = path.join(__dirname, '..', 'assets');
fs.mkdirSync(assets, { recursive: true });

// Full-bleed icon: brand-red gradient + crisp white H with a soft sheen.
const iconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#D8313F"/>
      <stop offset="1" stop-color="#8E1620"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <path d="M0 280 Q0 0 280 0 H744 Q1024 0 1024 280 V410 Q512 250 0 410 Z" fill="#FFFFFF" opacity="0.10"/>
  <rect x="300" y="262" width="124" height="500" rx="34" fill="#FFFFFF"/>
  <rect x="600" y="262" width="124" height="500" rx="34" fill="#FFFFFF"/>
  <rect x="300" y="450" width="424" height="124" rx="20" fill="#FFFFFF"/>
</svg>`;

// Android adaptive foreground: white H centered in the safe zone, transparent bg
// (adaptiveIcon.backgroundColor supplies the red).
const adaptiveSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect x="392" y="356" width="92" height="312" rx="20" fill="#FFFFFF"/>
  <rect x="540" y="356" width="92" height="312" rx="20" fill="#FFFFFF"/>
  <rect x="392" y="466" width="240" height="92" fill="#FFFFFF"/>
</svg>`;

function render(svg, size) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
}

fs.writeFileSync(path.join(assets, 'icon.png'), render(iconSvg, 1024));
fs.writeFileSync(path.join(assets, 'adaptive-icon.png'), render(adaptiveSvg, 1024));
fs.writeFileSync(path.join(assets, 'favicon.png'), render(iconSvg, 196));
fs.writeFileSync(path.join(assets, 'splash-icon.png'), render(adaptiveSvg, 1024));
console.log('Wrote icon.png, adaptive-icon.png, favicon.png, splash-icon.png to assets/');
