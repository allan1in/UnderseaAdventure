(() => {
  const splash = document.getElementById('splash');
  if (!splash) return;
  const bar = splash.querySelector('.progress-bar span');
  const meter = splash.querySelector('[role="progressbar"]');
  const message = document.getElementById('loading-message');
  const percent = document.getElementById('loading-percent');
  let completed = false, progress = 0;
  function update(value, text) {
    if (completed) return;
    progress = Math.max(progress, Math.min(100, Math.round(value)));
    const width = progress + '%';
    if (bar.style.width !== width) bar.style.width = width;
    meter.setAttribute('aria-valuenow', String(progress));
    percent.textContent = progress + '%';
    if (text) message.textContent = text;
  }
  const observer = new MutationObserver(() => {
    const value = parseFloat(bar.style.width);
    if (Number.isFinite(value)) update(value, value >= 100 ? '准备出发！' : '正在加载海底世界…');
  });
  observer.observe(bar, { attributes: true, attributeFilter: ['style'] });
  async function finish() {
    if (completed) return;
    const cc = await System.import('cc');
    // Keep the loading screen until scene components receive their cached assets.
    await new Promise(resolve => {
      const check = () => {
        const world = cc.director.getScene()?.getChildByName('Canvas')?.getChildByName('World');
        const hero = world?.getChildByName('Hero')?.getComponent('HeroEvolution');
        if (world?.getComponent('PetSystem')?.assetsReady && world.getComponent('BossBattleSystem')?.bossPrefab &&
            [1, 2, 3].every(i => (i === 1 && hero?.stageTwoSkeleton) || (i === 2 && hero?.stageThreeSkeleton) || (i === 3 && hero?.stageFourSkeleton) || (hero?.themeIdleClips[i] && hero?.themeRunClips[i] && hero?.themeAttackClips[i]))) resolve();
        else requestAnimationFrame(check);
      };
      check();
    });
    update(100, '准备出发！'); completed = true; observer.disconnect();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      splash.classList.add('loading-complete');
      setTimeout(() => { splash.style.display = 'none'; }, 250);
    }));
  }
  window.UnderseaLoading = { update, finish };
  // The template runs after Cocos's import map is installed, before bootstrap completes.
  if (window.System) System.import('cc').then(cc => {
    cc.director.once(cc.Director.EVENT_AFTER_SCENE_LAUNCH, finish);
    if (cc.director.getScene()) { finish(); return; }
    // Preview must preload deferred dependencies too, before launching gameplay.
    // The editor may still hold an older scene with empty prefab references.
    {
      cc.game.onPostProjectInitDelegate.add(() => new Promise((resolve, reject) => {
        const scene = cc.settings.querySettings('launch', 'launchScene');
        if (!scene) { resolve(); return; }
        cc.director.preloadScene(scene, (loaded, total) => {
          if (total > 0) update(loaded / total * 70, '正在加载海底世界…');
        }, error => {
          if (error) { reject(error); return; }
          const paths = ['gameplay/deferred', 'gameplay/hero/stage01-rig', 'gameplay/hero/stage02-rig', 'gameplay/hero/stage03-rig', 'gameplay/hero/stage04-rig'];
          let finished = 0;
          Promise.all(paths.map(path => new Promise((done, fail) => {
            cc.resources.loadDir(path, (loaded, total) => {
              if (total > 0) update(70 + (finished + loaded / total) / paths.length * 29, '正在加载海底世界…');
            }, error => { if (error) fail(error); else { finished++; done(); } });
          }))).then(resolve, reject);
        });
      }));
    }
  }).catch(error => {
    message.textContent = '资源加载失败'; console.error(error);
  });
})();
