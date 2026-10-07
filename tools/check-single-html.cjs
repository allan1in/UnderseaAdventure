const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { pathToFileURL } = require('url');
const { chromium } = require('C:/Users/LIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const project = path.resolve(__dirname, '..');
const requested = process.argv[2] || path.join(project, 'build/undersea-adventure-single.html');
const remote = /^https?:/.test(requested);
const input = remote ? requested : path.resolve(requested);
const out = path.join(project, 'build/verification');
fs.mkdirSync(out, { recursive: true });
(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [], external = [];
    page.on('pageerror', e => errors.push(e.stack));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    // Any HTTP dependency fails this standalone/offline check.
    await page.route(/^https?:/, route => {
        const url = route.request().url();
        if (remote && new URL(url).origin === new URL(input).origin) return route.continue();
        external.push(url); return route.abort();
    });
    try {
        await page.goto(remote ? input : pathToFileURL(input).href, { waitUntil: 'load', timeout: 180000 });
        await page.evaluate(async () => { window.cc = await System.import('cc'); });
        await page.waitForFunction(() => window.cc?.director.getScene()?.getChildByName('Canvas')?.getChildByName('World')?.getChildByName('Hero'), { timeout: 120000 });
        await page.waitForTimeout(1500);
        const initial = await page.evaluate(() => {
            const canvas = cc.director.getScene().getChildByName('Canvas'), world = canvas.getChildByName('World');
            const battle = world.getComponent('BossBattleSystem'), music = canvas.getComponent('MusicDirector');
            window.testGame = { canvas, world, battle, music, hero: world.getChildByName('Hero') };
            return { time: battle.runningTime, enemies: world.children.filter(n => n.getComponent('EnemyController')).length,
                sources: [music.backgroundMusic, music.bossMusic, music.ambience].map(s => ({ clip: !!s.clip, playing: s.playing, loop: s.loop, volume: s.volume })),
                packedFiles: window.__packedFileCount, loadingHidden: getComputedStyle(document.getElementById('splash')).display === 'none' };
        });
        assert.equal(initial.time, 0); assert.equal(initial.enemies, 0); assert(initial.sources.every(s => s.clip && s.loop && !s.playing)); assert(initial.loadingHidden);
        await page.screenshot({ path: path.join(out, 'standalone-start.png') });
        const before = await page.evaluate(() => ({ x: testGame.hero.position.x, y: testGame.hero.position.y }));
        await page.mouse.move(800, 490); await page.mouse.down(); await page.mouse.move(920, 460, { steps: 10 });
        await page.waitForTimeout(1800); await page.mouse.up();
        const playing = await page.evaluate(() => {
            const { hero, music, battle, world } = testGame;
            return { x: hero.position.x, y: hero.position.y, time: battle.runningTime,
                enemies: world.children.filter(n => n.getComponent('EnemyController')).length,
                music: music.backgroundMusic.playing, bubbles: music.ambience.playing, boss: music.bossMusic.playing };
        });
        assert(Math.hypot(playing.x - before.x, playing.y - before.y) > 10); assert(playing.time > 0); assert(playing.music && playing.bubbles && !playing.boss);
        await page.screenshot({ path: path.join(out, 'standalone-playing.png') });
        // Shorten only this test instance's timer to exercise the production spawn path.
        await page.evaluate(() => { testGame.battle.spawnAfter = 0; });
        await page.waitForFunction(() => testGame.battle.bossNode && testGame.music.bossMusic.playing);
        const boss = await page.evaluate(() => {
            const n = testGame.battle.bossNode, control = n.getComponent('BossController'), ranged = n.getComponent('BossRangedAttack'), music = testGame.music;
            return { health: control.maxHealth, melee: control.attackDamage, ranged: ranged.damage,
                normal: music.backgroundMusic.playing, boss: music.bossMusic.playing, bubbles: music.ambience.playing };
        });
        assert.equal(boss.health, 200); assert.equal(boss.melee, 5); assert.equal(boss.ranged, 5); assert(!boss.normal && boss.boss && boss.bubbles);
        await page.screenshot({ path: path.join(out, 'standalone-boss.png') });
        await page.evaluate(() => { testGame.battle.bossNode.emit('boss-defeated'); });
        await page.waitForTimeout(400);
        const victory = await page.evaluate(() => ({ complete: testGame.battle.isComplete, paused: cc.director.isPaused(),
            normal: testGame.music.backgroundMusic.playing, boss: testGame.music.bossMusic.playing, bubbles: testGame.music.ambience.playing }));
        assert(victory.complete && victory.paused && victory.normal && !victory.boss && victory.bubbles);
        await page.screenshot({ path: path.join(out, 'standalone-victory.png') });
        assert.deepEqual(external, []); assert.deepEqual(errors, []);
        const report = { file: input, bytes: remote ? null : fs.statSync(input).size, initial, playing, boss, victory, external, errors };
        fs.writeFileSync(path.join(out, remote ? 'vercel-report.json' : 'standalone-report.json'), JSON.stringify(report, null, 2));
        console.log(JSON.stringify(report, null, 2));
    } catch (e) { console.error(JSON.stringify({ errors, external })); await page.screenshot({ path: path.join(out, 'standalone-failure.png') }); throw e; }
    finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
