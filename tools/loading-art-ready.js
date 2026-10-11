(() => {
  async function showArtwork() {
    const splash = document.getElementById('splash');
    if (!splash) return;
    const pictures = [...splash.querySelectorAll('.loading-content img')];
    await Promise.all(pictures.map(img => {
      if (typeof img.decode === 'function') return img.decode();
      if (img.complete && img.naturalWidth) return Promise.resolve();
      return new Promise((resolve, reject) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', reject, { once: true });
      });
    }));
    requestAnimationFrame(() => splash.classList.add('loading-art-ready'));
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => showArtwork().catch(console.error), { once: true });
  } else showArtwork().catch(console.error);
})();
