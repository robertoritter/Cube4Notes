/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * Cópia local das notas de cada vault (IndexedDB), fila de alterações offline e sincronização com o servidor.
 * Todos os vaults liberados para o aparelho ficam disponíveis offline. Nenhuma alteração é descartada:
 * conflitos viram cópias no servidor. Anexos (imagens, PDF) colados offline ficam guardados aqui e sobem depois;
 * os do servidor ficam guardados quando vistos. Também concentra as chamadas de API (pareamento e administração).
 */
import { openDB, type IDBPDatabase } from 'idb';
import { rewriteLinks, mover } from './links';

export interface Note { path: string; content: string; baseVersion: string | null; modified: number; }
export type Op =
  | { seq?: number; type: 'put'; path: string }
  | { seq?: number; type: 'delete'; path: string; baseVersion: string | null }
  | { seq?: number; type: 'mkdir'; path: string }
  | { seq?: number; type: 'rmdir'; path: string }
  | { seq?: number; type: 'move'; from: string; to: string }
  | { seq?: number; type: 'upload'; path: string };
interface FileRec { path: string; blob: Blob; pending: boolean; size: number; }
export interface AttachmentInfo { size: number; modified: string; }
export interface Conflict { path: string; copy: string; at: number; }
export interface VaultInfo { id: string; name: string; legacy?: boolean; path?: string | null; }
export type SyncState = 'idle' | 'syncing' | 'offline' | 'unauthorized';

// Estado de um vault neste aparelho
class VaultState {
  db!: IDBPDatabase;
  notes = new Map<string, Note>();
  folders = new Set<string>();
  outbox: Op[] = [];
  conflicts: Conflict[] = [];
  inflight = new Set<string>();          // notas enviadas no lote em andamento
  renamedInFlight = new Map<string, string>();
  attachments = new Map<string, AttachmentInfo>(); // anexos que o servidor tem
  files = new Map<string, { size: number; pending: boolean }>(); // anexos guardados neste aparelho
  constructor(public id: string) {}
  async open() {
    this.db = await openDB('c4n-vault-' + this.id, 2, {
      upgrade(d, old) {
        if (old < 1) {
          d.createObjectStore('notes', { keyPath: 'path' });
          d.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true });
          d.createObjectStore('meta');
        }
        if (old < 2) d.createObjectStore('files', { keyPath: 'path' });
      },
    });
    for (const f of await this.db.getAll('files') as FileRec[]) this.files.set(f.path, { size: f.size, pending: f.pending });
    this.attachments = new Map(Object.entries((await this.db.get('meta', 'attachments')) || {}));
    for (const n of await this.db.getAll('notes')) this.notes.set(n.path, n);
    this.outbox = await this.db.getAll('outbox');
    for (const f of (await this.db.get('meta', 'folders')) || []) this.folders.add(f);
    this.conflicts = (await this.db.get('meta', 'conflicts')) || [];
    return this;
  }
  hasPendingPut(p: string) { return this.outbox.some(o => o.type === 'put' && o.path === p); }
  async saveMeta() { await this.db.put('meta', [...this.folders], 'folders'); await this.db.put('meta', this.conflicts, 'conflicts'); }
}

let meta: IDBPDatabase;
const states = new Map<string, VaultState>();
let cur: VaultState;
// Vínculos "vivos": a interface lê sempre o vault ativo
export let notes = new Map<string, Note>();
export let folders = new Set<string>();
export let conflicts: Conflict[] = [];
export let vaults: VaultInfo[] = [];
export let activeVault = '';
export let syncState: SyncState = 'idle';
export let lastSync = 0;
export let token = '';
export let deviceName = '';

const listeners = new Set<(what: string, detail?: any) => void>();
export function on(fn: (what: string, detail?: any) => void) { listeners.add(fn); return () => listeners.delete(fn); }
// Eventos de outros vaults (sincronizando em segundo plano) não mexem na tela, só no estado geral.
function emit(st: VaultState | null, what: string, detail?: any) {
  if (st && st !== cur && !['pending', 'sync'].includes(what)) return;
  for (const l of listeners) l(what, detail);
}
function bind() { notes = cur.notes; folders = cur.folders; conflicts = cur.conflicts; activeVault = cur.id; }
const pref = (k: string) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const setPref = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };

export async function init() {
  // Banco geral: aparelho, token e lista de vaults. Na versão de um vault só, ele também guardava as notas.
  meta = await openDB('cube4notes', 1, {
    upgrade(d) {
      d.createObjectStore('notes', { keyPath: 'path' });
      d.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true });
      d.createObjectStore('meta');
    },
  });
  token = (await meta.get('meta', 'token')) || '';
  deviceName = (await meta.get('meta', 'deviceName')) || '';
  lastSync = (await meta.get('meta', 'lastSync')) || 0;
  vaults = (await meta.get('meta', 'vaults')) || [];
  await migrateLegacy();
  if (!vaults.length && (await meta.get('meta', 'migrated'))) vaults = [{ id: 'notas', name: 'Notas', legacy: true }];
  await openVaults();
}

// Notas e fila offline da versão antiga vão para o vault "notas" (o mesmo id que o servidor usa na migração).
async function migrateLegacy() {
  if (await meta.get('meta', 'migrated')) return;
  const oldNotes = await meta.getAll('notes');
  const oldOutbox = await meta.getAll('outbox');
  const oldFolders = (await meta.get('meta', 'folders')) || [];
  const oldConflicts = (await meta.get('meta', 'conflicts')) || [];
  if (oldNotes.length || oldOutbox.length) {
    const target = vaults.find(v => v.legacy)?.id || 'notas';
    const st = await new VaultState(target).open();
    const tx = st.db.transaction(['notes', 'outbox', 'meta'], 'readwrite');
    for (const n of oldNotes) await tx.objectStore('notes').put(n);
    for (const o of oldOutbox) { const { seq, ...rest } = o; await tx.objectStore('outbox').add(rest); }
    await tx.objectStore('meta').put(oldFolders, 'folders');
    await tx.objectStore('meta').put(oldConflicts, 'conflicts');
    await tx.done;
    if (!vaults.some(v => v.id === target)) vaults = [...vaults, { id: target, name: 'Notas', legacy: true }];
    await meta.put('meta', vaults, 'vaults');
    st.db.close();
  }
  // Só limpa a versão antiga depois de gravar tudo no vault novo.
  await meta.clear('notes'); await meta.clear('outbox');
  await meta.delete('meta', 'folders'); await meta.delete('meta', 'conflicts');
  await meta.put('meta', true, 'migrated');
}

async function openVaults() {
  for (const v of vaults) if (!states.has(v.id)) states.set(v.id, await new VaultState(v.id).open());
  const wanted = pref('c4n-vault');
  const id = vaults.some(v => v.id === wanted) ? wanted : vaults[0]?.id;
  if (id) { cur = states.get(id)!; bind(); }
  else { cur = new VaultState(''); bind(); }
}

export async function switchVault(id: string) {
  if (!states.has(id)) return;
  cur = states.get(id)!; bind(); setPref('c4n-vault', id);
  emit(null, 'vault'); emit(null, 'tree');
}

// Atualiza a lista de vaults liberados para este aparelho (quando há servidor).
async function refreshVaults() {
  const r = await api('/api/vaults', {}, 8000);
  if (r.status === 401) throw new Error('401');
  if (!r.ok) throw new Error(String(r.status));
  const list = (await r.json()).vaults as VaultInfo[];
  const changed = JSON.stringify(list) !== JSON.stringify(vaults);
  vaults = list;
  await meta.put('meta', vaults, 'vaults');
  for (const v of vaults) if (!states.has(v.id)) states.set(v.id, await new VaultState(v.id).open());
  // Vault que deixou de ser liberado: some da tela (os dados locais ficam, por segurança).
  for (const id of [...states.keys()]) if (!vaults.some(v => v.id === id) && states.get(id)!.outbox.length === 0) states.delete(id);
  if (!vaults.some(v => v.id === cur.id) && vaults[0]) await switchVault(vaults[0].id);
  if (changed) emit(null, 'vaults');
}

export const pendingCount = () => [...states.values()].reduce((n, s) => n + s.outbox.length, 0);
export const hasPendingPut = (p: string) => cur.hasPendingPut(p);

async function enqueue(st: VaultState, op: Op) {
  if (op.type === 'put' && st.hasPendingPut(op.path)) return;
  const seq = await st.db.add('outbox', op as any);
  st.outbox.push({ ...op, seq: seq as number });
  emit(st, 'pending');
  scheduleSync(op.type === 'put' ? 1200 : 150);
}

// ---------- operações locais no vault ativo (instantâneas; o servidor recebe depois) ----------
// vaultId: grava no vault onde a nota foi aberta, mesmo que a tela já tenha trocado de vault
export async function writeNote(path: string, content: string, vaultId?: string) {
  const st = vaultId ? states.get(vaultId) : cur;
  if (!st) return;
  const n = st.notes.get(path);
  if (n && n.content === content) return;
  const note: Note = { path, content, baseVersion: n ? n.baseVersion : null, modified: Date.now() };
  st.notes.set(path, note);
  await st.db.put('notes', note);
  await enqueue(st, { type: 'put', path });
  emit(st, 'note', path);
}
export async function createNote(path: string, content: string) {
  const st = cur;
  ensureParents(st, path);
  const note: Note = { path, content, baseVersion: null, modified: Date.now() };
  st.notes.set(path, note);
  await st.db.put('notes', note);
  await st.saveMeta();
  await enqueue(st, { type: 'put', path });
  emit(st, 'tree');
}
function ensureParents(st: VaultState, path: string) {
  const parts = path.split('/'); parts.pop();
  for (let i = 1; i <= parts.length; i++) st.folders.add(parts.slice(0, i).join('/'));
}
export async function createFolder(path: string) {
  const st = cur;
  ensureParents(st, path + '/x');
  await st.saveMeta();
  await enqueue(st, { type: 'mkdir', path });
  emit(st, 'tree');
}
export async function deleteNote(path: string) {
  const st = cur;
  const n = st.notes.get(path); if (!n) return;
  st.notes.delete(path);
  await st.db.delete('notes', path);
  await dropPuts(st, path);
  if (n.baseVersion !== null) await enqueue(st, { type: 'delete', path, baseVersion: n.baseVersion });
  emit(st, 'tree'); emit(st, 'removed', path);
}
export async function deleteFolder(path: string) {
  const st = cur;
  for (const p of [...st.notes.keys()]) if (p.startsWith(path + '/')) {
    // O servidor move a pasta inteira para a lixeira; aqui só limpamos a cópia local.
    st.notes.delete(p); await st.db.delete('notes', p); emit(st, 'removed', p);
  }
  for (const f of [...st.folders]) if (f === path || f.startsWith(path + '/')) st.folders.delete(f);
  await st.saveMeta();
  await enqueue(st, { type: 'rmdir', path });
  emit(st, 'tree');
}
async function dropPuts(st: VaultState, path: string) {
  for (const o of st.outbox.filter(o => o.type === 'put' && o.path === path)) await st.db.delete('outbox', o.seq!);
  st.outbox = st.outbox.filter(o => !(o.type === 'put' && o.path === path));
}
export async function move(from: string, to: string) {
  const st = cur;
  if (from === to) return;
  const isFile = st.notes.has(from);
  const remap = (p: string) => (p === from ? to : p.startsWith(from + '/') ? to + p.slice(from.length) : p);
  const moved: [string, string][] = [];
  for (const [p, n] of [...st.notes]) {
    const q = remap(p);
    if (q !== p && st.inflight.has(p)) st.renamedInFlight.set(p, q);
    if (q !== p) { st.notes.delete(p); await st.db.delete('notes', p); const m = { ...n, path: q }; st.notes.set(q, m); await st.db.put('notes', m); moved.push([p, q]); }
  }
  if (!isFile) { for (const f of [...st.folders]) { const q = remap(f); if (q !== f) { st.folders.delete(f); st.folders.add(q); } } }
  ensureParents(st, isFile ? to : to + '/x');
  // Alterações pendentes no caminho antigo passam a valer depois do movimento.
  const repath: string[] = [];
  for (const o of [...st.outbox]) if (o.type === 'put' && remap(o.path) !== o.path) {
    repath.push(remap(o.path)); await st.db.delete('outbox', o.seq!); st.outbox = st.outbox.filter(x => x.seq !== o.seq);
  }
  await st.saveMeta();
  // Se a nota nunca chegou ao servidor, basta o put no novo caminho.
  const n = st.notes.get(to);
  if (!(isFile && n && n.baseVersion === null && !st.inflight.has(from))) await enqueue(st, { type: 'move', from, to });
  for (const p of repath) await enqueue(st, { type: 'put', path: p });
  emit(st, 'tree'); emit(st, 'moved', moved);
}
// Troca o caminho de uma nota só neste aparelho (o servidor já fez a mudança).
async function rekey(st: VaultState, from: string, to: string) {
  const n = st.notes.get(from); if (!n) return;
  st.notes.delete(from); await st.db.delete('notes', from);
  const m = { ...n, path: to };
  st.notes.set(to, m); await st.db.put('notes', m);
  for (const o of st.outbox) if (o.type === 'put' && o.path === from) { o.path = to; await st.db.put('outbox', o as any); }
  ensureParents(st, to); await st.saveMeta();
  emit(st, 'moved', [[from, to]]); emit(st, 'tree');
}
export function dismissConflict(path: string) {
  cur.conflicts = cur.conflicts.filter(c => c.path !== path && c.copy !== path); bind(); cur.saveMeta(); emit(cur, 'conflicts');
}

// ---------- rede ----------
const vpath = (st: VaultState, p: string) => `/api/v/${encodeURIComponent(st.id)}/${p}`;
export async function api(url: string, init: RequestInit = {}, timeout = 8000): Promise<Response> {
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), timeout);
  try {
    return await fetch(url, { ...init, signal: ctl.signal, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(init.headers || {}) } });
  } finally { clearTimeout(tm); }
}
async function json<T = any>(url: string, init: RequestInit = {}): Promise<T> {
  const r = await api(url, init, 15000);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(body?.error || String(r.status)), { status: r.status });
  return body as T;
}
export interface ServerStatus { name: string; setup: boolean; mode: 'pessoal' | 'rede'; paired: boolean; loopback: boolean; admin: boolean; ui?: string; }
export async function status(): Promise<ServerStatus | null> {
  try { const r = await api('/api/status', {}, 4000); return r.ok ? r.json() : null; } catch { return null; }
}
async function saveToken(t: string, name: string) {
  token = t; deviceName = name;
  await meta.put('meta', token, 'token'); await meta.put('meta', deviceName, 'deviceName');
}
export async function pair(invite: string, name: string): Promise<'ok' | 'wrong' | 'wait' | 'unreachable'> {
  try {
    const r = await api('/api/pair', { method: 'POST', body: JSON.stringify({ invite, deviceName: name }) });
    if (r.status === 403) return 'wrong';
    if (r.status === 429) return 'wait';
    if (!r.ok) return 'unreachable';
    const j = await r.json();
    // aparelho já conectado: o servidor só trocou o acesso, o token continua o mesmo
    if (j.token) await saveToken(j.token, j.deviceName);
    return 'ok';
  } catch { return 'unreachable'; }
}
export async function forgetToken() { token = ''; await meta.delete('meta', 'token'); }

// Anexos: primeiro a cópia deste aparelho; senão busca no servidor (token no cabeçalho, nunca na URL),
// guarda para usar offline e mostra como blob local.
const rawCache = new Map<string, Promise<string>>();
function dropRaw(st: VaultState, path: string) {
  const key = st.id + '|' + path;
  rawCache.get(key)?.then(u => URL.revokeObjectURL(u)).catch(() => {});
  rawCache.delete(key);
}
async function localBlob(st: VaultState, path: string): Promise<Blob | null> {
  if (!st.files.has(path)) return null;
  return ((await st.db.get('files', path)) as FileRec | undefined)?.blob ?? null;
}
async function fetchAttachment(st: VaultState, path: string): Promise<Blob> {
  const r = await api(vpath(st, 'raw?path=' + encodeURIComponent(path)), {}, 60000);
  if (!r.ok) throw new Error(String(r.status));
  const blob = await r.blob();
  // guarda para abrir sem servidor (até 25 MB por arquivo)
  if (blob.size <= MAX_ATTACHMENT) {
    try { await st.db.put('files', { path, blob, pending: false, size: blob.size } as FileRec); st.files.set(path, { size: blob.size, pending: false }); } catch {}
  }
  return blob;
}
export function rawUrl(path: string): Promise<string> {
  const st = cur, key = st.id + '|' + path;
  if (!rawCache.has(key)) rawCache.set(key, (async () => URL.createObjectURL((await localBlob(st, path)) ?? (await fetchAttachment(st, path))))()
    .catch(e => { rawCache.delete(key); throw e; }));
  return rawCache.get(key)!;
}
export const MAX_ATTACHMENT = 25 * 1024 * 1024;
export const ATTACHMENT_TYPES = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.bmp', '.pdf'];
const extOf = (n: string) => (/\.[^./]+$/.exec(n)?.[0] || '').toLowerCase();
// Nome do arquivo como o servidor aceita; imagens coladas ("image.png") ganham data e hora no nome.
function attachmentName(file: File): string {
  const type = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
  let name = (file.name || '').split(/[\\/]/).pop()!.replace(/[<>:"|?*\x00-\x1f]/g, '-').trim().replace(/^\.+/, '').replace(/[. ]+$/, '');
  if (!name || /^(image|imagem|blob|clipboard|pasted image)(\.[a-z0-9]+)?$/i.test(name)) {
    const d = new Date(), z = (n: number) => String(n).padStart(2, '0');
    name = `Imagem ${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}` + (extOf(name) || '.' + type);
  }
  if (name.length > 120) name = name.slice(-120);
  return name;
}
// Guarda o anexo neste aparelho (funciona sem servidor) e põe na fila para subir. Devolve o caminho no vault.
export async function addAttachment(file: File): Promise<string> {
  const st = cur;
  const name = attachmentName(file), ext = extOf(name);
  if (!ATTACHMENT_TYPES.includes(ext)) throw Object.assign(new Error('type'), { code: 'type' });
  if (file.size > MAX_ATTACHMENT) throw Object.assign(new Error('size'), { code: 'size' });
  const stem = name.slice(0, name.length - ext.length);
  const taken = (p: string) => st.files.has(p) || st.attachments.has(p) || st.notes.has(p);
  let path = 'anexos/' + name;
  for (let i = 2; taken(path); i++) path = `anexos/${stem}-${i}${ext}`;
  await st.db.put('files', { path, blob: file, pending: true, size: file.size } as FileRec);
  st.files.set(path, { size: file.size, pending: true });
  ensureParents(st, path); await st.saveMeta();
  await enqueue(st, { type: 'upload', path });
  return path;
}
// Busca em segundo plano as imagens usadas nas notas, para aparecerem sem servidor.
let prefetching = false;
async function prefetchImages() {
  if (prefetching) return;
  prefetching = true;
  try {
    for (const st of [cur, ...[...states.values()].filter(s => s !== cur)]) {
      if (!st.id) continue;
      let budget = 150 * 1024 * 1024 - [...st.files.values()].reduce((n, f) => n + f.size, 0);
      const wanted = new Set<string>();
      for (const n of st.notes.values()) for (const m of n.content.matchAll(/!\[[^\]\n]*\]\((<[^>\n]*>|[^)\s]+)/g)) {
        let href = m[1].replace(/^<|>$/g, ''); if (/^([a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(href)) continue;
        try { href = decodeURIComponent(href); } catch {}
        const out: string[] = [];
        for (const s of (n.path.split('/').slice(0, -1).concat(href.split('/')))) { if (s === '..') out.pop(); else if (s && s !== '.') out.push(s); }
        wanted.add(out.join('/'));
      }
      for (const p of wanted) {
        const a = st.attachments.get(p);
        if (!a || st.files.has(p) || a.size > 10 * 1024 * 1024 || a.size > budget) continue;
        try { await fetchAttachment(st, p); budget -= a.size; } catch { return; }
      }
    }
  } finally { prefetching = false; }
}

// ---------- histórico de versões (fica no servidor) ----------
export interface VersionInfo { id: string; at: string; size: number; }
export const listHistory = async (path: string) => (await json<{ versions: VersionInfo[] }>(vpath(cur, 'history?path=' + encodeURIComponent(path)))).versions;
export const getVersion = async (path: string, id: string) => (await json<{ content: string }>(vpath(cur, 'history/version?path=' + encodeURIComponent(path) + '&id=' + encodeURIComponent(id)))).content;

// ---------- assistente de primeira execução ----------
export interface BrowseResult { path: string; exists: boolean; parent: string | null; entries: { name: string; path: string }[]; roots: string[]; suggested: string; }
export const setupBrowse = (path: string, code: string) => json<BrowseResult>('/api/setup/browse?path=' + encodeURIComponent(path) + '&code=' + encodeURIComponent(code));
export async function runSetup(body: { code: string; mode: string; serverName: string; vaultName: string; vaultPath: string; deviceName: string }) {
  const j = await json<{ token: string; deviceName: string; next: string }>('/api/setup', { method: 'POST', body: JSON.stringify(body) });
  await saveToken(j.token, j.deviceName);
  return j.next;
}

// ---------- administração ----------
export interface DeviceInfo { id: string; name: string; created: string; lastSeen: string | null; current: boolean; admin: boolean; vaults: string[] | null; agent?: boolean; }
export interface AgentCreated { id: string; name: string; token: string; local: string; network: string[]; https: boolean; }
export const createAgent = (name: string, vaultIds: string[]) => json<AgentCreated>('/api/admin/agents', { method: 'POST', body: JSON.stringify({ name, vaults: vaultIds }) });
export const adminBrowse = (path: string) => json<BrowseResult>('/api/admin/browse?path=' + encodeURIComponent(path));
export const createVault = async (name: string, path: string) => { const v = await json('/api/admin/vaults', { method: 'POST', body: JSON.stringify({ name, path }) }); await refreshVaults(); return v; };
export const renameVault = async (id: string, name: string) => { await json('/api/admin/vaults/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify({ name }) }); await refreshVaults(); };
export const removeVault = async (id: string) => { await json('/api/admin/vaults/' + encodeURIComponent(id), { method: 'DELETE' }); await refreshVaults(); };
export const createInvite = (vaultIds: string[], admin: boolean) => json<{ expires: string; shortCode: string; personal: boolean; addresses: { address: string; url: string; primary: boolean; name: string }[] }>('/api/admin/invite', { method: 'POST', body: JSON.stringify({ vaults: vaultIds, admin }) });
export const listDevices = async () => (await json<{ devices: DeviceInfo[] }>('/api/admin/devices')).devices;
export const updateDevice = (id: string, change: { admin?: boolean; vaults?: string[] }) => json('/api/admin/devices/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(change) });
export const removeDevice = (id: string) => json('/api/admin/devices/' + encodeURIComponent(id), { method: 'DELETE' });
export const serverInfo = () => json<{ name: string; mode: 'pessoal' | 'rede'; port: number; configDir: string }>('/api/admin/server');
export const quitServer = () => json('/api/admin/quit', { method: 'POST' });
export const updateServer = (change: { name?: string; mode?: string }) => json<{ name: string; mode: string; restart: boolean; next: string }>('/api/admin/server', { method: 'PATCH', body: JSON.stringify(change) });

// ---------- sincronização de todos os vaults ----------
let timer: any = 0, running = false, again = false;
export function scheduleSync(ms = 0) { clearTimeout(timer); timer = setTimeout(sync, ms); }
function setState(s: SyncState) { if (syncState !== s) { syncState = s; emit(null, 'sync'); } }

export async function sync() {
  if (!token) return;
  if (running) { again = true; return; }
  running = true; setState('syncing');
  try {
    await refreshVaults();
    // o vault aberto primeiro, depois os outros
    const order = [cur, ...[...states.values()].filter(s => s !== cur)].filter(s => s.id);
    for (const st of order) { await push(st); await pull(st); }
    lastSync = Date.now(); await meta.put('meta', lastSync, 'lastSync');
    setState('idle');
    prefetchImages();
  } catch (e: any) {
    setState(e?.message === '401' ? 'unauthorized' : 'offline');
  } finally {
    running = false;
    if (again) { again = false; scheduleSync(300); }
  }
}

async function push(st: VaultState): Promise<void> {
  await pushUploads(st);
  if (!st.outbox.some(o => o.type !== 'upload')) return;
  const batch = st.outbox.filter(o => o.type !== 'upload').slice(0, 200);
  const sent = new Map<number, { op: Op; content?: string }>();
  const ops = batch.map(o => {
    if (o.type === 'put') {
      const n = st.notes.get(o.path);
      sent.set(o.seq!, { op: o, content: n?.content });
      return n ? { id: o.seq, type: 'put', path: o.path, content: n.content, baseVersion: n.baseVersion } : null;
    }
    sent.set(o.seq!, { op: o });
    return { id: o.seq, ...o };
  });
  st.inflight.clear(); for (const o of batch) if (o.type === 'put') st.inflight.add(o.path);
  st.renamedInFlight.clear();
  let r: Response;
  try { r = await api(vpath(st, 'sync'), { method: 'POST', body: JSON.stringify({ ops: ops.filter(Boolean) }) }, 20000); }
  catch (e) { st.inflight.clear(); throw e; }
  if (r.status === 401) throw new Error('401');
  if (r.status === 404) { st.inflight.clear(); return; } // vault deixou de ser liberado: a fila fica guardada
  if (!r.ok) throw new Error(String(r.status));
  const { results } = await r.json() as { results: any[] };
  const byId = new Map(results.map(x => [x.id, x]));
  for (const o of batch) {
    const res = byId.get(o.seq);
    await st.db.delete('outbox', o.seq!);
    st.outbox = st.outbox.filter(x => x.seq !== o.seq);
    if (!res) continue; // put de nota já removida
    const s = sent.get(o.seq!)!;
    if (o.type === 'put') {
      let path = st.renamedInFlight.get(o.path) ?? o.path; // renomeada enquanto o lote viajava
      // o servidor aplicou no nome novo (a nota tinha sido renomeada em outro aparelho)
      if (res.movedTo && res.movedTo !== path && st.notes.has(path)) { await rekey(st, path, res.movedTo); path = res.movedTo; }
      const n = st.notes.get(path);
      if (res.status === 'applied' && n) { n.baseVersion = res.version; await st.db.put('notes', n); if (n.content !== s.content && !st.hasPendingPut(path)) await enqueue(st, { type: 'put', path }); }
      if (res.status === 'conflict') {
        st.conflicts = st.conflicts.filter(c => c.path !== path).concat({ path, copy: res.conflictPath, at: Date.now() });
        if (st === cur) bind();
        // A versão do servidor volta para cá; a deste aparelho está segura na cópia.
        if (n) { n.baseVersion = '__refetch__'; await st.db.put('notes', n); }
        await st.saveMeta(); emit(st, 'conflicts');
      }
    }
    if (o.type === 'delete' && res.status === 'kept') emit(st, 'kept', o.path);
  }
  st.inflight.clear(); st.renamedInFlight.clear();
  emit(st, 'pending');
  if (st.outbox.some(o => o.type !== 'upload')) await push(st);
}

// Anexos colados neste aparelho: sobem um a um antes das notas.
async function pushUploads(st: VaultState) {
  for (const o of st.outbox.filter(o => o.type === 'upload') as { seq: number; type: 'upload'; path: string }[]) {
    const rec = await st.db.get('files', o.path) as FileRec | undefined;
    const done = async () => { await st.db.delete('outbox', o.seq); st.outbox = st.outbox.filter(x => x.seq !== o.seq); emit(st, 'pending'); };
    if (!rec) { await done(); continue; }
    const r = await api(vpath(st, 'attachment?path=' + encodeURIComponent(o.path)), { method: 'POST', body: rec.blob, headers: { 'Content-Type': 'application/octet-stream' } }, 120000);
    if (r.status === 401) throw new Error('401');
    if (r.status === 404) return; // vault deixou de ser liberado: a fila fica guardada
    if (r.status === 413 || r.status === 415 || r.status === 400) { await done(); emit(st, 'uploadRejected', o.path); continue; }
    if (!r.ok) throw new Error(String(r.status));
    const saved = (await r.json()).path as string;
    rec.pending = false;
    if (saved !== o.path) {
      // já existia outro arquivo com esse nome no servidor: este ganhou outro nome
      await st.db.delete('files', o.path); st.files.delete(o.path);
      rec.path = saved;
      for (const n of [...st.notes.values()]) {
        const next = rewriteLinks(n.content, n.path, n.path, mover(o.path, saved));
        if (next !== n.content) { await writeNote(n.path, next, st.id); emit(st, 'rewritten', n.path); }
      }
    }
    await st.db.put('files', rec); st.files.set(rec.path, { size: rec.size, pending: false });
    st.attachments.set(rec.path, { size: rec.size, modified: new Date().toISOString() });
    await done();
  }
}

async function pull(st: VaultState) {
  const r = await api(vpath(st, 'manifest'), {}, 15000);
  if (r.status === 401) throw new Error('401');
  if (r.status === 404) return;
  if (!r.ok) throw new Error(String(r.status));
  const m = await r.json() as { folders: string[]; files: { path: string; version: string }[]; attachments?: { path: string; size: number; modified: string }[] };
  if (m.attachments) {
    st.attachments = new Map(m.attachments.map(a => [a.path, { size: a.size, modified: a.modified }]));
    await st.db.put('meta', Object.fromEntries(st.attachments), 'attachments');
    // cópia guardada de um anexo que mudou ou sumiu do servidor: descarta (o servidor manda a nova quando for vista)
    for (const [p, f] of [...st.files]) {
      const a = st.attachments.get(p);
      if (!f.pending && (!a || a.size !== f.size)) { st.files.delete(p); await st.db.delete('files', p); dropRaw(st, p); }
    }
  }
  const server = new Map(m.files.map(f => [f.path, f.version]));
  const pendingDelete = new Set(st.outbox.filter(o => o.type === 'delete').map(o => (o as any).path));
  const need: string[] = [];
  for (const [p, v] of server) {
    if (pendingDelete.has(p) || st.hasPendingPut(p)) continue;
    const n = st.notes.get(p);
    if (!n || n.baseVersion !== v) need.push(p);
  }
  let treeChanged = false;
  for (const [p, n] of [...st.notes]) {
    if (!server.has(p) && n.baseVersion !== null && !st.hasPendingPut(p)) {
      st.notes.delete(p); await st.db.delete('notes', p); emit(st, 'removed', p); treeChanged = true;
    }
  }
  for (let i = 0; i < need.length; i += 100) {
    const fr = await api(vpath(st, 'fetch'), { method: 'POST', body: JSON.stringify({ paths: need.slice(i, i + 100) }) }, 30000);
    if (!fr.ok) throw new Error(String(fr.status));
    for (const f of (await fr.json()).files as { path: string; content: string; version: string }[]) {
      if (st.hasPendingPut(f.path)) continue; // usuário editou enquanto baixava
      const existed = st.notes.has(f.path);
      const n: Note = { path: f.path, content: f.content, baseVersion: f.version, modified: Date.now() };
      st.notes.set(f.path, n); await st.db.put('notes', n);
      if (existed) emit(st, 'remote', f.path); else treeChanged = true;
    }
  }
  const pendingFolders = st.outbox.filter(o => o.type === 'mkdir').map(o => (o as any).path as string);
  const next = new Set([...m.folders, ...pendingFolders]);
  for (const p of st.notes.keys()) { const parts = p.split('/'); parts.pop(); for (let i = 1; i <= parts.length; i++) next.add(parts.slice(0, i).join('/')); }
  if (next.size !== st.folders.size || [...next].some(f => !st.folders.has(f))) { st.folders.clear(); for (const f of next) st.folders.add(f); treeChanged = true; }
  // conflitos cujas cópias já sumiram (resolvidos em outro lugar)
  const before = st.conflicts.length;
  st.conflicts = st.conflicts.filter(c => st.notes.has(c.copy));
  if (st === cur) bind();
  if (st.conflicts.length !== before) emit(st, 'conflicts');
  await st.saveMeta();
  if (treeChanged) emit(st, 'tree');
}
