// Generates the Expo app-icon PNGs from the INDUS "H" monogram (no design tool
// needed). Requires @resvg/resvg-js (one-off):  npm i -D @resvg/resvg-js
// Run:  node scripts/make-icons.cjs
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const assets = path.join(__dirname, '..', 'assets');
fs.mkdirSync(assets, { recursive: true });

const DEFS = `
  <defs>
    <linearGradient id="bg" x1="150" y1="60" x2="900" y2="980" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#E5404C"/>
      <stop offset=".55" stop-color="#C11F2C"/>
      <stop offset="1" stop-color="#7E1019"/>
    </linearGradient>
    <radialGradient id="sheen" cx="305" cy="225" r="660" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".30"/>
      <stop offset=".55" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vignette" cx="512" cy="560" r="640" gradientUnits="userSpaceOnUse">
      <stop offset=".7" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#3A060B" stop-opacity=".28"/>
    </radialGradient>
    <linearGradient id="hg" x1="512" y1="262" x2="512" y2="762" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#FFE7EB"/>
    </linearGradient>
  </defs>`;

// The glossy "H" monogram with a soft drop shadow (offset darker copy).
const HMARK = `
  <g fill="#56090F" opacity=".24" transform="translate(0,14)">
    <rect x="300" y="266" width="124" height="496" rx="42"/>
    <rect x="600" y="266" width="124" height="496" rx="42"/>
    <rect x="300" y="446" width="424" height="124" rx="38"/>
  </g>
  <g fill="url(#hg)">
    <rect x="300" y="260" width="124" height="496" rx="42"/>
    <rect x="600" y="260" width="124" height="496" rx="42"/>
    <rect x="300" y="440" width="424" height="124" rx="38"/>
  </g>`;

// Full-bleed icon (iOS + fallback): gradient, sheen, faint heartbeat pulse, vignette, H.
const iconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  ${DEFS}
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect width="1024" height="1024" fill="url(#sheen)"/>
  <path d="M120 824 H360 l44 -128 64 250 58 -190 40 96 H904" fill="none"
        stroke="#ffffff" stroke-opacity=".11" stroke-width="20"
        stroke-linecap="round" stroke-linejoin="round"/>
  ${HMARK}
  <rect width="1024" height="1024" fill="url(#vignette)"/>
</svg>`;

// Android adaptive foreground: full-bleed gradient + H (the OS masks it to the
// device shape), so Android matches the glossy iOS look. H stays in the safe zone.
const adaptiveSvg = iconSvg;

// Splash mark: the glossy H on a transparent background (sits on any splash colour).
const splashSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  ${DEFS}
  ${HMARK}
</svg>`;

function render(svg, size) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
}

fs.writeFileSync(path.join(assets, 'icon.png'), render(iconSvg, 1024));
fs.writeFileSync(path.join(assets, 'adaptive-icon.png'), render(adaptiveSvg, 1024));
fs.writeFileSync(path.join(assets, 'favicon.png'), render(iconSvg, 196));
fs.writeFileSync(path.join(assets, 'splash-icon.png'), render(splashSvg, 1024));
console.log('Wrote icon.png, adaptive-icon.png, favicon.png, splash-icon.png to assets/');
