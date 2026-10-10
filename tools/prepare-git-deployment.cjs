// Derive a small hosted loader and complete gzip package from the offline HTML.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'build/undersea-adventure-single.html'), 'utf8');
const pattern = /<script id="packed-game" type="application\/octet-stream">([A-Za-z0-9+/=]+)<\/script>/;
const match = html.match(pattern);
if (!match) throw Error('Missing complete embedded game');
const gzip = Buffer.from(match[1], 'base64');
const file = `game-${crypto.createHash('sha256').update(gzip).digest('hex').slice(0,12)}.gz`;
html = html.replace(pattern, '');
const start = html.indexOf("   if(document.readyState==='loading'){");
const end = html.indexOf('   let text;', start);
if (start < 0 || end < 0) throw Error('Unexpected loader format');
html = html.slice(0, start) + `   const response=await fetch('./${file}');
   if(!response.ok)throw Error('Game download failed: '+response.status);
   const reader=response.body.getReader(),chunks=[];let loaded=0;
   while(true){
    const {done,value}=await reader.read();if(done)break;
    chunks.push(value);loaded+=value.length;
    const progress=Math.min(75,Math.round(loaded/${gzip.length}*75));
    percent.textContent=progress+'%';bar.style.width=progress+'%';
    meter.setAttribute('aria-valuenow',String(progress));
   }
   const input=new Uint8Array(loaded);let offset=0;
   for(const chunk of chunks){input.set(chunk,offset);offset+=chunk.length;}
   chunks.length=0;window.underseaTimings.download=performance.now();
` + html.slice(end);
const out = path.join(root, 'public');
fs.mkdirSync(out, {recursive:true});
fs.writeFileSync(path.join(out, file), gzip);
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log(JSON.stringify({entryBytes:Buffer.byteLength(html),gameBytes:gzip.length,file}));
