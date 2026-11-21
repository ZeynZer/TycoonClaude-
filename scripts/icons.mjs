// Génère les icônes PNG à partir du SVG (via Chromium/Playwright préinstallé).
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_PATH ?? import.meta.url);
const { chromium } = require('playwright');
import { readFileSync } from 'node:fs';
const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
async function render(size, file, pad = 0, bg = 'transparent') {
  await page.setViewportSize({ width: size, height: size });
  const inner = size - pad * 2;
  await page.setContent(`<html><body style="margin:0;background:${bg};display:grid;place-items:center;width:${size}px;height:${size}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</body></html>`);
  await page.screenshot({ path: new URL(`../public/${file}`, import.meta.url).pathname, omitBackground: bg === 'transparent' });
}
await render(192, 'pwa-192.png');
await render(512, 'pwa-512.png');
await render(512, 'pwa-maskable-512.png', 56, '#5a5fe6');
await render(180, 'apple-touch-icon.png', 0, '#3a63d8');
await browser.close();
console.log('icônes générées');
