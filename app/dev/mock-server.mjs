/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * Servidor de desenvolvimento em Node com a mesma API e as mesmas regras de segurança do servidor .NET,
 * para testar a interface e a bateria de segurança sem compilar. Não é o servidor do produto.
 * Uso: node dev/mock-server.mjs [--config ./cfg | --notes ./notas] --port 43125 [--cert c.pem --key k.pem --ca ca.der]
 * Sem config.json e sem --notes, começa no assistente de primeira execução (código ABC234).
 */
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const port = Number(arg('--port', '43125'));
const www = path.resolve(arg('--www', path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'wwwroot')));
// --config: pasta da configuração (config.json, devices.json). --notes: cria o vault "notas" (migração da versão antiga).
const configDir = path.resolve(arg('--config', arg('--notes') ? path.join(path.resolve(arg('--notes')), '.cube4notes') : './.c4n-config'));
fs.mkdirSync(configDir, { recursive: true });
const configFile = path.join(configDir, 'config.json');
let config = fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, 'utf8')) : null;
const saveConfig = () => { fs.writeFileSync(configFile + '.tmp', JSON.stringify(config, null, 2)); fs.renameSync(configFile + '.tmp', configFile); };
if (!config && arg('--notes')) { config = { name: 'Cube4Notes', mode: 'rede', vaults: [{ id: 'notas', name: 'Notas', path: path.resolve(arg('--notes')) }], legacyVault: 'notas' }; saveConfig(); }
const setupCode = 'ABC234';
const devicesFile = path.join(configDir, 'devices.json');
let devices = fs.existsSync(devicesFile) ? JSON.parse(fs.readFileSync(devicesFile, 'utf8')) : [];
const seen = new Map();
const invites = new Map(); // código -> { expires, short, admin, vaults }
const failures = new Map(); // ip -> {count, since}
const MAX_UPLOAD = 25 * 1024 * 1024;
const UPLOAD = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.bmp', '.pdf']);
const INLINE = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.bmp': 'image/bmp', '.pdf': 'application/pdf' };
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
// Vault da requisição atual: as funções abaixo usam root/renames (definidos antes de cada trecho síncrono).
let root = '', renames = [], renamesFile = '';
function useVault(v) {
  root = path.resolve(v.path); fs.mkdirSync(root, { recursive: true });
  const dataDir = path.join(root, '.cube4notes'); fs.mkdirSync(dataDir, { recursive: true });
  renamesFile = path.join(dataDir, 'renames.json');
  renames = fs.existsSync(renamesFile) ? JSON.parse(fs.readFileSync(renamesFile, 'utf8')) : [];
}
const slug = (name, taken) => { let b = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'vault'; let id = b, i = 2; while (taken.includes(id)) id = `${b}-${i++}`; return id; };
const cleanName = (n, d) => (String(n ?? '').replace(/[\x00-\x1f<>]/g, '').trim() || d).slice(0, 60);
function validateVaultPath(p, exceptId) {
  if (!p || typeof p !== 'string') return 'Escolha uma pasta.';
  if (!path.isAbsolute(p)) return 'Use o caminho completo da pasta.';
  const full = path.resolve(p);
  if (full === path.parse(full).root) return 'Não use a raiz do disco como vault; escolha ou crie uma pasta.';
  const inside = (a, b) => a === b || a.startsWith(b + path.sep);
  if (inside(full, configDir) || inside(configDir, full)) return 'Essa pasta guarda a configuração do Cube4Notes.';
  for (const s of ['/bin', '/boot', '/dev', '/etc', '/lib', '/proc', '/sbin', '/sys', '/usr']) if (inside(full, s)) return 'Pasta do sistema não pode ser um vault.';
  for (const v of config?.vaults || []) if (v.id !== exceptId && (inside(full, path.resolve(v.path)) || inside(path.resolve(v.path), full))) return `Essa pasta já faz parte do vault "${v.name}".`;
  if (fs.existsSync(full) && !fs.statSync(full).isDirectory()) return 'Esse caminho é um arquivo, não uma pasta.';
  return null;
}
function browse(p) {
  const home = os.homedir(); const suggested = path.join(home, 'Documents', 'Cube4Notes');
  const dir = p ? path.resolve(p) : home;
  const parent = path.dirname(dir) === dir ? null : path.dirname(dir);
  if (!fs.existsSync(dir)) return { path: dir, exists: false, parent, entries: [], roots: ['/', home], suggested };
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory() && !e.name.startsWith('.')).map(e => ({ name: e.name, path: path.join(dir, e.name) })).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 500); } catch {}
  return { path: dir, exists: true, parent, entries, roots: ['/', home], suggested };
}

const sha = s => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const norm = a => (a || '').replace(/^::ffff:/, '');
const isLoopAddr = a => a === '127.0.0.1' || a === '::1';
const isLoop = req => isLoopAddr(norm(req.socket.remoteAddress));
// --lan-ip: só para testes em máquinas sem endereço privado (trata esse IP como rede local)
const extraLan = arg('--lan-ip', '');
const isPrivate = a => a === extraLan || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a);
const lanAddrs = () => Object.entries(os.networkInterfaces()).flatMap(([name, l]) => l.filter(x => x.family === 'IPv4' && (!x.internal || x.address === extraLan) && isPrivate(x.address)).map(x => ({ address: x.address, name, primary: !/virtual|vmware|vbox|hyper-v|vethernet|wireguard|wg|vpn|tap|tun|docker|wsl|zerotier|tailscale/i.test(name) })));
const hostAllowed = h => { h = (h || '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase(); return ['localhost', '127.0.0.1', '::1', os.hostname().toLowerCase(), os.hostname().toLowerCase() + '.local'].includes(h) || lanAddrs().some(a => a.address === h); };
const sameOrigin = req => { const o = req.headers.origin; if (!o) { const s = req.headers['sec-fetch-site']; return !s || s === 'same-origin' || s === 'none'; } try { return new URL(o).host.toLowerCase() === String(req.headers.host).toLowerCase(); } catch { return false; } };
const INVALID = /[<>:"|?*\\/\x00-\x1f]/;
const reserved = p => { const s = p.split('.')[0].trimEnd().toUpperCase(); return /^(CON|PRN|AUX|NUL|CONIN\$|CONOUT\$|COM\d|LPT\d)$/.test(s); };
function resolve(rel, md) {
  if (typeof rel !== 'string') return null;
  if (!rel) return md ? null : root;
  if (md && !rel.toLowerCase().endsWith('.md')) return null;
  if (path.isAbsolute(rel) || /^([a-z]:|[\\/])/i.test(rel) || rel.length > 400) return null;
  const parts = rel.replace(/\\/g, '/').split('/').filter(Boolean);
  if (!parts.length) return md ? null : root;
  if (parts.length > 32 || parts.some(p => p === '.' || p === '..' || p.startsWith('.') || p.length > 200 || INVALID.test(p) || p.endsWith(' ') || p.endsWith('.') || reserved(p))) return null;
  const full = path.join(root, ...parts);
  if (!full.startsWith(root + path.sep)) return null;
  for (let c = path.dirname(full); c.length > root.length; c = path.dirname(c)) if (fs.existsSync(c) && fs.lstatSync(c).isSymbolicLink()) return null;
  if (fs.existsSync(full) && fs.lstatSync(full).isSymbolicLink()) return null;
  return full;
}
const safeName = n => { let c = path.basename(String(n).replace(/\\/g, '/')).replace(/[<>:"|?*\\/\x00-\x1f]/g, '-').trim().replace(/^\.+/, '').replace(/[. ]+$/, ''); if (c.length > 120) c = c.slice(-120); if (!c || reserved(c)) c = 'anexo' + path.extname(c); return c; };
function walk(dir, rel, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.isSymbolicLink()) continue;
    const r = rel ? rel + '/' + e.name : e.name, full = path.join(dir, e.name);
    if (e.isDirectory()) { out.folders.push(r); walk(full, r, out); }
    else if (e.name.toLowerCase().endsWith('.md')) {
      const c = fs.readFileSync(full, 'utf8');
      out.files.push({ path: r, version: sha(c), modified: fs.statSync(full).mtime.toISOString() });
    }
  }
  return out;
}
function conflictPath(rel, device) {
  const d = new Date(), z = n => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}${z(d.getMinutes())}`;
  const base = rel.slice(0, -3);
  const safe = (device || 'aparelho').replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'aparelho';
  let p = `${base} (conflito ${safe} ${stamp}).md`, i = 2;
  while (fs.existsSync(resolve(p, true))) p = `${base} (conflito ${safe} ${stamp} ${i++}).md`;
  return p;
}
function toTrash(full) {
  const t = path.join(root, '.lixeira', new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(t, { recursive: true });
  fs.renameSync(full, path.join(t, path.basename(full)));
}
function write(full, content) {
  fs.mkdirSync(path.dirname(full), { recursive: true });
  const tmp = full + '.' + crypto.randomUUID().slice(0, 8) + '.tmp';
  fs.writeFileSync(tmp, content, 'utf8'); fs.renameSync(tmp, full);
}
// Renomeações recentes: uma edição feita no nome antigo segue para o nome novo (sem duplicar a nota).
function recordRename(from, to, isFolder) {
  const cutoff = Date.now() - 30 * 86400000;
  renames = renames.filter(r => r.at > cutoff).concat({ from, to, folder: isFolder, at: Date.now() });
  fs.writeFileSync(renamesFile, JSON.stringify(renames));
}
function followRenames(rel) {
  let cur = rel;
  for (let hop = 0; hop < 10; hop++) {
    let next = null;
    for (let i = renames.length - 1; i >= 0 && !next; i--) {
      const r = renames[i];
      if (!r.folder && r.from === cur) next = r.to;
      else if (r.folder && cur.startsWith(r.from + '/')) next = r.to + cur.slice(r.from.length);
    }
    if (!next) break;
    cur = next;
  }
  return cur === rel ? null : cur;
}
function applyOp(op, device) {
  const r = { id: op.id, status: 'applied' };
  const err = m => ({ ...r, status: 'error', message: m });
  if (op.type === 'put') {
    const full = resolve(op.path, true); if (!full) return err('invalid path');
    const content = op.content ?? '';
    if (content.length > 10_000_000) return err('too large');
    if (!fs.existsSync(full)) {
      // nome antigo de uma nota renomeada em outro aparelho: aplica no nome novo
      const moved = op.baseVersion ? followRenames(op.path) : null;
      const mfull = moved && resolve(moved, true);
      if (mfull && fs.existsSync(mfull)) {
        const cur = fs.readFileSync(mfull, 'utf8');
        if (cur === content) return { ...r, version: sha(cur), movedTo: moved };
        if (op.baseVersion === sha(cur)) { write(mfull, content); return { ...r, version: sha(content), movedTo: moved }; }
        const cp = conflictPath(moved, device); write(resolve(cp, true), content);
        return { ...r, status: 'conflict', version: sha(cur), conflictPath: cp, conflictVersion: sha(content), movedTo: moved };
      }
      write(full, content); return { ...r, version: sha(content) };
    }
    const cur = fs.readFileSync(full, 'utf8');
    if (cur === content) return { ...r, version: sha(cur) };
    if (op.baseVersion && op.baseVersion === sha(cur)) { write(full, content); return { ...r, version: sha(content) }; }
    const cp = conflictPath(op.path, device); write(resolve(cp, true), content);
    return { ...r, status: 'conflict', version: sha(cur), conflictPath: cp, conflictVersion: sha(content) };
  }
  if (op.type === 'delete') {
    const full = resolve(op.path, true); if (!full) return err('invalid path');
    if (!fs.existsSync(full)) return r;
    if (op.baseVersion !== sha(fs.readFileSync(full, 'utf8'))) return { ...r, status: 'kept' };
    toTrash(full); return r;
  }
  if (op.type === 'mkdir') { const full = resolve(op.path, false); if (!full || full === root) return err('invalid path'); fs.mkdirSync(full, { recursive: true }); return r; }
  if (op.type === 'rmdir') { const full = resolve(op.path, false); if (!full || full === root) return err('invalid path'); if (fs.existsSync(full)) toTrash(full); return r; }
  if (op.type === 'move') {
    const isMd = String(op.from || '').toLowerCase().endsWith('.md');
    const a = resolve(op.from, isMd), b = resolve(op.to, isMd);
    if (!a || !b || a === root || b === root) return err('invalid path');
    if (!fs.existsSync(a)) return err('missing');
    if (fs.existsSync(b)) return err('exists');
    if (!isMd && (b + path.sep).startsWith(a + path.sep)) return err('inside itself');
    fs.mkdirSync(path.dirname(b), { recursive: true }); fs.renameSync(a, b);
    recordRename(op.from, op.to, !isMd);
    return r;
  }
  return err('unknown op');
}
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(obj === undefined ? '' : JSON.stringify(obj)); };
const body = (req, limit = 32 * 1024 * 1024) => new Promise(ok => { let b = '', n = 0; req.on('data', c => { n += c.length; if (n <= limit) b += c; }); req.on('end', () => { if (n > limit) return ok({ __tooLarge: true }); try { ok(JSON.parse(b || '{}')); } catch { ok({ __bad: true }); } }); });
const findDevice = t => { if (!t || t.length > 200) return null; const d = devices.find(d => d.hash === sha(t)); if (d) seen.set(d.id, new Date().toISOString()); return d; };
const saveDevices = () => { fs.writeFileSync(devicesFile + '.tmp', JSON.stringify(devices, null, 2)); fs.renameSync(devicesFile + '.tmp', devicesFile); };
const log = m => console.log(`  [segurança] ${m}`);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };

// --cert/--key/--ca: HTTPS na porta principal e HTTP na porta anterior (só redireciona e entrega o certificado), como o servidor .NET.
const tlsCert = arg('--cert', ''), tlsKey = arg('--key', ''), tlsCa = arg('--ca', '');
const handler = async (req, res) => {
  const ip = norm(req.socket.remoteAddress);
  const H = { 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Resource-Policy': 'same-origin', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()', 'Content-Security-Policy': CSP };
  for (const [k, v] of Object.entries(H)) res.setHeader(k, v);
  if (!isLoopAddr(ip) && !isPrivate(ip)) return send(res, 403);
  if (!hostAllowed(req.headers.host)) { log(`Host recusado: ${req.headers.host}`); return send(res, 421); }
  if (!['GET', 'HEAD'].includes(req.method) && !sameOrigin(req)) { log(`Origem recusada: ${req.headers.origin}`); return send(res, 403); }
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/cube4notes-ca.cer' && tlsCa) { res.writeHead(200, { 'Content-Type': 'application/x-x509-ca-cert', 'Content-Disposition': 'attachment; filename=Cube4Notes-CA.cer' }); return res.end(fs.readFileSync(tlsCa)); }
  if (tlsCert && !req.socket.encrypted) { res.writeHead(302, { Location: `https://${String(req.headers.host).replace(/:\d+$/, '')}:${port}${req.url}` }); return res.end(); }
  if (u.pathname.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
    const auth = req.headers.authorization || '';
    const dev = auth.startsWith('Bearer ') ? findDevice(auth.slice(7)) : null;
    const loop = isLoop(req);
    const setup = !config;
    const blocked = () => { const f = failures.get(ip); return f && f.count >= 10 && Date.now() - f.since < 600000; };
    const fail = () => { const f = failures.get(ip), now = Date.now(); failures.set(ip, f && now - f.since < 600000 ? { count: f.count + 1, since: f.since } : { count: 1, since: now }); };
    const setupAllowed = code => { if (loop) return true; if (blocked()) return false; const ok = String(code || '').replace(/\W/g, '').toUpperCase() === setupCode; if (!ok) { fail(); log(`Código de configuração inválido de ${ip}`); } return ok; };
    const addDevice = (name, admin, vaults) => {
      const token = crypto.randomBytes(32).toString('hex');
      const d = { id: crypto.randomUUID(), name: cleanName(name, 'Aparelho'), hash: sha(token), created: new Date().toISOString(), admin, vaults };
      devices.push(d); saveDevices(); seen.set(d.id, d.created);
      return { token, d };
    };
    if (u.pathname === '/api/status') return send(res, 200, { name: config?.name || 'Cube4Notes', setup, mode: config?.mode || 'rede', paired: !!dev, loopback: loop, admin: !!dev && (dev.admin || loop), ui: (() => { try { return fs.statSync(path.join(www, 'index.html')).mtimeMs.toString(16); } catch { return ''; } })() });
    if (setup && u.pathname === '/api/setup/browse') { if (!setupAllowed(u.searchParams.get('code'))) return send(res, 403); return send(res, 200, browse(u.searchParams.get('path') || '')); }
    if (u.pathname === '/api/setup' && req.method === 'POST') {
      if (!setup) return send(res, 409, { error: 'Já configurado.' });
      const b = await body(req, 64 * 1024);
      if (!setupAllowed(b.code)) return send(res, 403, { error: 'Código incorreto.' });
      config = { name: cleanName(b.serverName, os.hostname()), mode: b.mode === 'pessoal' ? 'pessoal' : 'rede', vaults: [] };
      const problem = validateVaultPath(b.vaultPath); if (problem) { config = null; return send(res, 400, { error: problem }); }
      const name = cleanName(b.vaultName, 'Notas');
      config.vaults.push({ id: slug(name, []), name, path: path.resolve(b.vaultPath) }); fs.mkdirSync(path.resolve(b.vaultPath), { recursive: true });
      saveConfig();
      const { token, d } = addDevice(b.deviceName || 'Administrador', true, null);
      return send(res, 200, { token, deviceId: d.id, deviceName: d.name, next: `${tlsCert ? 'https' : 'http'}://${String(req.headers.host)}/` });
    }
    if (setup) return send(res, 503);
    if (u.pathname === '/api/pair' && req.method === 'POST') {
      const b = await body(req, 64 * 1024);
      let admin = loop, vaults = config.vaults.map(v => v.id);
      if (!loop) {
        if (blocked()) return send(res, 429, { error: 'wait' });
        const code = String(b.invite || '').slice(0, 64); const short = code.replace(/[^a-z0-9]/gi, '').toUpperCase();
        let key = null; for (const [k, v] of invites) if (v.expires >= Date.now() && (k === code || (short.length === 6 && v.short === short))) key = k;
        if (!key) { fail(); log(`Convite inválido de ${ip}`); return send(res, 403, { error: 'invite' }); }
        ({ admin, vaults } = invites.get(key)); invites.delete(key);
      }
      if (dev) { // aparelho já conectado: o convite troca o acesso dele
        if (!loop) { dev.admin = admin; dev.vaults = admin ? null : vaults; saveDevices(); }
        return send(res, 200, { token: null, deviceId: dev.id, deviceName: dev.name, updated: true });
      }
      const { token, d } = addDevice(b.deviceName, admin, admin ? null : vaults);
      console.log(`  Aparelho conectado: ${d.name} (${ip})`);
      return send(res, 200, { token, deviceId: d.id, deviceName: d.name });
    }
    if (!dev) return send(res, 401, { error: 'unauthorized' });
    const isAdmin = dev.admin || loop;
    const can = id => isAdmin || dev.vaults == null || dev.vaults.includes(id);
    if (u.pathname === '/api/vaults') return send(res, 200, { vaults: config.vaults.filter(v => can(v.id)).map(v => ({ id: v.id, name: v.name, legacy: v.id === config.legacyVault, path: isAdmin ? path.resolve(v.path) : null })) });
    if (u.pathname.startsWith('/api/admin/')) {
      if (!isAdmin) return send(res, 403);
      const sub = u.pathname.slice('/api/admin/'.length);
      if (sub === 'browse') return send(res, 200, browse(u.searchParams.get('path') || ''));
      if (sub === 'vaults' && req.method === 'POST') {
        const b = await body(req, 64 * 1024);
        const problem = validateVaultPath(b.path); if (problem) return send(res, 400, { error: problem });
        const name = cleanName(b.name, 'Vault'); const id = slug(name, config.vaults.map(v => v.id));
        fs.mkdirSync(path.resolve(b.path), { recursive: true });
        config.vaults.push({ id, name, path: path.resolve(b.path) }); saveConfig();
        return send(res, 200, { id, name, path: path.resolve(b.path) });
      }
      const vm = /^vaults\/([^/]+)$/.exec(sub);
      if (vm) {
        const id = decodeURIComponent(vm[1]); const v = config.vaults.find(x => x.id === id); if (!v) return send(res, 404);
        if (req.method === 'PATCH') { const b = await body(req, 64 * 1024); v.name = cleanName(b.name, v.name); saveConfig(); return send(res, 200, { id, name: v.name }); }
        if (req.method === 'DELETE') {
          if (config.vaults.length === 1) return send(res, 400, { error: 'É preciso ter pelo menos um vault.' });
          config.vaults = config.vaults.filter(x => x !== v); saveConfig();
          for (const d of devices) if (d.vaults) d.vaults = d.vaults.filter(x => x !== id); saveDevices();
          return send(res, 200, { removed: id });
        }
      }
      if (sub === 'invite' && req.method === 'POST') {
        const b = await body(req, 64 * 1024);
        const known = config.vaults.map(v => v.id);
        const vaults = [...new Set((b.vaults || known).filter(x => known.includes(x)))];
        for (const [k, v] of invites) if (v.expires < Date.now()) invites.delete(k);
        while (invites.size >= 5) invites.delete([...invites.entries()].sort((a, b) => a[1].expires - b[1].expires)[0][0]);
        const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const short = Array.from({ length: 6 }, () => A[crypto.randomInt(A.length)]).join('');
        const code = crypto.randomBytes(18).toString('base64url'); const expires = Date.now() + 5 * 60000; invites.set(code, { expires, short, admin: b.admin === true, vaults });
        return send(res, 200, { expires: new Date(expires).toISOString(), shortCode: short, personal: config.mode === 'pessoal', addresses: lanAddrs().sort((a, b) => b.primary - a.primary).map(a => ({ address: a.address, url: `${tlsCert ? "https" : "http"}://${a.address}:${port}/#convite=${code}`, primary: a.primary, name: a.name })) });
      }
      if (sub === 'devices' && req.method === 'GET') return send(res, 200, { devices: devices.map(d => ({ id: d.id, name: d.name, created: d.created, lastSeen: seen.get(d.id) || null, current: d.id === dev.id, admin: !!d.admin, vaults: d.vaults ?? null })) });
      const dm = /^devices\/([^/]+)$/.exec(sub);
      if (dm) {
        const id = decodeURIComponent(dm[1]); const d = devices.find(x => x.id === id); if (!d) return send(res, 404);
        if (req.method === 'PATCH') {
          const b = await body(req, 64 * 1024); const known = config.vaults.map(v => v.id);
          if (typeof b.admin === 'boolean') d.admin = b.admin;
          d.vaults = d.admin ? null : Array.isArray(b.vaults) ? [...new Set(b.vaults.filter(x => known.includes(x)))] : (d.vaults ?? []);
          saveDevices(); return send(res, 200, { id, admin: d.admin, vaults: d.vaults });
        }
        if (req.method === 'DELETE') { devices = devices.filter(x => x.id !== id); saveDevices(); seen.delete(id); console.log(`  Aparelho removido: ${d.name}`); return send(res, 200, { removed: id }); }
      }
      if (sub === 'server' && req.method === 'GET') return send(res, 200, { name: config.name, mode: config.mode, port, configDir });
      if (sub === 'server' && req.method === 'PATCH') {
        const b = await body(req, 64 * 1024);
        if (b.name != null) config.name = cleanName(b.name, config.name);
        const mode = b.mode === 'pessoal' || b.mode === 'rede' ? b.mode : config.mode; const changed = mode !== config.mode; config.mode = mode; saveConfig();
        return send(res, 200, { name: config.name, mode, restart: changed, next: `${tlsCert ? 'https' : 'http'}://localhost:${port}/` });
      }
      return send(res, 404, { error: 'not found' });
    }
    const vmatch = /^\/api\/v\/([^/]+)\/(.+)$/.exec(u.pathname);
    if (!vmatch) return send(res, 404, { error: 'not found' });
    const vault = config.vaults.find(v => v.id === decodeURIComponent(vmatch[1]));
    if (!vault || !can(vault.id)) return send(res, 404);
    const action = vmatch[2];
    if (action === 'manifest') { useVault(vault); return send(res, 200, walk(root, '', { folders: [], files: [] })); }
    if (action === 'fetch' && req.method === 'POST') {
      const b = await body(req);
      if (b.__bad) return send(res, 400);
      if ((b.paths || []).length > 500) return send(res, 400, { error: 'too many paths' });
      useVault(vault);
      return send(res, 200, { files: (b.paths || []).map(p => { const f = resolve(p, true); if (!f || !fs.existsSync(f)) return null; const c = fs.readFileSync(f, 'utf8'); return { path: p, content: c, version: sha(c) }; }).filter(Boolean) });
    }
    if (action === 'sync' && req.method === 'POST') {
      const b = await body(req);
      if (b.__bad) return send(res, 400);
      if (b.__tooLarge) return send(res, 413);
      if ((b.ops || []).length > 500) return send(res, 400, { error: 'too many ops' });
      useVault(vault);
      return send(res, 200, { results: (b.ops || []).map(op => { try { return applyOp(op, dev.name); } catch (e) { console.log('  erro', e.message); return { id: op.id, status: 'error', message: 'server error' }; } }) });
    }
    if (action === 'raw') {
      useVault(vault);
      const f = resolve(u.searchParams.get('path') || '', false);
      if (!f || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return send(res, 404);
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
      const t = INLINE[path.extname(f).toLowerCase()];
      res.writeHead(200, t ? { 'Content-Type': t } : { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${encodeURIComponent(path.basename(f))}"` });
      return fs.createReadStream(f).pipe(res);
    }
    if (action === 'attachment' && req.method === 'POST') {
      const name = safeName(u.searchParams.get('name') || 'imagem.png'); const ext = path.extname(name).toLowerCase();
      if (!UPLOAD.has(ext)) { req.resume(); return send(res, 415); }
      if (Number(req.headers['content-length'] || 0) > MAX_UPLOAD) { req.resume(); return send(res, 413); }
      const chunks = []; let n = 0; for await (const c of req) { n += c.length; if (n <= MAX_UPLOAD) chunks.push(c); }
      if (n > MAX_UPLOAD) return send(res, 413); if (!n) return send(res, 400);
      useVault(vault);
      const folder = 'anexos'; let rel = folder + '/' + name, i = 2;
      while (fs.existsSync(path.join(root, rel))) rel = folder + '/' + name.replace(/(\.[^.]+)?$/, `-${i++}$1`);
      fs.mkdirSync(path.join(root, folder), { recursive: true }); fs.writeFileSync(path.join(root, rel), Buffer.concat(chunks));
      return send(res, 200, { path: rel });
    }
    return send(res, 404, { error: 'not found' });
  }
  let p = u.pathname === '/' ? '/index.html' : decodeURIComponent(u.pathname);
  const f = path.join(www, path.normalize(p).replace(/^([/\\])+/, ''));
  if (!f.startsWith(www + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': p.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' });
  fs.createReadStream(f).pipe(res);
};
if (tlsCert) {
  https.createServer({ cert: fs.readFileSync(tlsCert), key: fs.readFileSync(tlsKey), maxHeaderSize: 32 * 1024 }, handler).listen(port, () => console.log(`mock em https://localhost:${port}  config=${configDir}${config ? '' : '  (primeira execução, código ' + setupCode + ')'}`));
  http.createServer({ maxHeaderSize: 32 * 1024 }, handler).listen(port - 1);
} else http.createServer({ maxHeaderSize: 32 * 1024 }, handler).listen(port, () => console.log(`mock em http://localhost:${port}  config=${configDir}${config ? '' : '  (primeira execução, código ' + setupCode + ')'}`));
