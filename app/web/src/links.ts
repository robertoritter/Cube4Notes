/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * Links entre notas em Markdown padrão ([texto](pasta/nota.md)), relativos à nota, para continuarem
 * funcionando em qualquer editor. Resolve, cria e reescreve links quando notas, pastas ou anexos mudam de lugar.
 */
const dirOf = (p: string) => p.split('/').slice(0, -1).join('/');
const baseName = (p: string) => p.split('/').pop()!.replace(/\.md$/i, '');
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Link externo, âncora ou caminho absoluto: não é um arquivo do vault.
export const isExternal = (href: string) => !href || /^([a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(href);

// Caminho no vault a partir do link escrito numa nota (sem acrescentar .md).
export function resolveRef(fromNote: string, href: string): string | null {
  if (isExternal(href)) return null;
  let p = href.replace(/^<|>$/g, '').split('#')[0];
  try { p = decodeURIComponent(p); } catch {}
  if (!p) return null;
  const parts = (dirOf(fromNote) ? dirOf(fromNote) + '/' + p : p).split('/');
  const out: string[] = [];
  for (const s of parts) { if (s === '..') { if (!out.length) return null; out.pop(); } else if (s && s !== '.') out.push(s); }
  return out.join('/') || null;
}

// Caminho relativo da nota "from" até "target".
export function relPath(fromNote: string, target: string): string {
  const from = dirOf(fromNote).split('/').filter(Boolean);
  const to = target.split('/');
  let i = 0;
  while (i < from.length && i < to.length - 1 && from[i] === to[i]) i++;
  return '../'.repeat(from.length - i) + to.slice(i).join('/');
}

// Codifica para o Markdown: espaços e parênteses não quebram o link.
export const encodeHref = (rel: string) => rel.split('/').map(s => (s === '..' ? s : encodeURIComponent(s).replace(/\(/g, '%28').replace(/\)/g, '%29'))).join('/');

export const noteLink = (fromNote: string, target: string) => encodeHref(relPath(fromNote, target));

// Reescreve os links de uma nota quando ela própria ou o que ela aponta mudou de lugar.
// oldSelf/newSelf: caminho da nota antes e depois; remap: caminho antigo -> novo (null se não mudou).
export function rewriteLinks(content: string, oldSelf: string, newSelf: string, remap: (p: string) => string | null, renamedNote?: { from: string; to: string }): string {
  const selfMoved = dirOf(oldSelf) !== dirOf(newSelf);
  let fence = false;
  const lines = content.split('\n');
  let changed = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; continue; }
    if (fence) continue;
    let next = line.replace(/(!?)\[([^\]\n]*)\]\((<[^>\n]*>|[^)\s]+)((?:\s+"[^"]*")?\))/g, (all, bang: string, label: string, href: string, close: string) => {
      const angle = href.startsWith('<');
      const target = resolveRef(oldSelf, href);
      if (!target) return all;
      const moved = remap(target);
      if (!moved && !selfMoved) return all;
      const finalTarget = moved ?? target;
      const frag = href.replace(/^<|>$/g, '').includes('#') ? '#' + href.replace(/^<|>$/g, '').split('#').slice(1).join('#') : '';
      const rel = relPath(newSelf, finalTarget);
      // texto do link igual ao nome antigo da nota: passa a mostrar o nome novo
      const text = !bang && renamedNote && moved === renamedNote.to && label === baseName(renamedNote.from) ? baseName(renamedNote.to) : label;
      return `${bang}[${text}](` + (angle ? '<' + rel + frag + '>' : encodeHref(rel) + frag) + close;
    });
    // [[Nome]] escrito à mão (de outros editores) acompanha a renomeação da nota
    if (renamedNote && baseName(renamedNote.from) !== baseName(renamedNote.to)) {
      const old = fold(baseName(renamedNote.from));
      next = next.replace(/\[\[([^\]|#\n]+)([^\]\n]*)\]\]/g, (all, name: string, rest: string) => (fold(name.trim()) === old ? `[[${baseName(renamedNote.to)}${rest}]]` : all));
    }
    if (next !== line) { lines[i] = next; changed = true; }
  }
  return changed ? lines.join('\n') : content;
}

// Função de remapeamento para mover um arquivo ou uma pasta inteira.
export function mover(from: string, to: string): (p: string) => string | null {
  return p => (p === from ? to : p.startsWith(from + '/') ? to + p.slice(from.length) : null);
}
