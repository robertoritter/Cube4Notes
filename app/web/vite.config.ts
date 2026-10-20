/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * Configuração de build da interface (Vite): gera wwwroot com o cabeçalho de autoria nos arquivos JS e
 * preenche no service worker a lista de arquivos para o app abrir sem servidor.
 */
import { defineConfig } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

let files: string[] = [];

// Cabeçalho de autoria em cada arquivo JS gerado (o código das bibliotecas mantém os créditos originais).
const banner = '/*\n * Cube4Notes\n * Author: Roberto Ritter\n * Studio: Cube4Code\n * Website: https://cube4code.com\n * Copyright (c) 2026 Roberto Ritter\n */';

export default defineConfig({
  build: { outDir: '../wwwroot', emptyOutDir: true, chunkSizeWarningLimit: 4000, target: 'es2022', },
  plugins: [{
    name: 'cube4code-cabecalho',
    enforce: 'post',
    generateBundle(_, bundle) {
      for (const f of Object.values(bundle)) if (f.type === 'chunk') f.code = banner + '\n' + f.code;
      files = Object.keys(bundle).filter(n => !n.endsWith('.map') && n !== 'index.html').map(n => '/' + n);
    },
    // depois de copiar public/: grava no sw.js a lista de arquivos e uma versão que muda a cada build diferente
    closeBundle() {
      const out = resolve(__dirname, '../wwwroot/sw.js');
      const list = [...files, '/brand/cube4notes.png', '/brand/cube4code-symbol.png', '/brand/favicon.png', '/brand/icon-180.png', '/brand/icon-192.png'].sort();
      const version = createHash('sha256').update(list.join('\n')).digest('hex').slice(0, 10);
      writeFileSync(out, readFileSync(out, 'utf8').replace("'__C4N_VERSION__'", JSON.stringify(version)).replace('__C4N_FILES__', JSON.stringify(list)));
    },
  }],
  server: { proxy: { '/api': 'http://localhost:43125' } },
});
