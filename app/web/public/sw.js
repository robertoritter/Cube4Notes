/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * Service worker do Cube4Notes: guarda a interface inteira no aparelho para o app abrir sem servidor
 * (na rua, sem Wi-Fi de casa). As notas ficam no IndexedDB. A lista de arquivos e a versão são preenchidas
 * no build (vite.config.ts).
 */
const VERSION = '__C4N_VERSION__';
const FILES = __C4N_FILES__;
const CACHE = 'c4n-shell-' + VERSION;
const SHELL = ['/', '/manifest.webmanifest'];
// Longe de casa o endereço do servidor não responde e a conexão pode demorar a falhar: espera pouco e usa o cache.
const WAIT = 2500;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(SHELL);
    // o resto (incluindo partes carregadas sob demanda, como destaque de código) um a um: uma falha não impede as outras
    await Promise.all(FILES.map(f => c.add(f).catch(() => {})));
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('c4n-shell-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())));

function network(request, key) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), WAIT);
  return fetch(request, { signal: ctl.signal }).then(res => {
    clearTimeout(timer);
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
    return res;
  }).catch(async err => {
    clearTimeout(timer);
    const hit = await caches.match(key);
    if (hit) return hit;
    throw err;
  });
}

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  if (u.pathname.startsWith('/assets/')) {
    // arquivos com hash no nome nunca mudam: cache primeiro
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const c = res.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return res; })));
    return;
  }
  // página e demais: rede primeiro (com tempo curto), cache se o servidor não responder
  e.respondWith(network(e.request, e.request.mode === 'navigate' ? '/' : e.request));
});
