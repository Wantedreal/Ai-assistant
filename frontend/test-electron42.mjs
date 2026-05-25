/**
 * Electron 42 launch test — verifies the app starts, renders, and has no
 * console errors after the security upgrades.
 * Run:  node test-electron42.mjs
 */
import { _electron as electron } from 'playwright-core';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR   = __dirname;
const SHOT_DIR  = path.join(APP_DIR, 'test-shots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const electronBin = path.join(APP_DIR, 'node_modules', 'electron', 'dist', 'electron.exe');

const errors   = [];
const warnings = [];

console.log('Launching Electron 42…');
const app = await electron.launch({
  executablePath: electronBin,
  args: ['.'],
  env: {
    ...process.env,
    ELECTRON_DEV: 'true',          // skip backend binary — use already-running uvicorn
  },
  timeout: 40_000,
});

// Capture console errors from the renderer
app.on('window', w => {
  w.on('console', msg => {
    const text = msg.text();
    // Filter Playwright CDP false positives — Electron doesn't implement Chrome Autofill
    if (text.includes("Autofill.enable") || text.includes("Autofill.setAddresses")) return;
    if (msg.type() === 'error')   errors.push(text);
    if (msg.type() === 'warning') warnings.push(text);
  });
});

// Wait for the loading splash to finish and the real UI to appear
console.log('Waiting for backend health + UI…');
await new Promise(r => setTimeout(r, 20_000));

const windows = app.windows();
console.log(`\nWindows open: ${windows.length}`);
for (const w of windows) console.log(' ', w.url());

const page = windows.find(w => !w.url().startsWith('devtools://')) ?? windows[0];

if (!page) {
  console.error('No window found — app may have crashed');
  await app.close();
  process.exit(1);
}

// Screenshot the main window
const shot1 = path.join(SHOT_DIR, '01-startup.png');
await page.screenshot({ path: shot1 });
console.log(`\nScreenshot saved: ${shot1}`);

// Check the page has actual React content
const title = await page.evaluate(() => document.title).catch(() => '(error)');
const hasGrid = await page.evaluate(() => !!document.querySelector('.bento-grid, #root > *')).catch(() => false);
const hasCanvas = await page.evaluate(() => !!document.querySelector('canvas')).catch(() => false);
const webglOk = await page.evaluate(() => {
  const c = document.createElement('canvas');
  return !!(c.getContext('webgl2') || c.getContext('webgl'));
}).catch(() => false);
console.log(`Page title: ${title}`);
console.log(`Bento grid rendered: ${hasGrid}`);
console.log(`Three.js canvas present: ${hasCanvas}`);
console.log(`WebGL available: ${webglOk}`);

// Print console errors
if (errors.length) {
  console.log(`\nConsole ERRORS (${errors.length}):`);
  errors.forEach(e => console.log(' ✗', e));
} else {
  console.log('\nNo console errors ✓');
}

if (warnings.length) {
  console.log(`\nConsole warnings (${warnings.length}):`);
  warnings.slice(0, 5).forEach(w => console.log(' !', w));
}

await app.close();

console.log('\n--- RESULT ---');
if (errors.length === 0 && hasGrid && webglOk) {
  console.log('PASS — Electron 42 launched, UI rendered, WebGL working, no console errors');
  process.exit(0);
} else {
  if (!webglOk) console.log('FAIL — WebGL not available (GPU sandbox may be blocking it)');
  if (!hasGrid) console.log('FAIL — UI did not render');
  if (errors.length) console.log('FAIL — console errors present');
  process.exit(1);
}
