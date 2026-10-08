// Pack a Cocos Creator 3.8 Web Mobile build into a self-contained HTML file.
// Preserve the project's loading page and embed all runtime resources.
const fs = require('fs');
const path = require('path');

const buildDir = path.resolve(process.argv[2] || path.join(__dirname, '..', 'build', 'web-mobile'));
const output = path.resolve(process.argv[3] || path.join(buildDir, '..', 'undersea-adventure-single.html'));
const initialFiles = process.argv[4] ? new Set(JSON.parse(fs.readFileSync(process.argv[4], 'utf8'))) : null;

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
const all = filesUnder(buildDir).filter(name=>!['startup-files.json','startup.html','startup.html.gz','later-assets.json.gz'].includes(name)).sort();
const scripts = all.filter(name => name.endsWith('.js') && !name.startsWith('loading/') && !['src/polyfills.bundle.js', 'src/system.bundle.js'].includes(name));
const binary = all.filter(name => !['index.html', 'style.css', 'favicon.svg', 'src/import-map.json'].includes(name) && !name.endsWith('.map') && (!name.endsWith('.js') || /^assets\/[^/]+\/index/.test(name)));
const payload = Object.fromEntries(binary.filter(name => !initialFiles || initialFiles.has(name) || name.startsWith('loading/')).map(name => [name, fs.readFileSync(path.join(buildDir, name)).toString('base64')]));
const lateKeys = initialFiles ? binary.filter(name => !Object.hasOwn(payload,name)) : [];
if (initialFiles) {
    const late = Object.fromEntries(lateKeys.map(name=>[name,fs.readFileSync(path.join(buildDir,name)).toString('base64')]));
    fs.writeFileSync(path.join(buildDir,'later-assets.json.gz'),require('zlib').gzipSync(JSON.stringify(late),{level:9}));
}
const webpKeys = binary.filter(name => {
    const bytes = fs.readFileSync(path.join(buildDir, name));
    return bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
});

const boot = String.raw`
(function () {
  const payload = __PAYLOAD__;
  const lateKeys = new Set(__LATE_KEYS__);
  const webpKeys = new Set(__WEBP_KEYS__);
  const base = new URL('.', document.baseURI);
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
      const type = webpKeys.has(key) ? 'image/webp' : mime[key.split('.').pop().toLowerCase()] || 'application/octet-stream';
      blobs[key] = URL.createObjectURL(new Blob([bytes], { type }));
    }
    return blobs[key];
  }
  window.__vurl = function (name) { return new URL(name, base).href; };
  window.__packedFileCount = Object.keys(payload).length;

  const nativeFetch = window.fetch.bind(window);
  let latePromise;
  function loadLate(key) {
    if(!latePromise)console.debug('Undersea late assets requested',key,performance.now());
    return latePromise ||= nativeFetch(new URL('later-assets.json.gz',base)).then(response=>{
      if(!response.ok)throw Error('Later assets download failed');
      return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
    }).then(data=>{Object.assign(payload,data);}).catch(error=>{latePromise=null;throw error;});
  }
  window.fetch = function (input, init) {
    const key=keyFor(input instanceof Request ? input.url : input);
    if(lateKeys.has(key)&&!Object.prototype.hasOwnProperty.call(payload,key))return loadLate(key).then(()=>nativeFetch(blobFor(input instanceof Request ? input.url : input),init));
    const replaced = blobFor(input instanceof Request ? input.url : input);
    return nativeFetch(replaced || input, init);
  };
  const nativeOpen = XMLHttpRequest.prototype.open;
  const nativeSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    const args = Array.prototype.slice.call(arguments);
    args[1] = blobFor(url) || url;
    this.__underseaPending = lateKeys.has(keyFor(url)) && !Object.prototype.hasOwnProperty.call(payload,keyFor(url)) ? args : null;
    return nativeOpen.apply(this, args);
  };
  XMLHttpRequest.prototype.send = function () {
    const args=arguments,pending=this.__underseaPending;this.__underseaPending=null;
    if(!pending)return nativeSend.apply(this,args);
    loadLate(pending[1]).then(()=>{pending[1]=blobFor(pending[1]);nativeOpen.apply(this,pending);nativeSend.apply(this,args);}).catch(error=>{console.error(error);this.dispatchEvent(new Event('error'));});
  };
  function patchSrc(prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'src');
    if (!descriptor || !descriptor.set) return;
    Object.defineProperty(prototype, 'src', {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      get: descriptor.get,
      set(value) {
        const key=keyFor(value);
        if(lateKeys.has(key)&&!Object.prototype.hasOwnProperty.call(payload,key)){
          this.__underseaSrc=value;
          loadLate(value).then(()=>{if(this.__underseaSrc===value)descriptor.set.call(this,blobFor(value));}).catch(error=>{console.error(error);this.dispatchEvent(new Event('error'));});return;
        }
        this.__underseaSrc=value;return descriptor.set.call(this, blobFor(value) || value);
      }
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
if (initialFiles) html = html.replace('<head>', '<head><base href="__GAME_BASE__">');
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
html += `<script>${escapeScript(boot.replace('__PAYLOAD__', JSON.stringify(payload)).replace('__WEBP_KEYS__', JSON.stringify(webpKeys)).replace('__LATE_KEYS__', JSON.stringify(lateKeys)))}</script>`;
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
