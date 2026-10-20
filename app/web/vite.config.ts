/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * Configuração de build da interface (Vite): gera wwwroot com o cabeçalho de autoria nos arquivos JS.
 */
import { defineConfig } from 'vite';

// Cabeçalho de autoria em cada arquivo JS gerado (o código das bibliotecas mantém os créditos originais).
const banner = '/*\n * Cube4Notes\n * Author: Roberto Ritter\n * Studio: Cube4Code\n * Website: https://cube4code.com\n * Copyright (c) 2026 Roberto Ritter\n */';

export default defineConfig({
  build: { outDir: '../wwwroot', emptyOutDir: true, chunkSizeWarningLimit: 4000, target: 'es2022', },
  plugins: [{
    name: 'cube4code-cabecalho',
    enforce: 'post',
    generateBundle(_, bundle) {
      for (const f of Object.values(bundle)) if (f.type === 'chunk') f.code = banner + '\n' + f.code;
    },
  }],
  server: { proxy: { '/api': 'http://localhost:43125' } },
});
