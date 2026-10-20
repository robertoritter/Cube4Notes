/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * Service worker do Cube4Notes: guarda a interface para abrir sem servidor. As notas ficam no IndexedDB.
 */
const CACHE = 'c4n-shell-v2';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/', '/manifest.webmanifest', '/brand/cube4notes.png', '/brand/cube4code-symbol.png'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  if (u.pathname.startsWith('/assets/')) {
    // arquivos com hash: cache primeiro
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const c = res.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return res; })));
    return;
  }
  // página e demais: rede primeiro, cache se offline
  const key = e.request.mode === 'navigate' ? '/' : e.request;
  e.respondWith(fetch(e.request).then(res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(key, c)); } return res; }).catch(() => caches.match(key)));
});
