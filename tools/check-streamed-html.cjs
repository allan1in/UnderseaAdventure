const fs = require('fs');
const http = require('http');
const assert = require('assert/strict');
const { chromium } = require('C:/Users/LIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const html = fs.readFileSync('build/undersea-adventure-single.html');
const boundary = html.indexOf('<script id="packed-game"') + 8192;
let downloadFinished = false;
const server = http.createServer((req, res) => {
  if (req.url !== '/') { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': html.length });
  res.write(html.subarray(0, boundary));
  setTimeout(() => { downloadFinished = true; res.end(html.subarray(boundary)); }, 3000);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    if (process.argv.includes('--fallback')) await page.addInitScript(() => { window.DecompressionStream = undefined; });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && !message.text().includes('404')) errors.push(message.text()); });
    const navigation = page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.underseaTimings);
    assert.equal(downloadFinished, false);
    assert.equal(await page.locator('#loading-percent').textContent(), '0%');
    assert.notEqual(await page.locator('#loading-message').textContent(), '资源加载失败');
    await navigation;
    await page.waitForFunction(() => !!window.__underseaReady, null, { timeout: 120000 });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ streamedDownload: true, waitedForCompletePayload: true, ready: true, fallback: process.argv.includes('--fallback'), errors }));
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
