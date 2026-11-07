const CACHE='lens-v4';
const CORE=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./vendor/html5-qrcode.min.js','./vendor/qrcode.js','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;let ce=new URL(e.request.url);if(ce.origin!==self.location.origin)return;e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).then(r=>{let cl=r.clone();caches.open(CACHE).then(ca=>ca.put(e.request,cl));return r}).catch(()=>caches.match('./index.html'))))});
