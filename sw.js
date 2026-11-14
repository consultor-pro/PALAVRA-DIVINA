// Service worker: deixa o app funcionando sem internet (GitHub Pages / instalado na tela inicial)
const CACHE = 'palavra-divina-v1';
const ARQUIVOS = ['./', './index.html', './dados.js', './glossario.js', './biblia.js', './manifest.json',
  './icon-192.png', './icon-512.png', './icon-180.png', './biblia-blivre.json', './biblia-nbv.json'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  // Rede primeiro para o código (pega atualizações), cache primeiro para as Bíblias
  if (/biblia-.*\.json$/.test(url.pathname)) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  } else {
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(k => k.put(e.request, c)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
  }
});
