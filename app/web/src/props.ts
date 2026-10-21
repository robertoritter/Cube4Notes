/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * Propriedades (frontmatter YAML no topo da nota) e tags (#tag no texto ou "tags:" nas propriedades).
 * Entende o YAML simples que as pessoas escrevem à mão (chave: valor, listas [a, b] ou com "- item");
 * YAML mais elaborado continua sendo editado como texto, sem nunca ser reescrito.
 */
export type PropValue = string | string[];
export interface Prop { key: string; value: PropValue; }

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const unquote = (v: string) => {
  v = v.trim();
  if (v.length >= 2 && ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'")))) {
    if (v[0] === '"') { try { return JSON.parse(v); } catch { return v.slice(1, -1); } }
    return v.slice(1, -1).replace(/''/g, "'");
  }
  return v;
};
// Divide "a, "b, c", d" respeitando aspas.
function splitList(inner: string): string[] {
  const out: string[] = []; let cur = '', q = '';
  for (const c of inner) {
    if (q) { cur += c; if (c === q) q = ''; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === ',') { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out.map(unquote).filter(x => x !== '');
}

export function splitFrontmatter(src: string): [string, string] {
  const m = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(src);
  return m ? [m[0], src.slice(m[0].length)] : ['', src];
}

// null: YAML que não é do tipo simples (fica como texto).
export function parseProps(fm: string): Prop[] | null {
  const body = fm.replace(/^---\r?\n|\r?\n---\r?\n?$/g, '');
  if (!body.trim()) return [];
  const props: Prop[] = [];
  const lines = body.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (/^\s*#/.test(line)) return null; // comentários: mantém o YAML como texto, sem reescrever
    const m = /^([\p{L}_][\p{L}\p{N}_ -]*?)\s*:(?:\s+(.*))?$/u.exec(line);
    if (!m) return null;
    const key = m[1], raw = (m[2] ?? '').trim();
    if (raw === '' ) {
      const items: string[] = [];
      while (i + 1 < lines.length && /^\s+-\s*/.test(lines[i + 1])) items.push(unquote(lines[++i].replace(/^\s+-\s*/, '')));
      if (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) return null; // mapa aninhado
      props.push({ key, value: items.length ? items : '' });
    } else if (raw.startsWith('[')) {
      if (!raw.endsWith(']')) return null;
      props.push({ key, value: splitList(raw.slice(1, -1)) });
    } else if (/^[|>]/.test(raw) || raw.startsWith('{') || raw.startsWith('&') || raw.startsWith('*')) return null;
    else if (!/^["']/.test(raw) && /\s#/.test(raw)) return null;
    else props.push({ key, value: unquote(raw) });
  }
  return props;
}

const needsQuote = (v: string) => /^[\s\-?:,[\]{}#&*!|>'"%@`]|:\s|\s#|\s$|:$/.test(v);
const scalar = (v: string) => (needsQuote(v) ? JSON.stringify(v) : v);
const item = (v: string) => (needsQuote(v) || v.includes(',') ? JSON.stringify(v) : v);

export function serializeProps(props: Prop[]): string {
  if (!props.length) return '';
  const lines = props.filter(p => p.key.trim()).map(p => Array.isArray(p.value) ? `${p.key.trim()}: [${p.value.map(item).join(', ')}]` : `${p.key.trim()}: ${p.value === '' ? '' : scalar(p.value)}`.trimEnd());
  return lines.length ? '---\n' + lines.join('\n') + '\n---\n' : '';
}

// Tags da nota: "tags:"/"tag:" nas propriedades e #tag no texto (fora de código e de títulos).
const TAG = /(^|[\s(])#([\p{L}\p{N}_/-]*\p{L}[\p{L}\p{N}_/-]*)/gu;
export function noteTags(content: string): string[] {
  const [fm, body] = splitFrontmatter(content);
  const tags = new Set<string>();
  const props = fm ? parseProps(fm) : [];
  for (const p of props || []) {
    if (!/^tags?$/i.test(p.key)) continue;
    const list = Array.isArray(p.value) ? p.value : p.value.split(/[,\s]+/);
    for (const x of list) { const t = x.replace(/^#/, '').trim(); if (t) tags.add(t); }
  }
  let fence = false;
  for (const line of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; continue; }
    if (fence) continue;
    const text = line.replace(/`[^`]*`/g, '').replace(/\]\([^)]*\)/g, ']');
    for (const m of text.matchAll(TAG)) tags.add(m[2].replace(/\/+$/, ''));
  }
  return [...tags];
}

export function noteProps(content: string): Prop[] {
  const fm = splitFrontmatter(content)[0];
  return (fm && parseProps(fm)) || [];
}

// Filtros da busca: #tag ou tag:x, chave:valor (só para chaves de propriedade existentes). O resto é texto.
export interface Query { text: string; tags: string[]; props: { key: string; value: string }[]; }
export function parseQuery(q: string, knownKeys: Set<string>): Query {
  const out: Query = { text: '', tags: [], props: [] };
  const rest: string[] = [];
  for (const tok of q.match(/"[^"]*"|\S+/g) || []) {
    const tm = /^(?:#|tag:)([\p{L}\p{N}_/-]+)$/iu.exec(tok);
    const pm = /^([\w-]+):(.+)$/.exec(tok);
    if (tm) out.tags.push(fold(tm[1]));
    else if (pm && knownKeys.has(fold(pm[1]))) out.props.push({ key: fold(pm[1]), value: fold(unquote(pm[2])) });
    else rest.push(tok.replace(/^"|"$/g, ''));
  }
  out.text = rest.join(' ');
  return out;
}
export function matches(content: string, q: Query): boolean {
  if (q.tags.length) {
    const tags = noteTags(content).map(fold);
    if (!q.tags.every(t => tags.some(x => x === t || x.startsWith(t + '/')))) return false;
  }
  if (q.props.length) {
    const props = noteProps(content);
    for (const want of q.props) {
      const p = props.find(x => fold(x.key) === want.key);
      if (!p) return false;
      const vals = (Array.isArray(p.value) ? p.value : [p.value]).map(fold);
      if (!vals.some(v => v.includes(want.value))) return false;
    }
  }
  return true;
}
