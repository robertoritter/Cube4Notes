/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * Interface do Cube4Notes: lateral com árvore de pastas, abas, editor visual, busca, paleta de comandos,
 * painel de estrutura e links, preferências, temas, troca de vault, assistente de primeira execução,
 * pareamento por QR/código e administração de vaults, aparelhos e servidor.
 */
import './fonts.css';
import './styles.css';
import * as S from './store';
import { t, lang, setLang, type Lang } from './i18n';
import { ic, type IconName } from './icons';
import { mountEditor, type EditorHandle } from './editor';
import qrcode from 'qrcode-generator';
import { termThemes, findTheme, applyTermTheme, swatches } from './termtheme';

// ---------------------------------------------------------------- helpers
type Attrs = Record<string, any>;
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids) if (c != null && c !== false) el.append(c as any);
  return el;
}
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const baseName = (p: string) => p.split('/').pop()!.replace(/\.md$/i, '');
const dirOf = (p: string) => p.split('/').slice(0, -1).join('/');
const join = (d: string, n: string) => (d ? d + '/' + n : n);
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl';
const pref = (k: string, d: string) => { try { return localStorage.getItem('c4n-' + k) || d; } catch { return d; } };
const setPref = (k: string, v: string) => { try { localStorage.setItem('c4n-' + k, v); } catch {} };
const badName = (n: string) => !n.trim() || /[\\/:*?"<>|]/.test(n) || n.trim().startsWith('.');

// ---------------------------------------------------------------- state
const ui = {
  tabs: [] as string[],
  active: null as string | null,
  expanded: new Set<string>(),
  sidebar: pref('sidebar', innerWidth > 820 ? '1' : '0') === '1',
  panel: pref('panel', innerWidth > 1180 ? '1' : '0') === '1',
  view: 'files' as 'files' | 'search',
  source: false,
  theme: pref('theme', 'system'),
  font: pref('font', 'serif'),
  width: pref('width', 'full'),
  align: pref('align', 'left'),
  term: pref('term', ''),
  topBar: pref('topbar', '1') === '1',
  selectedFolder: '',
  admin: false,
  loopback: false,
};
let editor: EditorHandle | null = null;
let editorPath: string | null = null;
let editorVault = '';         // vault da nota aberta no editor (a gravação vai sempre para ele)
let baseline = '';          // Markdown serializado logo após abrir (detecta edição real)
let frontmatter = '';       // bloco YAML preservado fora do editor visual
let writeTimer: any = 0;
let mountSeq = 0;

// Abas, nota ativa e pastas abertas são guardadas por vault.
const vkey = (k: string) => `${k}:${S.activeVault || '_'}`;
function loadVaultUi() {
  const legacy = S.vaults.find(v => v.id === S.activeVault)?.legacy;
  const old = (k: string, d: string) => (legacy ? pref(k, d) : d); // preferências da versão de um vault só
  ui.tabs = JSON.parse(pref(vkey('tabs'), old('tabs', '[]')));
  ui.active = pref(vkey('active'), old('active', '')) || null;
  ui.expanded = new Set<string>(JSON.parse(pref(vkey('expanded'), old('expanded', '[]'))));
  ui.selectedFolder = '';
}
function persistUi() {
  setPref(vkey('tabs'), JSON.stringify(ui.tabs)); setPref(vkey('active'), ui.active || '');
  setPref(vkey('expanded'), JSON.stringify([...ui.expanded])); setPref('sidebar', ui.sidebar ? '1' : '0'); setPref('panel', ui.panel ? '1' : '0');
}

// ---------------------------------------------------------------- theme
function applyTheme() {
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const term = ui.term ? findTheme(ui.term) : undefined;
  const eff = term ? term.kind : ui.theme === 'system' ? (dark ? 'dark' : 'light') : ui.theme;
  document.documentElement.dataset.theme = eff;
  applyTermTheme(term);
  document.documentElement.dataset.font = ui.font;
  document.documentElement.dataset.width = ui.width;
  document.documentElement.dataset.align = ui.align;
  $('meta[name=theme-color]')?.setAttribute('content', term ? term.bg : eff === 'dark' ? '#17161c' : eff === 'sepia' ? '#f6efe2' : '#fcfbfe');
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

// ---------------------------------------------------------------- shell
const app = $('#app');
function shell() {
  app.replaceChildren(
    h('aside', { class: 'sidebar', id: 'sidebar', 'aria-label': t.files },
      h('div', { class: 'side-head' },
        h('div', { class: 'brand' }, h('img', { src: '/brand/cube4notes.png', alt: '', width: 26, height: 26 }), h('span', { class: 'wordmark' }, 'Cube', h('b', {}, '4'), 'Notes')),
        iconBtn('PanelLeft', t.cmdToggleSidebar, () => toggleSidebar(false), 'only-mobile-hide'),
      ),
      h('div', { id: 'vault-switch' }),
      h('button', { class: 'quick', onclick: () => openPalette() }, ic('Search', 15), h('span', {}, t.paletteHint.split(',')[0]), h('kbd', {}, mod + ' K')),
      h('div', { class: 'side-tabs', role: 'tablist' },
        sideTab('files', 'Folder', t.files), sideTab('search', 'Search', t.search),
        h('span', { class: 'grow' }),
        iconBtn('FilePlus', t.newNote + '  (Alt+N)', () => newNote(ui.selectedFolder)),
        iconBtn('FolderPlus', t.newFolder, () => newFolder(ui.selectedFolder)),
      ),
      h('div', { class: 'side-body', id: 'side-body' }),
      h('a', { class: 'side-credit', href: 'https://cube4code.com/', target: '_blank', rel: 'noopener noreferrer' },
        h('img', { src: '/brand/cube4code-symbol.png', alt: '', width: 20, height: 22 }),
        h('span', {}, t.developedBy + ' ', h('b', {}, 'Cube', h('i', {}, '4'), 'Code'))),
      h('div', { class: 'side-foot' },
        h('button', { class: 'sync-pill', id: 'sync-pill', onclick: () => S.sync() }),
        iconBtn('Settings', t.settings, (e: MouseEvent) => openSettings(e.currentTarget as HTMLElement)),
      ),
    ),
    h('div', { class: 'scrim', onclick: () => toggleSidebar(false) }),
    h('main', { class: 'main' },
      h('div', { class: 'tabbar' },
        iconBtn('Menu', t.menu, () => toggleSidebar(), 'sidebar-toggle'),
        h('div', { class: 'tabs', id: 'tabs', role: 'tablist', 'aria-label': t.openNotes }),
        h('div', { class: 'tabbar-tools' },
          h('div', { class: 'seg', id: 'mode-seg' },
            h('button', { dataset: { mode: 'visual' }, onclick: () => setSource(false), title: `${t.visual}  (${mod}+/)` }, ic('Eye', 15), h('span', {}, t.visual)),
            h('button', { dataset: { mode: 'md' }, onclick: () => setSource(true), title: `${t.markdown}  (${mod}+/)` }, ic('Code', 15), h('span', {}, t.markdown)),
          ),
          iconBtn('PanelRight', t.cmdTogglePanel, () => togglePanel(), 'panel-toggle'),
        ),
      ),
      h('div', { class: 'scroller', id: 'scroller' }, h('div', { class: 'doc', id: 'doc' })),
      h('footer', { class: 'statusbar', id: 'statusbar' }),
    ),
    h('aside', { class: 'panel', id: 'panel' }),
  );
  $('#scroller').addEventListener('scroll', trackOutline, { passive: true });
  renderAll();
}
function iconBtn(name: IconName, label: string, onclick: (e: any) => void, cls = '') {
  return h('button', { class: 'icon-btn ' + cls, title: label, 'aria-label': label, onclick }, ic(name, 17));
}
function sideTab(v: 'files' | 'search', icon: IconName, label: string) {
  return h('button', { class: 'side-tab', role: 'tab', dataset: { view: v }, title: label, 'aria-label': label, onclick: () => setView(v) }, ic(icon, 16));
}
function setView(v: 'files' | 'search') { ui.view = v; renderSide(); if (v === 'search') setTimeout(() => $<HTMLInputElement>('#search-input')?.focus()); }
function toggleSidebar(force?: boolean) { ui.sidebar = force ?? !ui.sidebar; app.classList.toggle('no-sidebar', !ui.sidebar); persistUi(); }
function togglePanel(force?: boolean) { ui.panel = force ?? !ui.panel; app.classList.toggle('no-panel', !ui.panel); persistUi(); renderPanel(); }
const mobile = () => innerWidth <= 820;

function renderAll() {
  app.classList.toggle('no-sidebar', !ui.sidebar); app.classList.toggle('no-panel', !ui.panel);
  renderVaultSwitch(); renderSide(); renderTabs(); renderDoc(); renderStatus(); renderPanel();
}

// ---------------------------------------------------------------- sidebar: tree
interface TNode { name: string; path: string; folder: boolean; kids: TNode[]; }
function buildTree(): TNode {
  const root: TNode = { name: '', path: '', folder: true, kids: [] };
  const map = new Map<string, TNode>([['', root]]);
  const folderNode = (p: string): TNode => {
    if (map.has(p)) return map.get(p)!;
    const n: TNode = { name: p.split('/').pop()!, path: p, folder: true, kids: [] };
    map.set(p, n); folderNode(dirOf(p)).kids.push(n); return n;
  };
  for (const f of S.folders) folderNode(f);
  for (const p of S.notes.keys()) folderNode(dirOf(p)).kids.push({ name: baseName(p), path: p, folder: false, kids: [] });
  const sort = (n: TNode) => { n.kids.sort((a, b) => (a.folder === b.folder ? a.name.localeCompare(b.name, lang, { numeric: true, sensitivity: 'base' }) : a.folder ? -1 : 1)); n.kids.forEach(sort); };
  sort(root); return root;
}
function renderSide() {
  document.querySelectorAll<HTMLElement>('.side-tab').forEach(b => b.classList.toggle('on', b.dataset.view === ui.view));
  const body = $('#side-body'); if (!body) return;
  if (ui.view === 'search') return renderSearch(body);
  const tree = buildTree();
  const list = h('div', { class: 'tree', role: 'tree' });
  if (!S.activeVault) {
    if (S.syncState !== 'syncing') list.append(h('div', { class: 'tree-empty' }, h('p', {}, S.syncState === 'idle' ? t.noAccess : t.pairUnreachable)));
  } else if (!tree.kids.length) {
    list.append(h('div', { class: 'tree-empty' }, h('p', {}, t.emptyVault), h('button', { class: 'btn primary', onclick: () => newNote('') }, ic('Plus', 15), t.newNote)));
  }
  const walk = (n: TNode, depth: number) => {
    for (const k of n.kids) {
      list.append(treeRow(k, depth));
      if (k.folder && ui.expanded.has(k.path)) walk(k, depth + 1);
    }
  };
  walk(tree, 0);
  // soltar na área vazia = mover para a raiz
  list.addEventListener('dragover', e => { if (dragPath) { e.preventDefault(); list.classList.add('drop-root'); } });
  list.addEventListener('dragleave', e => { if (e.target === list) list.classList.remove('drop-root'); });
  list.addEventListener('drop', e => { list.classList.remove('drop-root'); if (dragPath && !(e.target as HTMLElement).closest('.row.folder')) { e.preventDefault(); dropInto(''); } });
  const scrollTop = body.scrollTop;
  const focused = (document.activeElement as HTMLElement | null)?.closest?.('.row') as HTMLElement | null;
  body.replaceChildren(list);
  body.scrollTop = scrollTop;
  if (focused?.dataset.path) list.querySelector<HTMLElement>(`.row[data-path="${CSS.escape(focused.dataset.path)}"]`)?.focus({ preventScroll: true });
}
let dragPath: string | null = null;
function treeRow(n: TNode, depth: number) {
  const open = ui.expanded.has(n.path);
  const conflicted = !n.folder && S.conflicts.some(c => c.copy === n.path || c.path === n.path);
  const row = h('div', {
    class: 'row' + (n.folder ? ' folder' : ' note') + (n.path === ui.active ? ' active' : '') + (n.folder && n.path === ui.selectedFolder ? ' selected' : ''),
    role: 'treeitem', tabindex: '0', draggable: 'true', 'aria-expanded': n.folder ? String(open) : null,
    style: `--depth:${depth}`, dataset: { path: n.path },
    onclick: () => { if (n.folder) { ui.selectedFolder = n.path; toggleFolder(n.path); } else { ui.selectedFolder = dirOf(n.path); openNote(n.path); if (mobile()) toggleSidebar(false); } },
    oncontextmenu: (e: MouseEvent) => { e.preventDefault(); rowMenu(n, e.clientX, e.clientY); },
    onkeydown: (e: KeyboardEvent) => {
      if (e.key === 'Enter') (e.currentTarget as HTMLElement).click();
      if (e.key === 'F2') renameInline(n);
      if (e.key === 'Delete') confirmDelete(n);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const rows = [...document.querySelectorAll<HTMLElement>('.tree .row')]; rows[rows.indexOf(e.currentTarget as HTMLElement) + (e.key === 'ArrowDown' ? 1 : -1)]?.focus(); }
      if (n.folder && e.key === 'ArrowRight' && !open) toggleFolder(n.path);
      if (n.folder && e.key === 'ArrowLeft' && open) toggleFolder(n.path);
    },
    ondragstart: (e: DragEvent) => { dragPath = n.path; e.dataTransfer!.effectAllowed = 'move'; e.dataTransfer!.setData('text/plain', n.path); },
    ondragend: () => { dragPath = null; document.querySelectorAll('.drop').forEach(x => x.classList.remove('drop')); },
  },
    n.folder ? h('span', { class: 'chev' + (open ? ' open' : '') }, ic('ChevronRight', 14)) : h('span', { class: 'chev' }),
    n.folder ? null : null,
    h('span', { class: 'name' }, n.name),
    conflicted ? h('span', { class: 'flag', title: t.conflictTitle }, ic('TriangleAlert', 13)) : null,
    h('button', { class: 'row-more', tabindex: '-1', 'aria-label': t.menu, onclick: (e: MouseEvent) => { e.stopPropagation(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); rowMenu(n, r.right, r.bottom); } }, ic('Ellipsis', 15)),
  );
  if (n.folder) {
    row.addEventListener('dragover', e => { if (dragPath && canDrop(dragPath, n.path)) { e.preventDefault(); e.stopPropagation(); row.classList.add('drop'); } });
    row.addEventListener('dragleave', () => row.classList.remove('drop'));
    row.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); row.classList.remove('drop'); dropInto(n.path); });
  }
  return row;
}
const canDrop = (from: string, toFolder: string) => from !== toFolder && !toFolder.startsWith(from + '/') && dirOf(from) !== toFolder;
async function dropInto(folder: string) {
  const from = dragPath; dragPath = null; if (!from || !canDrop(from, folder)) return;
  const to = join(folder, from.split('/').pop()!);
  if (S.notes.has(to) || S.folders.has(to)) return toast(t.renameExists, 'warn');
  await S.move(from, to); if (folder) ui.expanded.add(folder); persistUi(); toast(t.moved);
}
function toggleFolder(p: string) { ui.expanded.has(p) ? ui.expanded.delete(p) : ui.expanded.add(p); persistUi(); renderSide(); }
function rowMenu(n: TNode, x: number, y: number) {
  const target = n.folder ? n.path : dirOf(n.path);
  menu(x, y, [
    { icon: 'FilePlus', label: t.newNoteHere, run: () => newNote(target) },
    { icon: 'FolderPlus', label: t.newFolderHere, run: () => newFolder(target) },
    null,
    { icon: 'Pencil', label: t.rename, run: () => renameInline(n), hint: 'F2' },
    { icon: 'Trash2', label: t.delete, run: () => confirmDelete(n), danger: true },
  ]);
}
function renameInline(n: TNode) {
  const row = document.querySelector<HTMLElement>(`.row[data-path="${CSS.escape(n.path)}"]`); if (!row) return;
  const name = row.querySelector('.name')!;
  const input = h('input', { class: 'rename', value: n.name, 'aria-label': t.rename });
  name.replaceWith(input); input.focus(); input.select();
  let done = false;
  const finish = async (ok: boolean) => {
    if (done) return; done = true;
    const v = input.value.trim();
    if (!ok || !v || v === n.name) return renderSide();
    if (badName(v)) { toast(t.invalidName, 'warn'); return renderSide(); }
    const to = join(dirOf(n.path), n.folder ? v : v + '.md');
    if (S.notes.has(to) || S.folders.has(to)) { toast(t.renameExists, 'warn'); return renderSide(); }
    await S.move(n.path, to);
  };
  input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); });
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('click', e => e.stopPropagation());
}
function confirmDelete(n: TNode) {
  dialog(n.folder ? t.deleteFolderQ(n.name) : t.deleteNoteQ(n.name), t.deleteHint, t.confirmDelete, async () => {
    if (n.folder) await S.deleteFolder(n.path); else await S.deleteNote(n.path);
  }, true);
}

// ---------------------------------------------------------------- sidebar: search
let searchQuery = '';
const plain = (s: string) => s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/^\s*([-*+]|\d+\.)\s+(\[[ xX]\]\s+)?/gm, '').replace(/[#*_`>|]+/g, '').replace(/\s+/g, ' ');
function renderSearch(body: HTMLElement) {
  const input = h('input', { id: 'search-input', class: 'search-input', type: 'search', placeholder: t.searchPlaceholder, value: searchQuery, 'aria-label': t.searchNotes });
  const results = h('div', { class: 'results' });
  const run = () => {
    searchQuery = input.value;
    results.replaceChildren();
    const q = fold(searchQuery.trim()); if (q.length < 2) return;
    let count = 0;
    for (const n of [...S.notes.values()].sort((a, b) => b.modified - a.modified)) {
      const titleHit = fold(baseName(n.path)).includes(q);
      const text = n.content; const ft = fold(text);
      const hits: number[] = []; let i = ft.indexOf(q);
      while (i >= 0 && hits.length < 3) { hits.push(i); i = ft.indexOf(q, i + q.length); }
      if (!titleHit && !hits.length) continue;
      const group = h('div', { class: 'hit' }, h('button', { class: 'hit-title', onclick: () => openNote(n.path) }, ic('FileText', 14), h('span', {}, baseName(n.path)), h('small', {}, dirOf(n.path))));
      for (const at of hits) {
        const s = Math.max(0, at - 40), e = Math.min(text.length, at + q.length + 60);
        group.append(h('button', { class: 'snippet', onclick: () => openNote(n.path, searchQuery.trim()) },
          (s > 0 ? '…' : '') + plain(text.slice(s, at)), h('mark', {}, text.slice(at, at + q.length)), plain(text.slice(at + q.length, e)) + (e < text.length ? '…' : '')));
      }
      results.append(group);
      if (++count >= 100) break;
    }
    if (!count) results.append(h('p', { class: 'muted pad' }, t.noResults));
  };
  input.addEventListener('input', run);
  body.replaceChildren(h('div', { class: 'search' }, input, results));
  run();
}

// ---------------------------------------------------------------- tabs
function renderTabs() {
  const el = $('#tabs'); if (!el) return;
  el.replaceChildren(...ui.tabs.map(p => h('div', {
    class: 'tab' + (p === ui.active ? ' active' : ''), role: 'tab', 'aria-selected': String(p === ui.active), title: p,
    onclick: () => openNote(p), onauxclick: (e: MouseEvent) => { if (e.button === 1) closeTab(p); },
  },
    h('span', { class: 'tab-name' }, baseName(p)),
    S.hasPendingPut(p) ? h('span', { class: 'dot', title: t.pending(1) }) : null,
    h('button', { class: 'tab-x', 'aria-label': t.closeTab, onclick: (e: MouseEvent) => { e.stopPropagation(); closeTab(p); } }, ic('X', 13)),
  )), h('button', { class: 'tab-new icon-btn', title: t.newNote, 'aria-label': t.newNote, onclick: () => newNote(ui.active ? dirOf(ui.active) : '') }, ic('Plus', 16)));
  el.querySelector('.tab.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  document.querySelectorAll<HTMLElement>('#mode-seg button').forEach(b => b.classList.toggle('on', (b.dataset.mode === 'md') === ui.source));
}
function closeTab(p: string) {
  const i = ui.tabs.indexOf(p); if (i < 0) return;
  ui.tabs.splice(i, 1);
  if (ui.active === p) { const next = ui.tabs[i] || ui.tabs[i - 1] || null; ui.active = null; if (next) openNote(next); else { flushWrite(); renderDoc(); } }
  persistUi(); renderTabs(); renderSide();
}

// ---------------------------------------------------------------- document
function splitFrontmatter(src: string): [string, string] {
  const m = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(src);
  return m ? [m[0], src.slice(m[0].length)] : ['', src];
}
async function openNote(path: string, highlight?: string) {
  if (!S.notes.has(path)) return;
  flushWrite();
  if (!ui.tabs.includes(path)) { const i = ui.active ? ui.tabs.indexOf(ui.active) + 1 : ui.tabs.length; ui.tabs.splice(i, 0, path); }
  ui.active = path; persistUi();
  // garante que as pastas da nota fiquem abertas na árvore
  const parts = path.split('/'); for (let i = 1; i < parts.length; i++) ui.expanded.add(parts.slice(0, i).join('/'));
  renderTabs(); renderSide(); await renderDoc(); renderPanel();
  if (highlight) findInEditor(highlight);
}
function flushWrite() { if (writeTimer) { clearTimeout(writeTimer); writeTimer = 0; commitEditor(); } }
function commitEditor() {
  if (!editorPath || editorVault !== S.activeVault || !S.notes.has(editorPath)) return;
  const note = S.notes.get(editorPath)!;
  let content: string;
  if (ui.source) content = ($<HTMLTextAreaElement>('#source')?.value ?? note.content);
  else { if (!editor) return; const md = editor.getMarkdown(); if (md === baseline) return; content = frontmatter + md; }
  if (content !== note.content) S.writeNote(editorPath, content, editorVault).then(() => { renderTabs(); renderStatus(); renderPanel(); });
}
function scheduleWrite() { clearTimeout(writeTimer); writeTimer = setTimeout(() => { writeTimer = 0; commitEditor(); }, 350); renderStatus(true); }

async function renderDoc(keepScroll = false) {
  const doc = $('#doc'); if (!doc) return;
  const seq = ++mountSeq;
  const scroller = $('#scroller'); const top = keepScroll ? scroller.scrollTop : 0;
  editor?.destroy(); editor = null; editorPath = null;
  const path = ui.active;
  if (!path || !S.notes.has(path)) { ui.active = null; doc.replaceChildren(emptyState()); doc.className = 'doc empty'; renderStatus(); return; }
  doc.className = 'doc';
  const note = S.notes.get(path)!;
  const [fm, body] = splitFrontmatter(note.content);
  frontmatter = fm;
  const title = h('input', { class: 'title', id: 'title', value: baseName(path), 'aria-label': t.rename, spellcheck: 'false', placeholder: t.untitled });
  title.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); editor?.focus(); } if (e.key === 'Escape') { title.value = baseName(path); title.blur(); } });
  title.addEventListener('change', () => renameActive(title.value));
  const crumbs = h('nav', { class: 'crumbs', 'aria-label': 'path' }, ...dirOf(path).split('/').filter(Boolean).flatMap((seg, i, arr) => [
    h('button', { onclick: () => { const f = arr.slice(0, i + 1).join('/'); ui.expanded.add(f); ui.selectedFolder = f; setView('files'); toggleSidebar(true); renderSide(); } }, seg), h('span', { class: 'sep' }, '/'),
  ]));
  const host = h('div', { class: 'editor-host', id: 'editor-host' });
  const parts: (Node | null)[] = [conflictBanner(path), crumbs, title];
  if (fm && !ui.source) {
    const ta = h('textarea', { class: 'props-raw', spellcheck: 'false', rows: String(fm.split('\n').length) }, fm.replace(/^---\r?\n|\r?\n---\r?\n?$/g, ''));
    ta.addEventListener('input', () => { frontmatter = '---\n' + ta.value.replace(/\n+$/, '') + '\n---\n'; baseline = '\u0000'; scheduleWrite(); });
    const keys = fm.split('\n').map(l => /^([\w-]+):/.exec(l)?.[1]).filter(Boolean) as string[];
    parts.push(h('details', { class: 'props' }, h('summary', {}, ic('Hash', 14), h('span', {}, t.properties), h('span', { class: 'props-keys' }, keys.slice(0, 6).join(', '))), ta));
  }
  parts.push(host);
  doc.replaceChildren(...parts.filter(Boolean) as Node[]);
  if (ui.source) {
    const ta = h('textarea', { id: 'source', class: 'source', spellcheck: 'false', 'aria-label': t.markdown }, note.content);
    ta.value = note.content;
    const grow = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
    ta.addEventListener('input', () => { grow(); scheduleWrite(); });
    host.append(ta); editorPath = path; editorVault = S.activeVault; requestAnimationFrame(grow);
  } else {
    const ed = await mountEditor(host, body, { topBar: ui.topBar, notePath: path, onChange: () => scheduleWrite() });
    if (seq !== mountSeq) { ed.destroy(); return; }
    editor = ed; editorPath = path; editorVault = S.activeVault;
    baseline = ed.getMarkdown();
  }
  scroller.scrollTop = top;
  renderStatus(); renderPanel();
}
async function renameActive(v: string) {
  const path = ui.active; if (!path) return;
  v = v.trim();
  if (!v || v === baseName(path)) { ($('#title') as HTMLInputElement).value = baseName(path); return; }
  if (badName(v)) { toast(t.invalidName, 'warn'); ($('#title') as HTMLInputElement).value = baseName(path); return; }
  const to = join(dirOf(path), v + '.md');
  if (S.notes.has(to)) { toast(t.renameExists, 'warn'); ($('#title') as HTMLInputElement).value = baseName(path); return; }
  flushWrite();
  await S.move(path, to);
}
function emptyState() {
  const sc = (k: string, l: string) => h('div', { class: 'sc' }, h('kbd', {}, k), h('span', {}, l));
  return h('div', { class: 'empty-card' },
    h('img', { class: 'empty-logo', src: '/brand/cube4notes.png', alt: '', width: 72, height: 72 }),
    h('h2', {}, t.emptyTitle),
    h('p', {}, t.emptyBody),
    h('div', { class: 'empty-actions' },
      h('button', { class: 'btn primary', onclick: () => newNote(ui.selectedFolder) }, ic('FilePlus', 16), t.newNote),
      h('button', { class: 'btn', onclick: () => openPalette() }, ic('Search', 16), t.scQuick)),
    h('div', { class: 'shortcuts' },
      sc(mod + ' K', t.scQuick), sc(mod + ' Shift F', t.scSearch), sc('Alt N', t.scNew), sc(mod + ' /', t.scSource), sc('/', t.scSlash)),
  );
}
function setSource(on: boolean) { if (ui.source === on) return; flushWrite(); ui.source = on; renderTabs(); renderDoc(true); }

function findInEditor(q: string) {
  setTimeout(() => {
    const root = $('#editor-host'); if (!root) return;
    const fq = fold(q);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const i = fold(n.textContent || '').indexOf(fq);
      if (i >= 0) {
        const r = document.createRange(); r.setStart(n, i); r.setEnd(n, Math.min((n.textContent || '').length, i + q.length));
        const sel = getSelection()!; sel.removeAllRanges(); sel.addRange(r);
        (n.parentElement as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
    }
  }, 60);
}

// links: Ctrl/⌘+clique abre; links relativos para .md abrem a nota
document.addEventListener('click', e => {
  const a = (e.target as HTMLElement).closest('#editor-host a') as HTMLAnchorElement | null;
  if (!a) return;
  const href = a.getAttribute('href') || '';
  if (!(e.ctrlKey || e.metaKey)) return;
  e.preventDefault();
  // só abre esquemas seguros; javascript:, data:, file: etc. são ignorados
  if (/^(https?:|mailto:)/i.test(href)) { window.open(href, '_blank', 'noopener,noreferrer'); return; }
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return;
  const target = resolveLink(ui.active || '', href);
  if (target && S.notes.has(target)) openNote(target);
}, true);
function resolveLink(from: string, href: string): string | null {
  let h0 = href.split('#')[0]; try { h0 = decodeURIComponent(h0); } catch {}
  if (!h0) return null;
  const parts = (h0.startsWith('/') ? h0.slice(1) : join(dirOf(from), h0)).split('/');
  const out: string[] = []; for (const p of parts) { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); }
  let p = out.join('/'); if (!/\.md$/i.test(p)) p += '.md';
  return p;
}

// ---------------------------------------------------------------- conflicts
function conflictBanner(path: string): HTMLElement | null {
  const c = S.conflicts.find(c => c.path === path || c.copy === path); if (!c) return null;
  const isCopy = c.copy === path;
  return h('div', { class: 'banner', role: 'status' }, ic('TriangleAlert', 18),
    h('div', { class: 'banner-text' }, h('strong', {}, t.conflictTitle), h('p', {}, isCopy ? t.conflictCopyBody : t.conflictBody(baseName(c.copy)))),
    h('div', { class: 'banner-actions' },
      h('button', { class: 'btn small', onclick: () => compare(c.path, c.copy) }, ic('GitCompare', 14), t.compare),
      h('button', { class: 'btn small', onclick: () => openNote(isCopy ? c.path : c.copy) }, isCopy ? t.openOriginal : t.openCopy),
      h('button', { class: 'btn small ghost', onclick: () => { S.dismissConflict(path); renderDoc(true); renderSide(); } }, t.dismiss)));
}
function diffLines(a: string[], b: string[]) {
  const n = a.length, m = b.length;
  if (n * m > 4_000_000) return [...a.map(l => ({ k: '-', l })), ...b.map(l => ({ k: '+', l }))];
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: { k: string; l: string }[] = []; let i = 0, j = 0;
  while (i < n && j < m) { if (a[i] === b[j]) { out.push({ k: ' ', l: a[i] }); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ k: '-', l: a[i++] }); else out.push({ k: '+', l: b[j++] }); }
  while (i < n) out.push({ k: '-', l: a[i++] }); while (j < m) out.push({ k: '+', l: b[j++] });
  return out;
}
function compare(orig: string, copy: string) {
  const a = S.notes.get(orig)?.content ?? '', b = S.notes.get(copy)?.content ?? '';
  const rows = diffLines(a.split('\n'), b.split('\n'));
  modal(t.compareTitle, h('div', { class: 'diff' },
    h('div', { class: 'diff-legend' }, h('span', { class: 'lg del' }, '− ' + baseName(orig)), h('span', { class: 'lg add' }, '+ ' + baseName(copy))),
    h('pre', {}, ...rows.map(r => h('div', { class: 'dl ' + (r.k === '-' ? 'del' : r.k === '+' ? 'add' : '') }, h('span', { class: 'dk' }, r.k), r.l || ' ')))), 'wide');
}

// ---------------------------------------------------------------- right panel
let headingEls: HTMLElement[] = [];
function renderPanel() {
  const el = $('#panel'); if (!el) return;
  if (!ui.panel || !ui.active || !S.notes.has(ui.active)) { el.replaceChildren(); return; }
  const content = S.notes.get(ui.active)!.content;
  const heads: { level: number; text: string }[] = [];
  let fence = false;
  for (const line of splitFrontmatter(content)[1].split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const m = !fence && /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) heads.push({ level: m[1].length, text: m[2].replace(/[*_`~]|\[([^\]]*)\]\([^)]*\)/g, '$1') });
  }
  const min = Math.min(...heads.map(x => x.level), 6);
  const outline = heads.length
    ? h('ol', { class: 'outline' }, ...heads.map((x, i) => h('li', { style: `--lvl:${x.level - min}` }, h('button', { dataset: { i: String(i) }, onclick: () => jumpHeading(i) }, x.text))))
    : h('p', { class: 'muted' }, t.noHeadings);
  const links: HTMLElement[] = [];
  const me = ui.active, myName = fold(baseName(me));
  for (const n of S.notes.values()) {
    if (n.path === me) continue;
    const lines = n.content.split('\n'); let hit = '';
    for (const line of lines) {
      let found = false;
      for (const m of line.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) if (resolveLink(n.path, m[1]) === me) found = true;
      for (const m of line.matchAll(/\[\[([^\]|#]+)/g)) if (fold(m[1].trim()) === myName) found = true;
      if (found) { hit = line.trim(); break; }
    }
    if (hit) links.push(h('button', { class: 'backlink', onclick: () => openNote(n.path) }, h('span', { class: 'bl-name' }, ic('FileText', 13), baseName(n.path)), h('span', { class: 'bl-line' }, plain(hit).replace(/\[\[([^\]|]+)(\|[^\]]*)?\]\]/g, '$1').trim().slice(0, 120))));
  }
  el.replaceChildren(
    h('section', {}, h('h3', {}, ic('ListTree', 14), t.outline), outline),
    h('section', {}, h('h3', {}, ic('Link', 14), t.backlinks), links.length ? h('div', { class: 'backlinks' }, ...links) : h('p', { class: 'muted' }, t.noBacklinks)),
  );
  headingEls = [];
  trackOutline();
}
function currentHeadingEls() { return [...document.querySelectorAll<HTMLElement>('#editor-host .ProseMirror > :is(h1,h2,h3,h4,h5,h6)')]; }
function jumpHeading(i: number) {
  if (ui.source) { const ta = $<HTMLTextAreaElement>('#source'); const lines = ta.value.split('\n'); let k = -1, fence = false; for (let l = 0; l < lines.length; l++) { if (/^\s*(```|~~~)/.test(lines[l])) fence = !fence; if (!fence && /^#{1,6}\s/.test(lines[l]) && ++k === i) { const pos = lines.slice(0, l).join('\n').length; ta.focus(); ta.setSelectionRange(pos + 1, pos + 1); ta.blur(); ta.focus(); return; } } return; }
  currentHeadingEls()[i]?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}
function trackOutline() {
  if (!ui.panel) return;
  headingEls = currentHeadingEls();
  const top = $('#scroller')?.getBoundingClientRect().top ?? 0;
  let cur = -1; headingEls.forEach((el, i) => { if (el.getBoundingClientRect().top - top < 120) cur = i; });
  document.querySelectorAll<HTMLElement>('.outline button').forEach(b => b.classList.toggle('on', Number(b.dataset.i) === cur));
}

// ---------------------------------------------------------------- status
function renderStatus(typing = false) {
  const bar = $('#statusbar'); if (!bar) return;
  const n = ui.active ? S.notes.get(ui.active) : null;
  const words = n ? (splitFrontmatter(n.content)[1].replace(/[#>*_`\-[\]()|]/g, ' ').match(/[\p{L}\p{N}]+/gu) || []).length : 0;
  const pending = S.pendingCount();
  let state: string, icon: IconName, cls: string;
  if (S.syncState === 'syncing') { state = t.syncing; icon = 'RefreshCw'; cls = 'busy'; }
  else if (S.syncState === 'offline' || S.syncState === 'unauthorized') { state = pending ? `${t.offline} · ${t.pending(pending)}` : t.offline; icon = 'CloudOff'; cls = 'off'; }
  else if (pending) { state = t.pending(pending); icon = 'Cloud'; cls = 'pending'; }
  else { state = t.synced; icon = 'Cloud'; cls = 'ok'; }
  const pill = $('#sync-pill');
  if (pill) { pill.className = 'sync-pill ' + cls; pill.title = t.syncNow; pill.replaceChildren(ic(icon, 14), h('span', {}, state)); }
  bar.replaceChildren(...[
    h('span', {}, n ? t.words(words) : ''),
    n && words > 200 ? h('span', {}, t.minutes(Math.max(1, Math.round(words / 220)))) : null,
    h('span', { class: 'grow' }),
    n ? h('span', { class: 'save-state' }, typing ? '…' : S.syncState === 'offline' || S.syncState === 'unauthorized' ? t.savedLocal : t.saved) : null,
  ].filter(Boolean) as Node[]);
}

// ---------------------------------------------------------------- create
function uniquePath(folder: string, name: string, ext = '.md') {
  let p = join(folder, name + ext), i = 2;
  while (S.notes.has(p) || S.folders.has(p)) p = join(folder, `${name} ${i++}${ext}`);
  return p;
}
async function newNote(folder = '', name?: string) {
  const p = uniquePath(folder, name || t.untitled);
  await S.createNote(p, '');
  if (folder) ui.expanded.add(folder);
  await openNote(p);
  if (mobile()) toggleSidebar(false);
  if (!name) { const ti = $<HTMLInputElement>('#title'); ti?.focus(); ti?.select(); } else editor?.focus();
}
function newFolder(parent = '') {
  prompt(t.folderName, t.create, async v => {
    if (badName(v)) return toast(t.invalidName, 'warn');
    const p = join(parent, v.trim());
    if (S.folders.has(p) || S.notes.has(p)) return toast(t.renameExists, 'warn');
    await S.createFolder(p); if (parent) ui.expanded.add(parent); ui.expanded.add(p); ui.selectedFolder = p; persistUi(); renderSide();
  });
}

// ---------------------------------------------------------------- overlays
function overlay(content: HTMLElement, cls = '', onClose?: () => void) {
  const prev = document.activeElement as HTMLElement | null;
  const wrap = h('div', { class: 'overlay ' + cls, onmousedown: (e: MouseEvent) => { if (e.target === wrap) close(); } }, content);
  const close = () => { wrap.remove(); document.removeEventListener('keydown', esc, true); onClose?.(); prev?.focus?.(); };
  const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
  document.addEventListener('keydown', esc, true);
  document.body.append(wrap);
  return close;
}
function modal(title: string, body: HTMLElement, cls = '') {
  let close = () => {};
  const box = h('div', { class: 'modal ' + cls, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'modal-head' }, h('h2', {}, title), h('button', { class: 'icon-btn', 'aria-label': t.cancel, onclick: () => close() }, ic('X', 17))), body);
  close = overlay(box);
  (box.querySelector('button') as HTMLElement).focus();
}
function dialog(title: string, text: string, okLabel: string, ok: () => void, danger = false) {
  let close = () => {};
  const okBtn = h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => { close(); ok(); } }, okLabel);
  const box = h('div', { class: 'modal small', role: 'alertdialog', 'aria-modal': 'true' },
    h('h2', {}, title), h('p', { class: 'muted' }, text),
    h('div', { class: 'modal-actions' }, h('button', { class: 'btn', onclick: () => close() }, t.cancel), okBtn));
  close = overlay(box); okBtn.focus();
}
function prompt(label: string, okLabel: string, ok: (v: string) => void, value = '') {
  let close = () => {};
  const input = h('input', { class: 'field', 'aria-label': label, autocomplete: 'off', value });
  const form = h('form', { class: 'modal small', onsubmit: (e: Event) => { e.preventDefault(); if (!input.value.trim()) return; close(); ok(input.value); } },
    h('label', { class: 'label' }, label), input,
    h('div', { class: 'modal-actions' }, h('button', { class: 'btn', type: 'button', onclick: () => close() }, t.cancel), h('button', { class: 'btn primary', type: 'submit' }, okLabel)));
  close = overlay(form); input.focus(); input.select();
}
type MenuItem = { icon: IconName; label: string; run: () => void; hint?: string; danger?: boolean } | null;
function menu(x: number, y: number, items: MenuItem[]) {
  let close = () => {};
  const box = h('div', { class: 'menu', role: 'menu' }, ...items.map(it => it ? h('button', { role: 'menuitem', class: it.danger ? 'danger' : '', onclick: () => { close(); it.run(); } }, ic(it.icon, 15), h('span', {}, it.label), it.hint ? h('kbd', {}, it.hint) : null) : h('hr')));
  close = overlay(box, 'clear');
  const r = box.getBoundingClientRect();
  box.style.left = Math.min(x, innerWidth - r.width - 8) + 'px'; box.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
  (box.querySelector('button') as HTMLElement)?.focus();
  box.addEventListener('keydown', e => { const bs = [...box.querySelectorAll('button')]; const i = bs.indexOf(document.activeElement as any); if (e.key === 'ArrowDown') { e.preventDefault(); bs[(i + 1) % bs.length].focus(); } if (e.key === 'ArrowUp') { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); } });
}
let toastTimer: any;
function toast(text: string, kind: 'ok' | 'warn' = 'ok') {
  document.querySelector('.toast')?.remove();
  const el = h('div', { class: 'toast ' + kind, role: 'status' }, ic(kind === 'ok' ? 'Check' : 'TriangleAlert', 15), text);
  document.body.append(el); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.remove(), 3200);
}

// ---------------------------------------------------------------- palette
function fuzzy(q: string, s: string): number {
  q = fold(q); s = fold(s); if (!q) return 1;
  const i = s.indexOf(q); if (i >= 0) return 1000 - i - s.length * 0.1 + (i === 0 || s[i - 1] === '/' || s[i - 1] === ' ' ? 200 : 0);
  let si = 0, score = 0, run = 0;
  for (const c of q) { const k = s.indexOf(c, si); if (k < 0) return -1; run = k === si ? run + 1 : 0; score += 1 + run * 3; si = k + 1; }
  return score - s.length * 0.05;
}
function openPalette(initial = '') {
  let close = () => {};
  const input = h('input', { class: 'pal-input', placeholder: t.paletteHint, 'aria-label': t.paletteHint, value: initial, autocomplete: 'off', spellcheck: 'false' });
  const list = h('div', { class: 'pal-list', role: 'listbox' });
  let items: { label: string; sub?: string; icon: IconName; run: () => void; kbd?: string }[] = [], sel = 0;
  const commands = () => [
    { label: t.cmdNewNote, icon: 'FilePlus' as IconName, run: () => newNote(ui.selectedFolder), kbd: 'Alt N' },
    { label: t.cmdNewFolder, icon: 'FolderPlus' as IconName, run: () => newFolder(ui.selectedFolder) },
    { label: t.cmdSearch, icon: 'Search' as IconName, run: () => { toggleSidebar(true); setView('search'); }, kbd: mod + ' Shift F' },
    { label: t.cmdToggleSource, icon: 'Code' as IconName, run: () => setSource(!ui.source), kbd: mod + ' /' },
    { label: t.cmdToggleSidebar, icon: 'PanelLeft' as IconName, run: () => toggleSidebar(), kbd: mod + ' \\' },
    { label: t.cmdTogglePanel, icon: 'PanelRight' as IconName, run: () => togglePanel() },
    { label: t.cmdTheme, icon: 'Settings' as IconName, run: () => { const order = ['light', 'dark', 'sepia', 'system']; ui.theme = order[(order.indexOf(ui.theme) + 1) % 4]; ui.term = ''; setPref('term', ''); setPref('theme', ui.theme); applyTheme(); toast(`${t.theme}: ${({ light: t.themeLight, dark: t.themeDark, sepia: t.themeSepia, system: t.themeSystem } as any)[ui.theme]}`); } },
    { label: t.cmdSync, icon: 'RefreshCw' as IconName, run: () => S.sync() },
    ...termThemes.map(th => ({ label: `${t.termTheme.split(' (')[0]}: ${th.name} (${th.kind === 'dark' ? t.termDark : t.termLight})`, icon: 'Settings' as IconName, run: () => { ui.term = th.id; setPref('term', th.id); applyTheme(); } })),
  ];
  const update = () => {
    const q = input.value;
    if (q.startsWith('>')) items = commands().map(c => ({ ...c, s: fuzzy(q.slice(1).trim(), c.label) })).filter(c => c.s >= 0).sort((a, b) => b.s - a.s);
    else {
      const notes = [...S.notes.values()];
      items = (q.trim() ? notes.map(n => { const a = fuzzy(q, baseName(n.path)); return { n, s: a >= 0 ? a + 50 : fuzzy(q, n.path) }; }).filter(x => x.s >= 0).sort((a, b) => b.s - a.s)
        : notes.sort((a, b) => b.modified - a.modified).map(n => ({ n, s: 0 }))).slice(0, 50)
        .map(({ n }) => ({ label: baseName(n.path), sub: dirOf(n.path), icon: 'FileText' as IconName, run: () => openNote(n.path) }));
      if (q.trim() && !badName(q) && !S.notes.has(join(ui.selectedFolder, q.trim() + '.md'))) items.push({ label: t.createNamed(q.trim()), icon: 'FilePlus', run: () => newNote(ui.selectedFolder, q.trim()) });
    }
    sel = 0; draw();
  };
  const draw = () => {
    list.replaceChildren(...items.map((it, i) => h('button', { class: 'pal-item' + (i === sel ? ' on' : ''), role: 'option', 'aria-selected': String(i === sel), onmousemove: () => { if (sel !== i) { sel = i; draw(); } }, onclick: () => { close(); it.run(); } },
      ic(it.icon, 15), h('span', { class: 'pal-label' }, it.label), it.sub ? h('span', { class: 'pal-sub' }, it.sub) : null, it.kbd ? h('kbd', {}, it.kbd) : null)));
    list.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  };
  input.addEventListener('input', update);
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); draw(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
    if (e.key === 'Enter') { e.preventDefault(); const it = items[sel]; if (it) { close(); it.run(); } }
  });
  const box = h('div', { class: 'palette', role: 'dialog', 'aria-label': t.paletteHint }, h('div', { class: 'pal-head' }, ic('Search', 17), input), list,
    h('div', { class: 'pal-foot' }));
  box.querySelector('.pal-foot')!.replaceChildren(h('span', {}, h('kbd', {}, '↑'), h('kbd', {}, '↓'), h('kbd', {}, '↵')), h('span', {}, h('kbd', {}, '>'), lang === 'pt-BR' ? ' comandos' : ' commands'), h('span', {}, h('kbd', {}, 'Esc')));
  close = overlay(box, 'top');
  input.focus(); update();
}

// ---------------------------------------------------------------- settings
function openSettings(anchor: HTMLElement) {
  let close = () => {};
  const seg = (label: string, value: string, opts: [string, string][], set: (v: string) => void) =>
    h('div', { class: 'set-row' }, h('span', { class: 'set-label' }, label), h('div', { class: 'seg small' }, ...opts.map(([v, l]) => h('button', { class: v === value ? 'on' : '', onclick: (e: MouseEvent) => { set(v); (e.currentTarget as HTMLElement).parentElement!.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === e.currentTarget)); } }, l))));
  const termSelect = h('select', { id: 'term-select', class: 'field term-select' },
    h('option', { value: '' }, t.termNone),
    h('optgroup', { label: t.termDark }, ...termThemes.filter(x => x.kind === 'dark').map(x => h('option', { value: x.id }, x.name))),
    h('optgroup', { label: t.termLight }, ...termThemes.filter(x => x.kind === 'light').map(x => h('option', { value: x.id }, x.name))));
  termSelect.value = ui.term;
  const swatch = h('div', { class: 'swatch', 'aria-hidden': 'true' });
  const drawSwatch = () => { const th = findTheme(termSelect.value); swatch.replaceChildren(...(th ? swatches(th) : []).map(c => h('i', { style: `background:${c}` }))); };
  drawSwatch();
  termSelect.addEventListener('change', () => {
    ui.term = termSelect.value; setPref('term', ui.term); drawSwatch(); applyTheme();
    box.querySelectorAll<HTMLElement>('.seg')[0]?.querySelectorAll('button').forEach(b => b.classList.toggle('on', !ui.term && b.textContent === ({ light: t.themeLight, dark: t.themeDark, sepia: t.themeSepia, system: t.themeSystem } as any)[ui.theme]));
  });
  const box = h('div', { class: 'popover settings' },
    h('h3', {}, t.settings),
    seg(t.theme, ui.term ? '' : ui.theme, [['system', t.themeSystem], ['light', t.themeLight], ['dark', t.themeDark], ['sepia', t.themeSepia]], v => { ui.theme = v; ui.term = ''; setPref('theme', v); setPref('term', ''); termSelect.value = ''; drawSwatch(); applyTheme(); }),
    h('div', { class: 'set-row' }, h('label', { class: 'set-label', for: 'term-select' }, t.termTheme), h('div', { class: 'term-row' }, termSelect, swatch)),
    seg(t.font, ui.font, [['serif', t.fontSerif], ['sans', t.fontSans]], v => { ui.font = v; setPref('font', v); applyTheme(); }),
    seg(t.align, ui.align, [['left', t.alignLeft], ['center', t.alignCenter]], v => { ui.align = v; setPref('align', v); applyTheme(); }),
    seg(t.width, ui.width, [['full', t.widthFull], ['wide', t.widthWide], ['read', t.widthRead]], v => { ui.width = v; setPref('width', v); applyTheme(); }),
    seg(t.toolbarPref, ui.topBar ? '1' : '0', [['1', t.on], ['0', t.off]], v => { ui.topBar = v === '1'; setPref('topbar', v); flushWrite(); renderDoc(true); }),
    seg(t.language, lang, [['pt-BR', 'Português'], ['en', 'English']], v => { flushWrite(); setLang(v as Lang); close(); shell(); }),
    ui.admin ? h('div', { class: 'admin-btns' },
      h('button', { class: 'btn wide connect-btn', onclick: () => { close(); openDevices(); } }, ic('Smartphone', 15), t.connectDevice),
      h('button', { class: 'btn wide', onclick: () => { close(); openVaultsAdmin(); } }, ic('Library', 15), t.manageVaults)) : null,
    h('div', { class: 'set-foot' }, h('span', {}, t.device + ': ', h('b', {}, S.deviceName || '—')), h('button', { class: 'btn small', onclick: () => S.sync() }, ic('RefreshCw', 14), t.syncNow)),
    !isSecureContext ? h('p', { class: 'set-note' }, t.insecure) : null,
    swFailed ? h('div', { class: 'set-note' }, h('p', {}, t.certUntrusted)) : null,
    certHelp(),
  );
  close = overlay(box, 'clear');
  const r = anchor.getBoundingClientRect();
  box.style.left = Math.max(8, Math.min(r.left, innerWidth - box.offsetWidth - 8)) + 'px';
  box.style.top = Math.max(8, r.top - box.offsetHeight - 8) + 'px';
  (box.querySelector('button.on') as HTMLElement)?.focus();
}

// ---------------------------------------------------------------- keyboard
document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase(), c = e.ctrlKey || e.metaKey;
  if (c && !e.shiftKey && (k === 'k' || k === 'p' || k === 'o')) { e.preventDefault(); openPalette(); }
  else if (c && e.shiftKey && k === 'f') { e.preventDefault(); toggleSidebar(true); setView('search'); }
  else if (c && k === 'p' && e.shiftKey) { e.preventDefault(); openPalette('>'); }
  else if (c && k === '/') { e.preventDefault(); setSource(!ui.source); }
  else if (c && k === '\\') { e.preventDefault(); toggleSidebar(); }
  else if (c && k === 's') { e.preventDefault(); flushWrite(); S.scheduleSync(0); toast(t.saved); }
  else if (e.altKey && k === 'n') { e.preventDefault(); newNote(ui.active ? dirOf(ui.active) : ui.selectedFolder); }
  else if (e.key === 'F2' && ui.active && !(e.target as HTMLElement).closest('input, textarea, [contenteditable=true], .row')) {
    e.preventDefault(); const p = ui.active; renameInline({ name: baseName(p), path: p, folder: false, kids: [] });
  }
  else if (e.altKey && k === 'w') { e.preventDefault(); if (ui.active) closeTab(ui.active); }
});
addEventListener('beforeunload', () => flushWrite());
document.addEventListener('visibilitychange', () => { if (document.hidden) flushWrite(); else S.scheduleSync(0); });
addEventListener('online', () => S.scheduleSync(0));
// Interface atualizada no servidor: recarrega (sem perder nada, a edição é gravada antes).
let uiVersion = '';
async function checkUiVersion() {
  const st = await S.status();
  if (!st?.ui) return;
  if (!uiVersion) { uiVersion = st.ui; return; }
  if (st.ui !== uiVersion) { flushWrite(); setTimeout(() => location.reload(), 300); }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUiVersion(); });
setInterval(() => { if (!document.hidden) checkUiVersion(); }, 60000);
setInterval(() => { if (!document.hidden) S.scheduleSync(0); }, 15000);

// ---------------------------------------------------------------- store events
S.on((what, detail) => {
  if (what === 'vault') onVaultChanged();
  if (what === 'vaults') renderVaultSwitch();
  if (what === 'tree') { renderSide(); renderPanel(); }
  if (what === 'pending' || what === 'sync') { renderStatus(); renderTabs(); if (!S.activeVault) renderSide(); if (what === 'sync' && S.syncState === 'unauthorized') { S.forgetToken(); pairScreen(t.deviceRevoked); } }
  if (what === 'note') renderSide();
  if (what === 'moved') {
    let folderChanged = false;
    for (const [a, b] of detail as [string, string][]) {
      ui.tabs = ui.tabs.map(p => (p === a ? b : p));
      if (ui.active === a) { ui.active = b; editorPath = b; folderChanged = dirOf(a) !== dirOf(b); }
    }
    // pastas renomeadas/movidas continuam abertas na árvore
    for (const f of [...ui.expanded]) for (const [a, b] of detail as [string, string][]) {
      const da = dirOf(a), db = dirOf(b);
      if (da !== db && (f === da || f.startsWith(da + '/'))) { ui.expanded.delete(f); ui.expanded.add(db + f.slice(da.length)); }
    }
    persistUi(); renderTabs(); renderSide(); renderPanel();
    const ti = $<HTMLInputElement>('#title'); if (ti && ui.active && document.activeElement !== ti) ti.value = baseName(ui.active);
    if (folderChanged && ui.active) {
      // só o caminho mudou; atualiza a trilha sem recriar o editor (não perde o que está sendo digitado)
      const cr = $('.crumbs');
      if (cr) cr.replaceChildren(...dirOf(ui.active).split('/').filter(Boolean).flatMap(seg => [h('span', {}, seg), h('span', { class: 'sep' }, '/')]));
    }
  }
  if (what === 'removed') { if (ui.tabs.includes(detail)) closeTab(detail); }
  if (what === 'remote' && detail === ui.active && !S.hasPendingPut(detail) && !writeTimer) { renderDoc(true); }
  if (what === 'conflicts') { renderSide(); if (ui.active) renderDoc(true); toast(t.conflictTitle, 'warn'); }
  if (what === 'kept') toast(t.restoredTitle + ': ' + t.restoredBody, 'warn');
});

// ---------------------------------------------------------------- pairing
function guessDevice() {
  const u = navigator.userAgent;
  const app = (navigator as any).standalone === true || matchMedia('(display-mode: standalone)').matches;
  const browser = app ? '(app)' : /CriOS|Chrome\//.test(u) && !/Edg/.test(u) ? 'Chrome' : /EdgiOS|Edg\//.test(u) ? 'Edge' : /FxiOS|Firefox\//.test(u) ? 'Firefox' : /Safari\//.test(u) ? 'Safari' : '';
  const device = /iPad|Macintosh/.test(u) && 'ontouchend' in document ? 'iPad' : /iPhone/.test(u) ? 'iPhone'
    : /Android/.test(u) ? (/Mobile/.test(u) ? 'Celular Android' : 'Tablet Android') : /Windows/.test(u) ? 'Windows' : /Linux/.test(u) ? 'Linux' : /Mac/.test(u) ? 'Mac' : 'Navegador';
  return browser ? `${device} ${browser}` : device;
}
// Instruções para confiar no certificado do Cube4Notes (só aparecem em HTTPS).
function certHelp(): HTMLElement | null {
  if (location.protocol !== 'https:') return null;
  return h('details', { class: 'cert-help' },
    h('summary', {}, t.certTitle),
    h('p', {}, t.certWhy),
    h('a', { class: 'btn small', href: '/cube4notes-ca.cer', download: 'Cube4Notes-CA.cer' }, t.certDownload),
    h('p', {}, h('b', {}, 'iPhone / iPad: '), t.certIos),
    h('p', {}, h('b', {}, 'Android: '), t.certAndroid),
    h('p', {}, h('b', {}, 'Windows / Linux: '), t.certPc));
}
// Pede ao navegador para não apagar as notas e o pareamento deste aparelho (o iOS limpa sites sem uso).
function keepStorage() { try { navigator.storage?.persist?.(); } catch {} }
let pendingInvite = '';
// Convite vindo do QR code: guardado só em memória e removido da barra de endereço.
function takeInvite(): boolean {
  const m = /[#&]convite=([A-Za-z0-9_-]{10,64})/.exec(location.hash);
  if (!m) return false;
  history.replaceState(null, '', location.pathname + location.search);
  if (S.token) { applyInvite(m[1]); return false; }
  pendingInvite = m[1];
  return true;
}
// Aparelho já conectado que leu um QR novo: o convite troca os vaults liberados para ele.
async function applyInvite(invite: string) {
  if (!S.token) { pendingInvite = invite; return; } // ainda carregando: o boot decide
  const r = await S.pair(invite, S.deviceName || guessDevice());
  if (r === 'ok') { toast(t.accessSaved); S.scheduleSync(0); }
  else toast(r === 'wrong' ? t.pairInviteUsed : r === 'wait' ? t.pairWait : t.pairUnreachable, 'warn');
}
function pairScreen(err = '') {
  const brand = h('div', { class: 'brand big' }, h('img', { src: '/brand/cube4notes.png', alt: '', width: 40, height: 40 }), h('span', { class: 'wordmark' }, 'Cube', h('b', {}, '4'), 'Notes'));
  const msg = h('p', { class: 'pair-err', role: 'alert' }, err);
  const codeInput = pendingInvite ? null : h('input', { class: 'field code', autocomplete: 'one-time-code', autocapitalize: 'characters', spellcheck: 'false', maxlength: '7', placeholder: 'ABC123', 'aria-label': t.pairCode });
  const name = h('input', { class: 'field', value: guessDevice(), 'aria-label': t.pairDevice, maxlength: '60' });
  const btn = h('button', { class: 'btn primary wide', type: 'submit' }, t.pairButton);
  app.replaceChildren(h('div', { class: 'pair' }, h('form', {
    class: 'pair-card', onsubmit: async (e: Event) => {
      e.preventDefault(); btn.setAttribute('disabled', ''); msg.textContent = '';
      const invite = pendingInvite || codeInput!.value.trim();
      if (!invite) { btn.removeAttribute('disabled'); codeInput?.focus(); return; }
      const r = await S.pair(invite, name.value.trim() || guessDevice());
      btn.removeAttribute('disabled');
      if (r === 'ok') { pendingInvite = ''; keepStorage(); start(); return; }
      if (r === 'wrong' && pendingInvite) { pendingInvite = ''; return pairScreen(t.pairInviteUsed); }
      if (r === 'wrong') { msg.textContent = t.pairCodeWrong; codeInput!.select(); return; }
      msg.textContent = r === 'wait' ? t.pairWait : t.pairUnreachable;
    },
  },
    brand, h('h1', {}, t.pairTitle), h('p', { class: 'muted' }, pendingInvite ? t.pairInviteBody : t.pairNeedQr),
    codeInput ? h('ol', { class: 'pair-steps' }, h('li', {}, t.pairStep1), h('li', {}, t.pairStep2), h('li', {}, t.pairStep3)) : null,
    codeInput ? h('label', { class: 'label' }, t.pairCode) : null, codeInput,
    h('label', { class: 'label' }, t.pairDevice), name, msg, btn, certHelp(),
  )));
  (codeInput || btn).focus();
}

// ---------------------------------------------------------------- aparelhos (só no computador do servidor)
function qrSvg(text: string): SVGSVGElement {
  const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
  const n = qr.getModuleCount(), m = 4, size = n + m * 2;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`); svg.setAttribute('shape-rendering', 'crispEdges'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'QR code');
  const bg = document.createElementNS(ns, 'rect'); bg.setAttribute('width', String(size)); bg.setAttribute('height', String(size)); bg.setAttribute('fill', '#fff');
  const fg = document.createElementNS(ns, 'path'); fg.setAttribute('d', d); fg.setAttribute('fill', '#1e1b29');
  svg.append(bg, fg); return svg;
}
const vaultName = (id: string) => S.vaults.find(v => v.id === id)?.name ?? id;
function accessText(d: { admin: boolean; vaults: string[] | null }) {
  if (d.admin || d.vaults === null) return t.allVaults;
  return d.vaults.length ? d.vaults.map(vaultName).join(', ') : '—';
}
// Caixas de seleção de vaults (e, opcionalmente, de administrador).
function accessPicker(selected: string[] | null, admin: boolean, onChange: (vaults: string[], admin: boolean) => void) {
  const box = h('div', { class: 'access' });
  const sel = new Set(selected ?? S.vaults.map(v => v.id));
  let isAdmin = admin;
  const draw = () => {
    box.replaceChildren(
      ...S.vaults.map(v => h('label', { class: 'check' + (isAdmin ? ' dim' : '') },
        h('input', { type: 'checkbox', checked: isAdmin || sel.has(v.id), disabled: isAdmin, onchange: (e: Event) => {
          (e.target as HTMLInputElement).checked ? sel.add(v.id) : sel.delete(v.id);
          if (!sel.size) { (e.target as HTMLInputElement).checked = true; sel.add(v.id); toast(t.pickOneVault, 'warn'); return; }
          onChange([...sel], isAdmin);
        } }), h('span', {}, v.name))),
      h('label', { class: 'check admin' }, h('input', { type: 'checkbox', checked: isAdmin, onchange: (e: Event) => { isAdmin = (e.target as HTMLInputElement).checked; draw(); onChange([...sel], isAdmin); } }),
        ic('ShieldCheck', 14), h('span', {}, t.adminAccess)));
  };
  draw();
  return box;
}
async function openDevices() {
  const qrBox = h('div', { class: 'qr' });
  const addrs = h('div', { class: 'seg small addr-seg' });
  const link = h('code', { class: 'qr-link' });
  const timer = h('p', { class: 'muted qr-timer' });
  const shortBox = h('b', { class: 'short-code' });
  const list = h('div', { class: 'devices' });
  const inviteHelp = h('div', { class: 'invite-help' });
  let inviteVaults = S.vaults.map(v => v.id), inviteAdmin = false;
  let tick: any = 0, again: any = 0;
  const showInvite = async () => {
    clearInterval(tick); qrBox.classList.remove('expired'); qrBox.replaceChildren(h('div', { class: 'qr-wait' }, '…'));
    try {
      const inv = await S.createInvite(inviteVaults, inviteAdmin);
      if (inv.personal) { qrBox.replaceChildren(h('p', { class: 'muted' }, t.personalNoInvite)); timer.textContent = ''; inviteHelp.hidden = true; return; }
      inviteHelp.hidden = false;
      const opts = inv.addresses;
      const pick = (i: number) => {
        const a = opts[i]; qrBox.replaceChildren(qrSvg(a.url)); link.textContent = a.url.replace(/#.*/, '');
        addrs.querySelectorAll('button').forEach((b, k) => b.classList.toggle('on', k === i));
      };
      shortBox.textContent = inv.shortCode.slice(0, 3) + ' ' + inv.shortCode.slice(3);
      addrs.replaceChildren(...opts.map((a, i) => h('button', { title: a.name, onclick: () => pick(i) }, a.address, a.primary ? null : h('small', {}, ' ' + t.virtualNic))));
      if (opts.length) pick(0); else qrBox.replaceChildren(h('p', { class: 'muted' }, t.noLan));
      const end = new Date(inv.expires).getTime();
      const upd = () => {
        const left = Math.max(0, Math.round((end - Date.now()) / 1000));
        timer.textContent = left ? t.inviteExpires(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`) : t.inviteExpired;
        if (!left) { clearInterval(tick); qrBox.classList.add('expired'); } else qrBox.classList.remove('expired');
      };
      upd(); tick = setInterval(upd, 1000);
    } catch { qrBox.replaceChildren(h('p', { class: 'muted' }, t.adminOnly)); }
  };
  const loadDevices = async () => {
    try {
      const ds = await S.listDevices();
      list.replaceChildren(...ds.sort((a, b) => Number(b.current) - Number(a.current) || a.name.localeCompare(b.name)).map(d => {
        const summary = h('span', { class: 'access-sum' }, t.access + ': ' + accessText(d));
        return h('div', { class: 'device' },
          h('div', { class: 'device-info' },
            h('b', {}, d.name, d.current ? h('span', { class: 'chip' }, t.thisDevice) : null, d.admin ? h('span', { class: 'chip admin' }, t.adminChip) : null),
            h('small', {}, t.pairedOn(new Date(d.created).toLocaleDateString(lang)) + (d.lastSeen ? ' · ' + t.lastSeen(new Date(d.lastSeen).toLocaleString(lang, { dateStyle: 'short', timeStyle: 'short' })) : '')),
            d.current ? h('small', {}, t.access + ': ' + accessText(d)) : h('details', { class: 'device-access' }, h('summary', {}, summary),
              accessPicker(d.vaults, d.admin, async (vaults, admin) => {
                try { await S.updateDevice(d.id, { vaults, admin }); d.vaults = admin ? null : vaults; d.admin = admin; summary.textContent = t.access + ': ' + accessText(d); toast(t.accessSaved); }
                catch { toast(t.setupFailed, 'warn'); }
              }))),
          d.current ? null : h('button', { class: 'btn small ghost danger-text', onclick: () => dialog(t.removeDeviceQ(d.name), t.removeDeviceHint, t.remove, async () => { await S.removeDevice(d.id); toast(t.deviceRemoved); loadDevices(); }, true) }, ic('Trash2', 14), t.remove));
      }));
    } catch { list.replaceChildren(h('p', { class: 'muted' }, t.adminOnly)); }
  };
  const forNext = h('div', { class: 'invite-access' }, h('span', { class: 'set-label' }, t.inviteFor),
    accessPicker(inviteVaults, false, (v, a) => { inviteVaults = v; inviteAdmin = a; clearTimeout(again); again = setTimeout(showInvite, 250); }));
  const body = h('div', { class: 'pair-admin' },
    h('div', { class: 'qr-col' }, qrBox, timer, h('button', { class: 'btn small', onclick: () => showInvite() }, ic('RefreshCw', 14), t.newQr)),
    h('div', { class: 'qr-help' },
      forNext,
      h('div', {}, inviteHelp),
      certHelp(),
      h('h3', {}, t.connectedDevices), list));
  inviteHelp.append(h('p', {}, t.qrHelp), h('span', { class: 'set-label' }, t.network), addrs, link, h('p', { class: 'short-help' }, t.shortHelp, ' ', shortBox));
  modal(t.connectDevice, body, 'wide devices-modal');
  const observer = new MutationObserver(() => { if (!body.isConnected) { clearInterval(tick); observer.disconnect(); } });
  observer.observe(document.body, { childList: true });
  showInvite(); loadDevices();
}

// ---------------------------------------------------------------- vaults
function renderVaultSwitch() {
  const el = $('#vault-switch'); if (!el) return;
  if (S.vaults.length <= 1 && !ui.admin) { el.replaceChildren(); return; }
  const cur = S.vaults.find(v => v.id === S.activeVault);
  el.replaceChildren(h('button', { class: 'vault-switch', title: t.switchVault, 'aria-label': t.switchVault, onclick: (e: MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    menu(r.left, r.bottom + 4, [
      ...S.vaults.map(v => ({ icon: (v.id === S.activeVault ? 'Check' : 'Library') as IconName, label: v.name, run: () => changeVault(v.id) })),
      ...(ui.admin ? [null, { icon: 'Settings' as IconName, label: t.manageVaults, run: () => openVaultsAdmin() }] : []),
    ]);
  } }, ic('Library', 15), h('span', {}, cur?.name ?? t.vaults), ic('ChevronsUpDown', 14)));
}
async function changeVault(id: string) {
  if (id === S.activeVault) return;
  flushWrite();
  await S.switchVault(id);
}
async function onVaultChanged() {
  editor?.destroy(); editor = null; editorPath = null;
  loadVaultUi();
  ui.tabs = ui.tabs.filter(p => S.notes.has(p));
  if (ui.active && !S.notes.has(ui.active)) ui.active = null;
  if (!ui.active && ui.tabs.length) ui.active = ui.tabs[0];
  searchQuery = '';
  renderAll();
}

// Escolha de pasta no computador do servidor (só pastas; o servidor cria a que não existir).
function folderPicker(browse: (p: string) => Promise<S.BrowseResult>) {
  const input = h('input', { class: 'field fp-path', spellcheck: 'false', autocomplete: 'off', 'aria-label': t.vaultFolder });
  const places = h('div', { class: 'fp-places' });
  const list = h('div', { class: 'fp-list' });
  const note = h('p', { class: 'fp-note muted' });
  const load = async (p: string) => {
    try {
      const r = await browse(p);
      input.value = r.path;
      places.replaceChildren(...r.roots.map(x => h('button', { type: 'button', class: 'btn small ghost', onclick: () => load(x) }, ic('HardDrive', 14), x)));
      list.replaceChildren(
        ...(r.parent ? [h('button', { type: 'button', class: 'fp-row up', onclick: () => load(r.parent!) }, ic('ArrowUp', 14), h('span', {}, '..'))] : []),
        ...r.entries.map(e => h('button', { type: 'button', class: 'fp-row', onclick: () => load(e.path) }, ic('Folder', 14), h('span', {}, e.name))));
      note.textContent = !r.exists ? t.folderWillBeCreated : r.entries.length ? '' : t.folderEmpty;
      return r;
    } catch { note.textContent = t.browseFailed; return null; }
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); load(input.value.trim()); } });
  input.addEventListener('change', () => load(input.value.trim()));
  const el = h('div', { class: 'folder-picker' }, input, note, list, h('span', { class: 'set-label' }, t.disks), places);
  const init = async () => { const r = await load(''); if (r) await load(r.suggested); };
  return { el, init, value: () => input.value.trim() };
}

async function openVaultsAdmin() {
  const vlist = h('div', { class: 'vault-list' });
  const drawVaults = () => {
    vlist.replaceChildren(...S.vaults.map(v => h('div', { class: 'vault-row' },
      ic('Library', 16),
      h('div', { class: 'vault-info' }, h('b', {}, v.name), h('small', {}, v.path || '')),
      h('button', { class: 'btn small ghost', onclick: () => prompt(t.vaultName, t.save, async name => {
        try { await S.renameVault(v.id, name); toast(t.nameSaved); drawVaults(); renderVaultSwitch(); } catch (e: any) { toast(e.message || t.setupFailed, 'warn'); }
      }, v.name) }, ic('Pencil', 14), t.rename),
      S.vaults.length > 1 ? h('button', { class: 'btn small ghost danger-text', onclick: () => dialog(t.removeVaultQ(v.name), t.removeVaultHint, t.removeFromList, async () => {
        try { await S.removeVault(v.id); toast(t.vaultRemoved); drawVaults(); renderVaultSwitch(); } catch (e: any) { toast(e.message || t.setupFailed, 'warn'); }
      }, true) }, ic('Trash2', 14), t.remove) : null)));
  };
  drawVaults();
  // adicionar vault
  const name = h('input', { class: 'field', maxlength: '60', placeholder: lang === 'pt-BR' ? 'Trabalho' : 'Work', 'aria-label': t.vaultName });
  const picker = folderPicker(S.adminBrowse);
  const err = h('p', { class: 'pair-err', role: 'alert' });
  const addBtn = h('button', { class: 'btn primary', type: 'submit' }, ic('Plus', 15), t.addVault);
  const addForm = h('form', { class: 'add-vault', hidden: true, onsubmit: async (e: Event) => {
    e.preventDefault(); err.textContent = '';
    if (!name.value.trim()) { name.focus(); return; }
    addBtn.setAttribute('disabled', '');
    try {
      const v: any = await S.createVault(name.value.trim(), picker.value());
      toast(t.vaultAdded); name.value = ''; addForm.hidden = true; openAdd.hidden = false;
      drawVaults(); renderVaultSwitch(); S.scheduleSync(0);
      if (v?.id) changeVault(v.id);
    } catch (e: any) { err.textContent = e.message || t.setupFailed; }
    addBtn.removeAttribute('disabled');
  } },
    h('label', { class: 'label' }, t.vaultName), name,
    h('label', { class: 'label' }, t.vaultFolder), h('p', { class: 'muted small-note' }, t.vaultFolderHint), picker.el, err,
    h('div', { class: 'modal-actions' }, h('button', { class: 'btn', type: 'button', onclick: () => { addForm.hidden = true; openAdd.hidden = false; } }, t.cancel), addBtn));
  const openAdd = h('button', { class: 'btn', onclick: () => { addForm.hidden = false; openAdd.hidden = true; name.focus(); picker.init(); } }, ic('Plus', 15), t.addVault);
  // servidor
  const srvName = h('input', { class: 'field', maxlength: '60', 'aria-label': t.serverName });
  const modeBox = h('div', { class: 'mode-cards' });
  let mode = 'rede';
  const drawMode = () => modeBox.replaceChildren(...([['pessoal', t.modePersonal, t.modePersonalHint, 'HardDrive'], ['rede', t.modeNetwork, t.modeNetworkHint, 'Server']] as [string, string, string, IconName][])
    .map(([v, l, hint, icon]) => h('button', { type: 'button', class: 'mode-card' + (v === mode ? ' on' : ''), onclick: () => {
      if (v === mode) return;
      dialog(t.modeChangeQ, t.modeChangeHint, t.change, async () => {
        try { const r = await S.updateServer({ mode: v }); if (r.restart) waitRestart(r.next); } catch (e: any) { toast(e.message || t.setupFailed, 'warn'); }
      });
    } }, ic(icon, 18), h('b', {}, l), h('small', {}, hint))));
  S.serverInfo().then(si => { srvName.value = si.name; mode = si.mode; drawMode(); }).catch(() => {});
  drawMode();
  const body = h('div', { class: 'vaults-admin' },
    h('h3', {}, t.vaults), vlist, openAdd, addForm,
    h('h3', {}, t.server),
    h('form', { class: 'srv-name', onsubmit: async (e: Event) => { e.preventDefault(); try { await S.updateServer({ name: srvName.value }); toast(t.nameSaved); } catch (e: any) { toast(e.message || t.setupFailed, 'warn'); } } },
      h('label', { class: 'label' }, t.serverName), h('div', { class: 'inline' }, srvName, h('button', { class: 'btn', type: 'submit' }, t.save))),
    h('span', { class: 'label' }, t.mode), modeBox,
    ui.loopback ? h('button', { class: 'btn ghost danger-text quit-btn', onclick: () => dialog(t.quitQ, t.quitHint, t.quit, async () => {
      flushWrite();
      try { await S.quitServer(); } catch {}
      app.replaceChildren(h('div', { class: 'pair' }, h('div', { class: 'pair-card center' },
        h('img', { class: 'empty-logo', src: '/brand/cube4notes.png', alt: '', width: 64, height: 64 }), h('h1', {}, t.quitDone))));
      document.querySelectorAll('.overlay').forEach(o => o.remove());
    }, true) }, ic('X', 15), t.quit) : null);
  modal(t.manageVaults, body, 'wide vaults-modal');
}

// Servidor reiniciando: espera ele voltar e abre o endereço novo.
function waitRestart(next: string) {
  app.replaceChildren(h('div', { class: 'pair' }, h('div', { class: 'pair-card center' },
    h('img', { class: 'empty-logo', src: '/brand/cube4notes.png', alt: '', width: 64, height: 64 }), h('h1', {}, t.restarting))));
  document.querySelectorAll('.overlay').forEach(o => o.remove());
  const started = Date.now();
  const tryIt = async () => {
    try { await fetch(new URL('/api/status', next).toString(), { mode: 'no-cors', cache: 'no-store' }); if (Date.now() - started > 1500) { location.href = next; return; } } catch {}
    setTimeout(tryIt, 700);
  };
  setTimeout(tryIt, 1200);
}

// ---------------------------------------------------------------- primeira execução
function setupScreen(st: S.ServerStatus) {
  const needCode = !st.loopback;
  const code = needCode ? h('input', { class: 'field code', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', maxlength: '7', placeholder: 'ABC123', 'aria-label': t.setupCode }) : null;
  let mode = st.loopback ? 'pessoal' : 'rede';
  const modeBox = h('div', { class: 'mode-cards' });
  const drawMode = () => modeBox.replaceChildren(...([['pessoal', t.modePersonal, t.modePersonalHint, 'HardDrive'], ['rede', t.modeNetwork, t.modeNetworkHint, 'Server']] as [string, string, string, IconName][])
    .filter(([v]) => st.loopback || v === 'rede')
    .map(([v, l, hint, icon]) => h('button', { type: 'button', class: 'mode-card' + (v === mode ? ' on' : ''), onclick: () => { mode = v; drawMode(); } }, ic(icon, 18), h('b', {}, l), h('small', {}, hint))));
  drawMode();
  const vaultName = h('input', { class: 'field', value: t.vault, maxlength: '60', 'aria-label': t.vaultName });
  const picker = folderPicker(p => S.setupBrowse(p, code?.value.trim() || ''));
  const device = h('input', { class: 'field', value: guessDevice(), maxlength: '60', 'aria-label': t.pairDevice });
  const msg = h('p', { class: 'pair-err', role: 'alert' });
  const btn = h('button', { class: 'btn primary wide', type: 'submit' }, t.setupFinish);
  const vaultPart = h('div', { class: 'setup-vault' }, h('label', { class: 'label' }, t.vaultName), vaultName, h('label', { class: 'label' }, t.setupVault), picker.el);
  if (needCode) { vaultPart.hidden = true; code!.addEventListener('input', () => { if (code!.value.replace(/\W/g, '').length >= 6 && vaultPart.hidden) { vaultPart.hidden = false; picker.init(); } }); }
  app.replaceChildren(h('div', { class: 'pair setup' }, h('form', {
    class: 'pair-card setup-card', onsubmit: async (e: Event) => {
      e.preventDefault(); msg.textContent = ''; btn.setAttribute('disabled', '');
      try {
        const next = await S.runSetup({ code: code?.value.trim() || '', mode, serverName: '', vaultName: vaultName.value.trim(), vaultPath: picker.value(), deviceName: device.value.trim() || guessDevice() });
        keepStorage(); waitRestart(next);
      } catch (err: any) {
        msg.textContent = err.status === 403 ? t.setupWrongCode : err.message && err.message.length > 3 ? err.message : t.setupFailed;
        btn.removeAttribute('disabled');
      }
    },
  },
    h('div', { class: 'brand big' }, h('img', { src: '/brand/cube4notes.png', alt: '', width: 40, height: 40 }), h('span', { class: 'wordmark' }, 'Cube', h('b', {}, '4'), 'Notes')),
    h('h1', {}, t.setupTitle), h('p', { class: 'muted' }, t.setupBody),
    code ? h('label', { class: 'label' }, t.setupCode) : null, code, code ? h('p', { class: 'muted small-note' }, t.setupCodeHint) : null,
    h('span', { class: 'label' }, t.setupWhere), modeBox,
    vaultPart,
    h('label', { class: 'label' }, t.pairDevice), device,
    msg, btn, certHelp())));
  if (!needCode) picker.init();
  (code || vaultName).focus();
}

// ---------------------------------------------------------------- boot
async function start() {
  shell();
  loadVaultUi();
  const savedActive = ui.active, savedTabs = [...ui.tabs];
  // aparelho ainda sem notas (primeira sincronização): mantém as abas salvas até as notas chegarem
  if (S.notes.size) {
    if (ui.active && !S.notes.has(ui.active)) ui.active = null;
    ui.tabs = ui.tabs.filter(p => S.notes.has(p));
    if (!ui.active && ui.tabs.length) ui.active = ui.tabs[0];
  }
  renderAll();
  S.status().then(st => { ui.admin = !!st?.admin; ui.loopback = !!st?.loopback; uiVersion ||= st?.ui || ''; renderVaultSwitch(); });
  await S.sync();
  if (!ui.tabs.length) ui.tabs = savedTabs;
  ui.tabs = ui.tabs.filter(p => S.notes.has(p));
  const want = ui.active && S.notes.has(ui.active) ? null : savedActive && S.notes.has(savedActive) ? savedActive : ui.tabs[0];
  if (want) await openNote(want);
  else { persistUi(); renderTabs(); renderSide(); }
}
(async function boot() {
  setLang(lang); applyTheme();
  // convite vindo do QR code: guardado só em memória e removido da barra de endereço
  takeInvite();
  addEventListener('hashchange', async () => { await checkUiVersion(); if (takeInvite() && !S.token) pairScreen(); });
  await S.init();
  const st = await S.status();
  if (st?.setup) return setupScreen(st);
  if (!S.token) {
    if (st?.loopback && (await S.pair('', guessDevice())) === 'ok') { keepStorage(); return start(); }
    return pairScreen(st ? '' : t.pairUnreachable);
  }
  keepStorage();
  // QR lido por um aparelho já conectado: aplica o novo acesso
  if (pendingInvite) { const inv = pendingInvite; pendingInvite = ''; await applyInvite(inv); }
  start();
})();
// Service worker = abrir sem servidor. Falha em HTTPS indica certificado ainda não confiável neste aparelho.
let swFailed = false;
if ('serviceWorker' in navigator && isSecureContext) navigator.serviceWorker.register('/sw.js').catch(() => { swFailed = location.protocol === 'https:'; });
