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
  function finish() {
    if (completed) return;
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
    // Preview already reports scene progress through the span. Web builds preload
    // their launch scene using the engine's real resource progress callback.
    if (!document.querySelector('.toolbar')) {
      cc.game.onPostProjectInitDelegate.add(() => new Promise((resolve, reject) => {
        const scene = cc.settings.querySettings('launch', 'launchScene');
        if (!scene) { resolve(); return; }
        cc.director.preloadScene(scene, (loaded, total) => {
          if (total > 0) update(loaded / total * 100, '正在加载海底世界…');
        }, error => error ? reject(error) : resolve());
      }));
    }
  }).catch(error => {
    message.textContent = '加载失败，请刷新重试'; console.error(error);
  });
})();
