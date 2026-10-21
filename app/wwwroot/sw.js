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
const VERSION = "51787c1f02";
const FILES = ["/assets/apl-B4CMkyY2.js","/assets/asciiarmor-Df11BRmG.js","/assets/asn1-EdZsLKOL.js","/assets/asterisk-B-8jnY81.js","/assets/brainfuck-C4LP7Hcl.js","/assets/clike-B9uivgTg.js","/assets/clojure-BMjYHr_A.js","/assets/cmake-BQqOBYOt.js","/assets/cobol-CWcv1MsR.js","/assets/coffeescript-S37ZYGWr.js","/assets/commonlisp-DBKNyK5s.js","/assets/crystal-SjHAIU92.js","/assets/css-BnMrqG3P.js","/assets/cypher-C_CwsFkJ.js","/assets/d-pRatUO7H.js","/assets/diff-DbItnlRl.js","/assets/dockerfile-BKs6k2Af.js","/assets/dtd-DF_7sFjM.js","/assets/dylan-DwRh75JA.js","/assets/ebnf-CDyGwa7X.js","/assets/ecl-Cabwm37j.js","/assets/eiffel-CnydiIhH.js","/assets/elm-vLlmbW-K.js","/assets/erlang-BNw1qcRV.js","/assets/factor-kuTfRLto.js","/assets/fcl-Kvtd6kyn.js","/assets/forth-Ffai-XNe.js","/assets/fortran-DYz_wnZ1.js","/assets/gas-Bneqetm1.js","/assets/gherkin-heZmZLOM.js","/assets/groovy-D9Dt4D0W.js","/assets/haskell-Cw1EW3IL.js","/assets/haxe-H-WmDvRZ.js","/assets/http-DBlCnlav.js","/assets/idl-BEugSyMb.js","/assets/index-ADybNFdm.js","/assets/index-B0-nBiNT.js","/assets/index-B4lIiooy.js","/assets/index-BVn8eGil.js","/assets/index-Btcp7ROQ.js","/assets/index-BwffLOhD.js","/assets/index-BxuUbNK4.js","/assets/index-CJbb2SBE.js","/assets/index-CLoQcna2.js","/assets/index-CXShyAUY.js","/assets/index-CiMeZw-a.js","/assets/index-Cjc5sVY3.js","/assets/index-CvHev7T0.js","/assets/index-CzxvUsYU.js","/assets/index-DCzI7PRW.css","/assets/index-DX0M2JkO.js","/assets/index-DYB8krKi.js","/assets/index-Db9LrqHE.js","/assets/index-DkE8F7Pe.js","/assets/index-DkxqLrkF.js","/assets/index-EiKQK2CJ.js","/assets/index-RePfyR2Y.js","/assets/index-WHhfVaFM.js","/assets/index-vjPYVYcz.js","/assets/javascript-iXu5QeM3.js","/assets/jetbrains-mono-latin-ext-wght-normal-DBQx-q_a.woff2","/assets/jetbrains-mono-latin-wght-normal-B9CIFXIH.woff2","/assets/julia-DuME0IfC.js","/assets/literata-latin-ext-wght-italic-CC1SwlwQ.woff2","/assets/literata-latin-ext-wght-normal-BnEbWgdZ.woff2","/assets/literata-latin-wght-italic-Bm_GJfSc.woff2","/assets/literata-latin-wght-normal-DLxlUchJ.woff2","/assets/livescript-BwQOo05w.js","/assets/lua-VAEuO923.js","/assets/manrope-latin-ext-wght-normal-Ch3YOpNY.woff2","/assets/manrope-latin-wght-normal-DHIcAJRg.woff2","/assets/mathematica-DTrFuWx2.js","/assets/mbox-CNhZ1qSd.js","/assets/mirc-CjQqDB4T.js","/assets/mllike-CXdrOF99.js","/assets/modelica-Dc1JOy9r.js","/assets/mscgen-BA5vi2Kp.js","/assets/mumps-BT43cFF4.js","/assets/nginx-DdIZxoE0.js","/assets/nsis-LY0VT_u5.js","/assets/ntriples-BfvgReVJ.js","/assets/octave-Ck1zUtKM.js","/assets/oz-BzwKVEFT.js","/assets/pascal--L3eBynH.js","/assets/perl-CdXCOZ3F.js","/assets/pig-CevX1Tat.js","/assets/powershell-CFHJl5sT.js","/assets/properties-C78fOPTZ.js","/assets/protobuf-ChK-085T.js","/assets/pug-DeIclll2.js","/assets/puppet-DMA9R1ak.js","/assets/python-BuPzkPfP.js","/assets/q-pXgVlZs6.js","/assets/r-B6wPVr8A.js","/assets/rpm-CTu-6PCP.js","/assets/ruby-BK5aLJev.js","/assets/sas-B4kiWyti.js","/assets/scheme-C41bIUwD.js","/assets/shell-CjFT_Tl9.js","/assets/sieve-C3Gn_uJK.js","/assets/simple-mode-GW_nhZxv.js","/assets/smalltalk-CnHTOXQT.js","/assets/solr-DehyRSwq.js","/assets/sparql-DkYu6x3z.js","/assets/spreadsheet-BCZA_wO0.js","/assets/sql-D0XecflT.js","/assets/stex-C3f8Ysf7.js","/assets/stylus-B533Al4x.js","/assets/swift-BzpIVaGY.js","/assets/tcl-DVfN8rqt.js","/assets/textile-CnDTJFAw.js","/assets/tiddlywiki-DO-Gjzrf.js","/assets/tiki-DGYXhP31.js","/assets/toml-Bm5Em-hy.js","/assets/troff-wAsdV37c.js","/assets/ttcn-CfJYG6tj.js","/assets/ttcn-cfg-B9xdYoR4.js","/assets/turtle-B1tBg_DP.js","/assets/vb-CmGdzxic.js","/assets/vbscript-BuJXcnF6.js","/assets/velocity-D8B20fx6.js","/assets/verilog-C6RDOZhf.js","/assets/vhdl-lSbBsy5d.js","/assets/webidl-ZXfAyPTL.js","/assets/xquery-DzFWVndE.js","/assets/yacas-BJ4BC0dw.js","/assets/z80-Hz9HOZM7.js","/brand/cube4code-symbol.png","/brand/cube4notes.png","/brand/favicon.png","/brand/icon-180.png","/brand/icon-192.png"];
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
