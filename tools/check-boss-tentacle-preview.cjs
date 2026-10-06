const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('C:/Users/LIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
    const browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.goto(pathToFileURL(path.resolve(__dirname, '../../主题素材/海底冒险/previews/boss-tentacle-animation.html')).href);
        await page.waitForFunction(() => window.animationReady);
        for (let i = 0; i < 16; i++) {
            await page.locator('#scrub').evaluate((slider, index) => {
                slider.value = index; slider.dispatchEvent(new Event('input'));
            }, i);
            await page.waitForFunction(index => document.querySelector('#status').textContent === '第 '+(index+1)+' / 16 帧', i);
        }
        await page.locator('#scrub').evaluate(slider => {
            slider.value = 5; slider.dispatchEvent(new Event('input'));
        });
        await page.waitForFunction(() => document.querySelector('#status').textContent === '第 6 / 16 帧');
        await page.screenshot({ path: path.resolve(__dirname, '../temp/animation-fix/tentacle-animation-preview.png') });
        await page.locator('#play').click();
        await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('预警'));
        await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('第 '));
        if (errors.length) throw Error(errors.join('\n'));
        console.log(JSON.stringify({ frames: 16, decoded: true, scrub: true, warningAndPlayback: true, errors }));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
