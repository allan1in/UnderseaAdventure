// Pack a Cocos Creator 3.8 Web Mobile build into a self-contained HTML file.
// Preserve the project's loading page and embed all runtime resources.
const fs = require('fs');
const path = require('path');

const buildDir = path.resolve(process.argv[2] || path.join(__dirname, '..', 'build', 'web-mobile'));
const output = path.resolve(process.argv[3] || path.join(buildDir, '..', 'undersea-adventure-single.html'));

function filesUnder(dir, prefix = '') {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const name = prefix ? `${prefix}/${entry.name}` : entry.name;
        return entry.isDirectory() ? filesUnder(path.join(dir, entry.name), name) : [name];
    });
}

function escapeScript(source) {
    return source.replace(/<\/script/gi, '<\\/script');
}

// Cocos can emit CCON binary data under .bin while requesting .cconb at runtime.
for (const name of filesUnder(buildDir).filter(name => name.endsWith('.bin'))) {
    const bytes = fs.readFileSync(path.join(buildDir, name));
    if (bytes.subarray(0, 4).toString() === 'CCON') {
        const alias = path.join(buildDir, name.replace(/\.bin$/, '.cconb'));
        if (!fs.existsSync(alias)) fs.writeFileSync(alias, bytes);
    }
}
const all = filesUnder(buildDir).sort();
const scripts = all.filter(name => name.endsWith('.js') && !name.startsWith('loading/') && !['src/polyfills.bundle.js', 'src/system.bundle.js'].includes(name));
const binary = all.filter(name => !['index.html', 'style.css', 'favicon.svg', 'src/import-map.json'].includes(name) && !name.endsWith('.map') && (!name.endsWith('.js') || /^assets\/[^/]+\/index/.test(name)));
const payload = Object.fromEntries(binary.map(name => [name, fs.readFileSync(path.join(buildDir, name)).toString('base64')]));

const boot = String.raw`
(function () {
  const payload = __PAYLOAD__;
  const base = new URL('.', location.href);
  const blobs = Object.create(null);
  const mime = {json:'application/json',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',ogg:'audio/ogg',mp3:'audio/mpeg',wav:'audio/wav',wasm:'application/wasm',js:'text/javascript',svg:'image/svg+xml'};
  function keyFor(input) {
    if (typeof input !== 'string' && !(input instanceof URL)) return null;
    try {
      const url = new URL(String(input), base);
      if (url.protocol !== base.protocol || url.host !== base.host) return null;
      const prefix = decodeURIComponent(base.pathname);
      const pathname = decodeURIComponent(url.pathname);
      return pathname.startsWith(prefix) ? pathname.slice(prefix.length) : null;
    } catch (_) { return null; }
  }
  function blobFor(input) {
    const key = keyFor(input);
    if (!key || !Object.prototype.hasOwnProperty.call(payload, key)) return null;
    if (!blobs[key]) {
      const raw = atob(payload[key]);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      const type = mime[key.split('.').pop().toLowerCase()] || 'application/octet-stream';
      blobs[key] = URL.createObjectURL(new Blob([bytes], { type }));
    }
    return blobs[key];
  }
  window.__vurl = function (name) { return new URL(name, base).href; };
  window.__packedFileCount = Object.keys(payload).length;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const replaced = blobFor(input instanceof Request ? input.url : input);
    return nativeFetch(replaced || input, init);
  };
  const nativeOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    const args = Array.prototype.slice.call(arguments);
    args[1] = blobFor(url) || url;
    return nativeOpen.apply(this, args);
  };
  function patchSrc(prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'src');
    if (!descriptor || !descriptor.set) return;
    Object.defineProperty(prototype, 'src', {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      get: descriptor.get,
      set(value) { return descriptor.set.call(this, blobFor(value) || value); }
    });
  }
  patchSrc(HTMLImageElement.prototype);
  patchSrc(HTMLMediaElement.prototype);
  patchSrc(HTMLScriptElement.prototype);
  const nativeSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    if (name.toLowerCase() === 'src') value = blobFor(value) || value;
    return nativeSetAttribute.call(this, name, value);
  };
})();`;

let html = fs.readFileSync(path.join(buildDir, 'index.html'), 'utf8');
html = html.replace(/<title>[\s\S]*?<\/title>/i, '<title>海底冒险</title>');
html = html.replace(/<link\b[^>]*href="([^"]+)"[^>]*>/gi, (tag, file) => {
    const name = file.replace(/^\.\//, '');
    if (name.endsWith('.css')) {
        let css = fs.readFileSync(path.join(buildDir, name), 'utf8');
        css = css.replace(/url\((['"]?)([^)'"\s]+)\1\)/g, (match, quote, url) => {
            if (/^(data:|https?:)/.test(url)) return match;
            const target = path.posix.normalize(path.posix.join(path.posix.dirname(name), url));
            if (!payload[target]) throw new Error('Missing CSS asset: ' + target);
            return `url("data:image/png;base64,${payload[target]}")`;
        });
        return '<style>' + css + '</style>';
    }
    return tag;
});
html = html.replace(/<img\b[^>]*>/gi, tag => tag.replace(/src="([^"]+)"/i, (attr, file) => {
    const name = file.replace(/^\.\//, '');
    if (!payload[name]) throw new Error('Missing loading image: ' + name);
    return `src="data:image/png;base64,${payload[name]}"`;
}));
html = html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<\/body>[\s\S]*$/i, '');
html += `<script>${escapeScript(boot.replace('__PAYLOAD__', JSON.stringify(payload)))}</script>`;
html += `<script>${escapeScript(fs.readFileSync(path.join(buildDir, 'src/polyfills.bundle.js'), 'utf8'))}</script>`;
html += `<script>${escapeScript(fs.readFileSync(path.join(buildDir, 'src/system.bundle.js'), 'utf8'))}</script>`;
html += `<script type="systemjs-importmap">{"imports":{"cc":"./cocos-js/cc.js"}}</script>`;

for (const name of scripts) {
    let source = fs.readFileSync(path.join(buildDir, name), 'utf8');
    const anonymous = /^\s*System\.register\(\s*(?:\[|function|\()/m.test(source);
    if (anonymous) {
        source = source.replace(/System\.register\(/, `System.register(__vurl(${JSON.stringify(name)}),`);
    }
    html += `<script>${escapeScript(source)}</script>`;
    if (!anonymous) {
        html += `<script>System.register(__vurl(${JSON.stringify(name)}),[],function(){return{execute:function(){}}});</script>`;
    }
}
html += `<script>${escapeScript(fs.readFileSync(path.join(buildDir, 'loading/loading.js'), 'utf8'))}</script>`;
html += `<script>System.import(__vurl('index.js')).catch(function(error){console.error(error);document.body.insertAdjacentHTML('beforeend','<pre style="color:red">'+String(error)+'</pre>')})</script></body></html>`;
fs.writeFileSync(output, html);
console.log(`Packed ${all.length} files, ${binary.length} payloads into ${output} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MiB)`);
