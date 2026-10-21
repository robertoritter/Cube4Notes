/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * Modelos, tipos e relações entre notas. Tudo vem do próprio Markdown: "tipo:" e campos nas propriedades,
 * modelos são notas comuns na pasta modelos/ (ou templates/, em inglês), e uma relação é um campo cujo valor é o nome de outra nota
 * (empresa: Empresa Y) ou um link no texto. Calculado no aparelho, funciona offline.
 */
import { parseProps, serializeProps, noteProps, noteTags, splitFrontmatter, type Prop } from './props';
import { resolveRef } from './links';

// Pasta dos modelos: modelos/ ou templates/ (as duas valem; um vault novo usa a da língua da interface).
export const TEMPLATE_DIRS = ['modelos', 'templates'];
export function templateDir(paths: Iterable<string>, lang: string): string {
  const have = new Set<string>();
  for (const p of paths) { const d = p.split('/')[0]; if (TEMPLATE_DIRS.includes(d) && p.includes('/')) have.add(d); }
  const mine = lang === 'pt-BR' ? 'modelos' : 'templates';
  return have.has(mine) ? mine : have.size ? [...have][0] : mine;
}
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const baseName = (p: string) => p.split('/').pop()!.replace(/\.md$/i, '');
export const isTemplate = (p: string) => TEMPLATE_DIRS.some(d => p.startsWith(d + '/'));
// Palavras-chave dos modelos em português e em inglês
export const TYPE_KEYS = ['tipo', 'type'], FOLDER_KEYS = ['destino', 'folder'];
const RESERVED = new Set([...TYPE_KEYS, ...FOLDER_KEYS, 'tags', 'tag', 'aliases']);

// ---------------------------------------------------------------- informações de cada nota (com cache)
export interface NoteInfo { path: string; name: string; tipo: string; tags: string[]; props: Prop[]; date: string; }
const cache = new Map<string, { content: string; info: NoteInfo }>();
export function info(path: string, content: string): NoteInfo {
  const c = cache.get(path);
  if (c && c.content === content) return c.info;
  const props = noteProps(content);
  const get = (k: string) => props.find(p => fold(p.key) === k)?.value;
  const tipo = get('tipo') ?? get('type');
  if (typeof tipo === 'string' && tipo.trim() && !labels.has(fold(tipo))) labels.set(fold(tipo), tipo.trim());
  const date = get('data') ?? get('date');
  const i: NoteInfo = { path, name: baseName(path), tipo: typeof tipo === 'string' ? fold(tipo) : '', tags: noteTags(content), props, date: typeof date === 'string' ? date : '' };
  cache.set(path, { content, info: i });
  return i;
}
// Nome do tipo como foi escrito (reunião, não reuniao), com a primeira letra maiúscula.
const labels = new Map<string, string>();
export function typeLabel(tipo: string) { const l = labels.get(tipo) ?? tipo; return l ? l[0].toUpperCase() + l.slice(1) : ''; }

// Valores de campo que nomeiam outra nota: "Empresa Y", "[[Empresa Y]]", "[Empresa Y](../Empresa Y.md)".
function refNames(v: string): { name?: string; href?: string } | null {
  v = v.trim(); if (!v) return null;
  const wiki = /^\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]$/.exec(v); if (wiki) return { name: wiki[1].trim() };
  const md = /^\[[^\]]*\]\(([^)]+)\)$/.exec(v); if (md) return { href: md[1] };
  if (v.length > 120 || /^(https?:|\d+([.,]\d+)?$)/i.test(v)) return null;
  return { name: v };
}
// Índice de nomes de nota (para achar a nota pelo nome escrito num campo).
export function nameIndex(paths: Iterable<string>) {
  const idx = new Map<string, string[]>();
  for (const p of paths) { const k = fold(baseName(p)); if (!idx.has(k)) idx.set(k, []); idx.get(k)!.push(p); }
  return idx;
}
function resolveValue(from: string, v: string, idx: Map<string, string[]>): string | null {
  const r = refNames(v); if (!r) return null;
  if (r.href) { const t = resolveRef(from, r.href); return t && (t.endsWith('.md') ? t : t + '.md'); }
  const hits = idx.get(fold(r.name!)); if (!hits?.length) return null;
  const dir = from.split('/').slice(0, -1).join('/');
  return hits.find(p => p.split('/').slice(0, -1).join('/') === dir) ?? hits[0];
}

// Campos desta nota que apontam para outras notas.
export function outgoing(path: string, content: string, idx: Map<string, string[]>): { key: string; target: string }[] {
  const out: { key: string; target: string }[] = [];
  for (const p of info(path, content).props) {
    if (RESERVED.has(fold(p.key))) continue;
    for (const v of Array.isArray(p.value) ? p.value : [p.value]) {
      const t = resolveValue(path, v, idx);
      if (t && t !== path) out.push({ key: p.key, target: t });
    }
  }
  return out;
}

// Quem aponta para esta nota: por campo (empresa: Y) ou citando no texto.
export interface Relation { from: string; tipo: string; via: string; line: string; }
export function incoming(me: string, notes: Map<string, { content: string }>, idx: Map<string, string[]>): Relation[] {
  const myName = fold(baseName(me));
  const rels: Relation[] = [];
  for (const [p, n] of notes) {
    if (p === me || isTemplate(p)) continue;
    const i = info(p, n.content);
    const byField = outgoing(p, n.content, idx).find(o => o.target === me);
    if (byField) { rels.push({ from: p, tipo: i.tipo, via: byField.key, line: '' }); continue; }
    const body = splitFrontmatter(n.content)[1];
    if (!body.includes(baseName(me)) && !body.includes(encodeURIComponent(baseName(me))) && !body.includes('](')) continue;
    for (const line of body.split('\n')) {
      let hit = false;
      for (const m of line.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) { const t = resolveRef(p, m[1]); if (t && (t === me || t + '.md' === me)) hit = true; }
      for (const m of line.matchAll(/\[\[([^\]|#]+)/g)) if (fold(m[1]) === myName) hit = true;
      if (hit) { rels.push({ from: p, tipo: i.tipo, via: '', line: line.trim() }); break; }
    }
  }
  return rels;
}

// ---------------------------------------------------------------- modelos
export interface Template { path: string; name: string; tipo: string; destino: string; tags: string[]; }
export function templates(notes: Map<string, { content: string }>): Template[] {
  const out: Template[] = [];
  for (const [p, n] of notes) {
    if (!isTemplate(p)) continue;
    const i = info(p, n.content);
    const destino = i.props.find(x => FOLDER_KEYS.includes(fold(x.key)))?.value;
    out.push({ path: p, name: i.name, tipo: i.tipo, destino: typeof destino === 'string' ? destino.replace(/^\/+|\/+$/g, '') : '', tags: i.tags });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
const z = (n: number) => String(n).padStart(2, '0');
export const today = (d = new Date()) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
// Texto da nota nova a partir do modelo: preenche {{titulo}}, {{data}}, {{hora}}, tira "destino"/"folder" e soma as tags escolhidas.
export function fromTemplate(tpl: string, title: string, tags: string[]): string {
  const d = new Date();
  const fill = (s: string) => s.replace(/\{\{\s*(titulo|título|title)\s*\}\}/gi, title).replace(/\{\{\s*(data|date)\s*\}\}/gi, today(d)).replace(/\{\{\s*(hora|time)\s*\}\}/gi, `${z(d.getHours())}:${z(d.getMinutes())}`);
  const [fm, body] = splitFrontmatter(tpl);
  const props = fm ? parseProps(fm) : [];
  if (!props) return fill(tpl); // YAML elaborado: só preenche os campos
  const kept = props.filter(p => !FOLDER_KEYS.includes(fold(p.key))).map(p => ({ ...p, value: Array.isArray(p.value) ? p.value.map(fill) : fill(p.value) }));
  if (tags.length) {
    const t = kept.find(p => fold(p.key) === 'tags');
    const cur = t ? (Array.isArray(t.value) ? t.value : t.value ? t.value.split(/[,\s]+/) : []) : [];
    const all = [...new Set([...cur, ...tags].map(x => x.replace(/^#/, '').trim()).filter(Boolean))];
    if (t) t.value = all; else kept.push({ key: 'tags', value: all });
  }
  return serializeProps(kept) + fill(body).replace(/^\n+/, '');
}

// Notas citadas no texto (links Markdown e [[Nome]]), para contar relações nas listas.
export function bodyTargets(path: string, content: string, idx: Map<string, string[]>): string[] {
  const out = new Set<string>();
  const body = splitFrontmatter(content)[1];
  for (const m of body.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) { const t = resolveRef(path, m[1]); if (t) out.add(t.endsWith('.md') ? t : t + '.md'); }
  for (const m of body.matchAll(/\[\[([^\]|#]+)/g)) { const hits = idx.get(fold(m[1])); if (hits?.length) out.add(hits[0]); }
  out.delete(path);
  return [...out];
}
