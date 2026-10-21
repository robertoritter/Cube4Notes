/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * Editor visual de Markdown (Milkdown Crepe) configurado para o Cube4Notes: menu /, barras de formatação,
 * imagens e PDFs guardados no aparelho (funcionam sem servidor) e serialização próxima do Markdown escrito à mão.
 */
import { Crepe } from '@milkdown/crepe';
import { editorViewCtx, remarkStringifyOptionsCtx } from '@milkdown/kit/core';
import { uploadConfig } from '@milkdown/kit/plugin/upload';
import { remarkGFMPlugin } from '@milkdown/kit/preset/gfm';
import '@milkdown/crepe/theme/common/prosemirror.css';
import '@milkdown/crepe/theme/common/reset.css';
import '@milkdown/crepe/theme/common/block-edit.css';
import '@milkdown/crepe/theme/common/code-mirror.css';
import '@milkdown/crepe/theme/common/cursor.css';
import '@milkdown/crepe/theme/common/image-block.css';
import '@milkdown/crepe/theme/common/link-tooltip.css';
import '@milkdown/crepe/theme/common/list-item.css';
import '@milkdown/crepe/theme/common/placeholder.css';
import '@milkdown/crepe/theme/common/toolbar.css';
import '@milkdown/crepe/theme/common/table.css';
import '@milkdown/crepe/theme/common/top-bar.css';
import { t, lang } from './i18n';
import { rawUrl, addAttachment, ATTACHMENT_TYPES } from './store';

export interface EditorHandle { destroy(): void; getMarkdown(): string; focus(): void; view(): any; }

// '| - | - |' é válido em GFM, mas '| --- |' é o que as pessoas escrevem.
const tidy = (md: string) => md.replace(/^\|(?:\s*:?-+:?\s*\|)+\s*$/gm, row => row.replace(/:?-+:?/g, c => (c.startsWith(':') ? ':' : '-') + '-' + (c.endsWith(':') ? ':' : '-')));
const safeDecode = (u: string) => { try { return decodeURIComponent(u); } catch { return u; } };
const isRelative = (u: string) => !!u && !/^([a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(u);

export async function mountEditor(el: HTMLElement, markdown: string, opts: { topBar: boolean; onChange: (md: string) => void; notePath: string; readonly?: boolean; onAttachmentError?: (why: 'size' | 'type', name: string) => void }): Promise<EditorHandle> {
  const pt = lang === 'pt-BR';
  const dir = opts.notePath.split('/').slice(0, -1).join('/');
  const resolveRel = (u: string) => {
    const parts = (dir ? dir + '/' + u : u).split('/');
    const out: string[] = [];
    for (const p of parts) { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); }
    return out.join('/');
  };
  // caminho relativo à nota, para o Markdown continuar funcionando fora do Cube4Notes
  const relative = (p: string) => '../'.repeat(dir ? dir.split('/').length : 0) + p.split('/').map(x => encodeURIComponent(x).replace(/\(/g, '%28').replace(/\)/g, '%29')).join('/');
  const upload = async (file: File) => {
    try { return relative(await addAttachment(file)); }
    catch (e: any) { opts.onAttachmentError?.(e?.code === 'size' ? 'size' : 'type', file.name); return ''; }
  };
  const crepe = new Crepe({
    root: el,
    defaultValue: markdown,
    features: { [Crepe.Feature.Latex]: false, [Crepe.Feature.TopBar]: opts.topBar },
    featureConfigs: {
      [Crepe.Feature.Placeholder]: { text: t.placeholder, mode: 'block' },
      [Crepe.Feature.ImageBlock]: {
        onUpload: upload, inlineOnUpload: upload, blockOnUpload: upload,
        proxyDomURL: (u: string) => (isRelative(u) ? rawUrl(resolveRel(safeDecode(u))).catch(() => '') : /^(https?:|data:image\/|blob:)/i.test(u) ? u : ''),
        ...(pt ? { inlineUploadButton: 'Enviar', inlineUploadPlaceholderText: 'ou cole o link', blockUploadButton: 'Enviar arquivo', blockUploadPlaceholderText: 'ou cole o link da imagem', blockCaptionPlaceholderText: 'Legenda', blockConfirmButton: 'OK', inlineConfirmButton: 'OK' } : {}),
      },
      [Crepe.Feature.LinkTooltip]: pt ? { inputPlaceholder: 'Cole ou digite um link…' } : {},
      [Crepe.Feature.CodeMirror]: pt ? { searchPlaceholder: 'Buscar linguagem', noResultText: 'Nenhuma linguagem', copyText: 'Copiar', previewToggleText: (p: boolean) => (p ? 'Editar' : 'Ocultar') } as any : {},
      [Crepe.Feature.Toolbar]: pt ? { boldLabel: 'Negrito', italicLabel: 'Itálico', strikethroughLabel: 'Tachado', codeLabel: 'Código', linkLabel: 'Link' } as any : {},
      [Crepe.Feature.TopBar]: pt ? { headingOptions: [{ label: 'Parágrafo', level: null }, { label: 'Título 1', level: 1 }, { label: 'Título 2', level: 2 }, { label: 'Título 3', level: 3 }, { label: 'Título 4', level: 4 }] } : {},
      [Crepe.Feature.BlockEdit]: pt ? {
        textGroup: { label: 'Texto', text: { label: 'Parágrafo' }, h1: { label: 'Título 1' }, h2: { label: 'Título 2' }, h3: { label: 'Título 3' }, h4: { label: 'Título 4' }, h5: { label: 'Título 5' }, h6: { label: 'Título 6' }, quote: { label: 'Citação' }, divider: { label: 'Divisória' } },
        listGroup: { label: 'Listas', bulletList: { label: 'Lista com marcadores' }, orderedList: { label: 'Lista numerada' }, taskList: { label: 'Lista de tarefas' } },
        advancedGroup: { label: 'Mais', image: { label: 'Imagem' }, codeBlock: { label: 'Bloco de código' }, table: { label: 'Tabela' }, math: null },
      } as any : { advancedGroup: { math: null } } as any,
    },
  });
  // Serialização próxima do Markdown escrito à mão: '-' em listas, tabelas sem preenchimento.
  crepe.editor.config(ctx => {
    ctx.update(remarkStringifyOptionsCtx, prev => ({ ...prev, bullet: '-', rule: '-', listItemIndent: 'one', fences: true, incrementListMarker: true } as typeof prev));
    ctx.set(remarkGFMPlugin.options.key, { tablePipeAlign: false });
    // Colar ou arrastar arquivos: imagens viram imagem (como o Crepe já faz), PDFs viram um link para o arquivo.
    ctx.update(uploadConfig.key, prev => ({
      ...prev,
      uploader: async (files, schema, ctx2, pos) => {
        const got = await prev.uploader(files, schema, ctx2, pos);
        const images: any[] = Array.isArray(got) ? got : 'forEach' in got && !('type' in got) ? (() => { const a: any[] = []; (got as any).forEach((n: any) => a.push(n)); return a; })() : [got];
        const others: any[] = [];
        for (let i = 0; i < files.length; i++) {
          const f = files.item(i);
          if (!f || f.type.includes('image')) continue;
          const ext = (/\.[^.]+$/.exec(f.name)?.[0] || '').toLowerCase();
          if (!ATTACHMENT_TYPES.includes(ext)) { opts.onAttachmentError?.('type', f.name); continue; }
          const href = await upload(f);
          if (!href) continue;
          const link = schema.marks.link?.create({ href });
          others.push(schema.nodes.paragraph.create(null, schema.text(f.name, link ? [link] : [])));
        }
        return [...images, ...others].filter(Boolean);
      },
    }));
  });
  let ready = false;
  crepe.on(l => l.markdownUpdated((_ctx, md) => { if (ready) opts.onChange(tidy(md)); }));
  await crepe.create();
  if (opts.readonly) crepe.setReadonly(true); // modelo travado: só para ver
  ready = true;
  return {
    destroy: () => { crepe.destroy(); },
    getMarkdown: () => tidy(crepe.getMarkdown()),
    focus: () => { try { crepe.editor.action(ctx => ctx.get(editorViewCtx).focus()); } catch {} },
    view: () => { let v: any; crepe.editor.action(ctx => { v = ctx.get(editorViewCtx); }); return v; },
  };
}
