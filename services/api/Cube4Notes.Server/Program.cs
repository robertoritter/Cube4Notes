using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Collections.Concurrent;
using System.Reflection;

var port = ChoosePort(args);
var notesRoot = ChooseNotesFolder(args);
var accessKey = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
var fileLocks = new ConcurrentDictionary<string, SemaphoreSlim>(StringComparer.OrdinalIgnoreCase);

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls($"http://0.0.0.0:{port}", $"http://[::]:{port}");
var app = builder.Build();

app.Use(async (context, next) =>
{
    var remote = context.Connection.RemoteIpAddress;
    if (remote is null || !IsLocalClient(remote))
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return;
    }

    if (context.Request.Path.StartsWithSegments("/api") &&
        !CryptographicOperations.FixedTimeEquals(
            System.Text.Encoding.UTF8.GetBytes(context.Request.Headers.Authorization.ToString().Replace("Bearer ", "", StringComparison.Ordinal)),
            System.Text.Encoding.UTF8.GetBytes(accessKey)))
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return;
    }

    await next();
});

app.MapGet("/api/tree", (string? path) =>
{
    var directory = ResolvePath(notesRoot, path ?? "");
    if (directory is null || !Directory.Exists(directory)) return Results.NotFound();
    var relative = Path.GetRelativePath(notesRoot, directory).Replace('\\', '/');
    var folders = Directory.EnumerateDirectories(directory)
        .Where(x => !Path.GetFileName(x).StartsWith('.') && !IsReparsePoint(x))
        .Select(x => new Entry(Path.GetFileName(x), Join(relative, Path.GetFileName(x)), true))
        .OrderBy(x => x.Name, StringComparer.OrdinalIgnoreCase);
    var files = Directory.EnumerateFiles(directory, "*.md")
        .Where(x => !IsReparsePoint(x))
        .Select(x => new Entry(Path.GetFileName(x), Join(relative, Path.GetFileName(x)), false))
        .OrderBy(x => x.Name, StringComparer.OrdinalIgnoreCase);
    return Results.Ok(new TreeResponse(relative == "." ? "" : relative, folders.Concat(files)));
});
app.MapGet("/api/file", (string? path) =>
{
    var file = ResolveMarkdown(notesRoot, path);
    if (file is null || !File.Exists(file)) return Results.NotFound();
    var content = File.ReadAllText(file);
    return Results.Ok(new FileResponse(path!, content, VersionOf(content)));
});
app.MapPut("/api/file", async (HttpRequest request, string? path) =>
{
    var file = ResolveMarkdown(notesRoot, path);
    if (file is null) return Results.BadRequest(new { error = "Use um caminho relativo para um arquivo .md." });
    var body = await request.ReadFromJsonAsync<SaveRequest>();
    if (body is null || string.IsNullOrEmpty(body.BaseVersion)) return Results.BadRequest(new { error = "Versão-base obrigatória." });
    var gate = fileLocks.GetOrAdd(file, _ => new SemaphoreSlim(1, 1));
    await gate.WaitAsync();
    try
    {
        if (!File.Exists(file)) return Results.NotFound();
        var current = File.ReadAllText(file);
        if (!CryptographicOperations.FixedTimeEquals(
            System.Text.Encoding.UTF8.GetBytes(VersionOf(current)),
            System.Text.Encoding.UTF8.GetBytes(body.BaseVersion)))
            return Results.Conflict(new { error = "A nota mudou no servidor desde que foi aberta. Suas alterações locais foram mantidas; copie-as antes de recarregar." });
        Directory.CreateDirectory(Path.GetDirectoryName(file)!);
        var temporary = file + "." + Guid.NewGuid().ToString("N") + ".tmp";
        await File.WriteAllTextAsync(temporary, body.Content);
        File.Move(temporary, file, true);
        return Results.Ok(new { version = VersionOf(body.Content) });
    }
    finally { gate.Release(); }
});
app.MapPost("/api/file", async (CreateRequest body) =>
{
    var file = ResolveMarkdown(notesRoot, body.Path);
    if (file is null) return Results.BadRequest(new { error = "Use um caminho relativo para um arquivo .md." });
    Directory.CreateDirectory(Path.GetDirectoryName(file)!);
    if (File.Exists(file)) return Results.Conflict(new { error = "Já existe um arquivo com esse nome." });
    await File.WriteAllTextAsync(file, "# " + Path.GetFileNameWithoutExtension(file) + "\n\n");
    return Results.Ok();
});
app.MapPost("/api/folder", (CreateRequest body) =>
{
    var directory = ResolvePath(notesRoot, body.Path);
    if (directory is null) return Results.BadRequest(new { error = "Use um caminho relativo à pasta de notas." });
    Directory.CreateDirectory(directory);
    return Results.Ok();
});
app.MapGet("/brand/cube4code-symbol.png", () => Results.File(EmbeddedAsset("Cube4Notes.Brand.Symbol.png"), "image/png"));
app.MapGet("/brand/manrope.woff2", () => Results.File(EmbeddedAsset("Cube4Notes.Brand.Manrope.woff2"), "font/woff2"));

static string ChooseNotesFolder(string[] args)
{
    var supplied = Array.IndexOf(args, "--notes");
    if (supplied >= 0 && supplied + 1 < args.Length) return CreateAndNormalize(args[supplied + 1]);
    var suggested = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "Cube4Notes");
    Console.Write($"Pasta central de notas [{suggested}]: ");
    var input = Console.ReadLine();
    return CreateAndNormalize(string.IsNullOrWhiteSpace(input) ? suggested : input.Trim().Trim('"'));
}

static byte[] EmbeddedAsset(string name)
{
    using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(name)
        ?? throw new InvalidOperationException($"Asset embutido ausente: {name}");
    using var buffer = new MemoryStream();
    stream.CopyTo(buffer);
    return buffer.ToArray();
}

static int ChoosePort(string[] args)
{
    var index = Array.IndexOf(args, "--port");
    if (index < 0) return 43123;
    if (index + 1 >= args.Length || !int.TryParse(args[index + 1], out var port) || port is < 1024 or > 65535)
        throw new ArgumentException("Use --port seguido de uma porta entre 1024 e 65535.");
    return port;
}

static string CreateAndNormalize(string value)
{
    var root = Path.GetFullPath(value);
    Directory.CreateDirectory(root);
    return root.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
}

static void PrintAddresses(int port)
{
    Console.WriteLine($"\nCube4Notes disponível na porta {port}:");
    foreach (var address in GetLanAddresses()) Console.WriteLine($"  http://{address}:{port}");
    Console.WriteLine("Endereços atualizados conforme as interfaces de rede.");
}

static IEnumerable<IPAddress> GetLanAddresses() => NetworkInterface.GetAllNetworkInterfaces()
    .Where(x => x.OperationalStatus == OperationalStatus.Up)
    .SelectMany(x => x.GetIPProperties().UnicastAddresses)
    .Where(x => x.Address.AddressFamily == AddressFamily.InterNetwork && IsPrivate(x.Address))
    .Select(x => x.Address)
    .Distinct();

static bool IsLocalClient(IPAddress address)
{
    if (IPAddress.IsLoopback(address)) return true;
    if (address.IsIPv4MappedToIPv6) address = address.MapToIPv4();
    return GetLanAddresses().Any(local => SameSubnet(local, address));
}

static bool SameSubnet(IPAddress local, IPAddress remote)
{
    if (local.AddressFamily != AddressFamily.InterNetwork || remote.AddressFamily != AddressFamily.InterNetwork) return false;
    var nic = NetworkInterface.GetAllNetworkInterfaces()
        .Where(x => x.OperationalStatus == OperationalStatus.Up)
        .SelectMany(x => x.GetIPProperties().UnicastAddresses)
        .FirstOrDefault(x => x.Address.Equals(local));
    if (nic?.IPv4Mask is null) return false;
    var a = local.GetAddressBytes(); var b = remote.GetAddressBytes(); var mask = nic.IPv4Mask.GetAddressBytes();
    for (var i = 0; i < 4; i++) if ((a[i] & mask[i]) != (b[i] & mask[i])) return false;
    return true;
}

static bool IsPrivate(IPAddress address)
{
    var b = address.GetAddressBytes();
    return b[0] == 10 || (b[0] == 172 && b[1] is >= 16 and <= 31) || (b[0] == 192 && b[1] == 168);
}

static string? ResolvePath(string root, string relative)
{
    if (Path.IsPathRooted(relative)) return null;
    var parts = relative.Replace('\\', '/').Split('/', StringSplitOptions.RemoveEmptyEntries);
    if (parts.Any(x => x is "." or ".." || x.Contains(':') || x.StartsWith('.'))) return null;
    var path = Path.GetFullPath(Path.Combine(root, Path.Combine(parts)));
    if (!path.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) &&
        !string.Equals(path, root, StringComparison.OrdinalIgnoreCase)) return null;
    for (var current = path; current.Length > root.Length; current = Path.GetDirectoryName(current)!)
        if (Directory.Exists(current) && IsReparsePoint(current)) return null;
    return path;
}

static string? ResolveMarkdown(string root, string? relative)
{
    if (string.IsNullOrWhiteSpace(relative) || !relative.EndsWith(".md", StringComparison.OrdinalIgnoreCase)) return null;
    return ResolvePath(root, relative);
}

static bool IsReparsePoint(string path) => (File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0;
static string VersionOf(string content) => Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(content))).ToLowerInvariant();
static string Join(string folder, string name) => string.IsNullOrEmpty(folder) ? name : folder + "/" + name;

const string Page = """
<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cube4Notes</title>
<style>
@font-face{font-family:Manrope;src:url('/brand/manrope.woff2')}*{box-sizing:border-box}:root{--bg:#f6f7fb;--panel:#fff;--text:#20232a;--muted:#818b9a;--line:#e5e7ee;--button:#fff;--button-text:#383d48;--hover:#f1edff;--item:#515968;--active:#f0ecfb;--active-text:#5c3fb3;color-scheme:light}html[data-theme=dark]{--bg:#17191f;--panel:#22252d;--text:#edf0f6;--muted:#9ca5b4;--line:#373b46;--button:#292d36;--button-text:#edf0f6;--hover:#342d48;--item:#c1c7d2;--active:#39304f;--active-text:#d0bfff;color-scheme:dark}html[data-theme=sepia]{--bg:#f4eddf;--panel:#fff9ed;--text:#342d24;--muted:#897b68;--line:#e5dac6;--button:#fff9ed;--button-text:#493d30;--hover:#f2e6d4;--item:#685944;--active:#eadfcf;--active-text:#6650a5;color-scheme:light}html[data-theme=system]{color-scheme:light dark}@media(prefers-color-scheme:dark){html[data-theme=system]{--bg:#17191f;--panel:#22252d;--text:#edf0f6;--muted:#9ca5b4;--line:#373b46;--button:#292d36;--button-text:#edf0f6;--hover:#342d48;--item:#c1c7d2;--active:#39304f;--active-text:#d0bfff;color-scheme:dark}}body{margin:0;background:var(--bg);color:var(--text);font:15px Manrope,system-ui,sans-serif}header{min-height:76px;background:var(--panel);border-bottom:1px solid var(--line);display:flex;align-items:center;padding:10px 28px;gap:13px}.symbol{width:38px;height:42px;object-fit:contain}.brand{font-size:21px;font-weight:800;letter-spacing:-.7px}.four{color:#a889ff;font-size:1.13em;font-weight:900}.by{font-size:11px;color:var(--muted)}.by a{color:inherit;text-decoration:none}.controls{display:flex;gap:8px;margin-left:auto}.controls label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}select{font:inherit;background:var(--button);color:var(--button-text);border:1px solid var(--line);border-radius:8px;padding:7px 9px}.layout{display:grid;grid-template-columns:280px 1fr;min-height:calc(100vh - 76px)}aside{background:var(--panel);border-right:1px solid var(--line);padding:20px 14px}.actions{display:flex;gap:8px;margin:0 5px 16px}button{font:inherit;cursor:pointer;border:1px solid var(--line);background:var(--button);color:var(--button-text);border-radius:8px;padding:8px 11px}button:hover{background:var(--hover);border-color:#cbbaff}.actions button:first-child{background:#7554d6;color:white;border-color:#7554d6}.tree{display:grid;gap:3px}.item{padding:8px 10px;border-radius:7px;color:var(--item);cursor:pointer;overflow-wrap:anywhere}.item:hover,.item.active{background:var(--active);color:var(--active-text)}.item.folder{font-weight:700}.main{padding:34px;max-width:1050px;width:100%;margin:0 auto}.crumb{font-size:13px;color:var(--muted);margin-bottom:20px}.title{font-weight:800;font-size:28px;letter-spacing:-1px;margin:0 0 18px}.toolbar{display:flex;gap:6px;flex-wrap:wrap;padding:10px;background:var(--panel);border:1px solid var(--line);border-radius:12px 12px 0 0}.toolbar button{min-width:36px;padding:6px 9px}.editor{display:block;width:100%;min-height:55vh;resize:vertical;border:1px solid var(--line);border-top:0;border-radius:0 0 12px 12px;background:var(--panel);color:var(--text);padding:20px;font:15px/1.7 ui-monospace,Consolas,monospace;outline:none}.hint{font-size:12px;color:var(--muted);margin-top:10px}.save{background:#7554d6;color:#fff;border-color:#7554d6;margin-top:14px}.notice{position:fixed;bottom:20px;right:20px;background:#21242c;color:#fff;padding:12px 18px;border-radius:10px;opacity:0;transition:opacity .2s}.notice.on{opacity:1}@media(max-width:720px){header{padding:10px 14px;flex-wrap:wrap}.controls{width:100%;margin:2px 0 0 50px}.layout{grid-template-columns:1fr}aside{border-right:0;border-bottom:1px solid var(--line);padding:12px}.tree{grid-template-columns:repeat(2,minmax(0,1fr));max-height:170px;overflow:auto}.main{padding:20px 14px}.editor{min-height:48vh}}
</style></head><body><header><img class="symbol" src="/brand/cube4code-symbol.png" alt=""><div><div class="brand">Cube<span class="four">4</span>Notes</div><div class="by">created by <a href="https://cube4code.com/" target="_blank" rel="noopener noreferrer">Cube<span class="four">4</span>Code.com</a></div></div><div class="controls"><label id="language-label" for="language"></label><select id="language" aria-labelledby="language-label" onchange="setLanguage(this.value)"><option value="pt-BR">Português (Brasil)</option><option value="en">English</option></select><label id="theme-label" for="theme"></label><select id="theme" aria-labelledby="theme-label" onchange="setTheme(this.value)"><option value="system"></option><option value="light"></option><option value="dark"></option><option value="sepia"></option></select></div></header>
<div class="layout"><aside><div class="actions"><button id="new-note" onclick="newNote()"></button><button id="new-folder" onclick="newFolder()"></button></div><div id="tree" class="tree"></div></aside><main class="main"><div id="crumb" class="crumb"></div><h1 id="title" class="title">Cube4Notes</h1><div class="toolbar"><button id="bold" title="" onclick="wrap('**','**')"><b>B</b></button><button id="italic" title="" onclick="wrap('*','*')"><i>I</i></button><button id="heading" title="" onclick="line('# ')">H1</button><button id="list" title="" onclick="line('- ')">☷</button><button id="link" title="" onclick="wrap('[','](https://)')">↗ <span></span></button><button id="undo" title="" onclick="editor.focus();document.execCommand('undo')">↶</button><button id="redo" title="" onclick="editor.focus();document.execCommand('redo')">↷</button></div><textarea id="editor" class="editor"></textarea><div id="hint" class="hint"></div><button id="save" class="save" onclick="save()"></button></main></div><div id="notice" class="notice"></div>
<dialog id="ask-dialog" class="ask-dialog"><form id="ask-form"><label id="ask-label" for="ask-input"></label><input id="ask-input" autocomplete="off" required><div class="ask-actions"><button id="ask-cancel" type="button" onclick="document.getElementById('ask-dialog').close()"></button><button id="ask-ok" class="save" type="submit"></button></div></form></dialog>
<script>
let language=localStorage.getItem('cube4notes-language')||'pt-BR',theme=localStorage.getItem('cube4notes-theme')||'system',key=localStorage.getItem('cube4notes-key')||'';let active='',folder='',activeVersion='';const editor=document.getElementById('editor');
const words={
'pt-BR':{language:'Idioma',theme:'Tema',system:'Seguir o sistema',light:'Claro',dark:'Escuro',sepia:'Sépia',newNote:'＋ Nota',newFolder:'＋ Pasta',notes:'Suas notas',back:'← Voltar',placeholder:'Selecione uma nota ou crie uma nova.',hint:'Arquivo Markdown simples · alterações salvas no servidor central',save:'Salvar alterações',bold:'Negrito',italic:'Itálico',heading:'Título',list:'Lista',link:'Link',undo:'Desfazer',redo:'Refazer',wrongKey:'Código inválido. Informe-o novamente.',noFile:'Crie ou selecione uma nota primeiro.',saved:'Nota salva.',changed:'A nota foi alterada no servidor. Seu texto continua nesta tela. Copie-o antes de recarregar ou reabrir a nota.',saveError:'Não foi possível salvar: ',noteName:'Nome da nota:',folderName:'Nome da pasta:',accessCode:'Código de acesso do servidor:',ok:'Continuar',cancel:'Cancelar',folderCreated:'Pasta criada.',loadError:'Não foi possível abrir notas: '},
en:{language:'Language',theme:'Theme',system:'System',light:'Light',dark:'Dark',sepia:'Sepia',newNote:'＋ Note',newFolder:'＋ Folder',notes:'Your notes',back:'← Back',placeholder:'Select a note or create a new one.',hint:'Plain Markdown file · changes saved to the central server',save:'Save changes',bold:'Bold',italic:'Italic',heading:'Heading',list:'List',link:'Link',undo:'Undo',redo:'Redo',wrongKey:'Invalid access code. Enter it again.',noFile:'Create or select a note first.',saved:'Note saved.',changed:'This note changed on the server. Your text is still here. Copy it before reloading or opening the note again.',saveError:'Could not save: ',noteName:'Note name:',folderName:'Folder name:',accessCode:'Server access code:',ok:'Continue',cancel:'Cancel',folderCreated:'Folder created.',loadError:'Could not open notes: '}};
function t(k){return words[language][k]}function applyLanguage(){document.documentElement.lang=language;document.getElementById('language').value=language;document.getElementById('theme').value=theme;document.getElementById('language-label').textContent=t('language');document.getElementById('theme-label').textContent=t('theme');for(const [id,k] of [['new-note','newNote'],['new-folder','newFolder'],['bold','bold'],['italic','italic'],['heading','heading'],['list','list'],['link','link'],['undo','undo'],['redo','redo']]){const el=document.getElementById(id);if(id==='link')el.lastElementChild.textContent=t(k);else if(id.startsWith('new-'))el.textContent=t(k);el.title=t(k)}document.getElementById('theme').options[0].text=t('system');document.getElementById('theme').options[1].text=t('light');document.getElementById('theme').options[2].text=t('dark');document.getElementById('theme').options[3].text=t('sepia');document.getElementById('crumb').textContent=active?active:t('notes');editor.placeholder=t('placeholder');document.getElementById('hint').textContent=t('hint');document.getElementById('save').textContent=t('save');document.getElementById('ask-cancel').textContent=t('cancel');document.getElementById('ask-ok').textContent=t('ok')}
function setLanguage(value){language=value;localStorage.setItem('cube4notes-language',value);applyLanguage()}
function setTheme(value){theme=value;localStorage.setItem('cube4notes-theme',value);document.documentElement.dataset.theme=value}
function askText(label,secret=false){return new Promise(resolve=>{const dialog=document.getElementById('ask-dialog'),input=document.getElementById('ask-input');document.getElementById('ask-label').textContent=label;input.value='';input.type=secret?'password':'text';dialog.addEventListener('close',()=>resolve(dialog.returnValue==='ok'?input.value:null),{once:true});document.getElementById('ask-form').onsubmit=e=>{e.preventDefault();dialog.returnValue='ok';dialog.close()};dialog.showModal();input.focus()})}
async function requestKey(){const value=await askText(t('accessCode'),true);if(!value)return;key=value;localStorage.setItem('cube4notes-key',key);loadTree().catch(e=>msg(t('loadError')+e.message))}
setTheme(theme);applyLanguage();if(key)loadTree().catch(e=>msg(t('loadError')+e.message));else requestKey();
async function api(url,options={}){const r=await fetch(url,{...options,headers:{'Content-Type':'application/json','Authorization':'Bearer '+key,...options.headers}});if(r.status===401){localStorage.removeItem('cube4notes-key');key='';msg(t('wrongKey'));requestKey()}if(!r.ok)throw Error(r.status+': '+(await r.text()));return r.status===204?null:r.json()}
function msg(s){const n=document.getElementById('notice');n.textContent=s;n.classList.add('on');setTimeout(()=>n.classList.remove('on'),2200)}
function safeName(s){return s.trim().replace(/[\\/:*?"<>|]/g,'-').replace(/\.+$/,'')}
async function loadTree(path=''){folder=path;const data=await api('/api/tree?path='+encodeURIComponent(path));const root=document.getElementById('tree');root.replaceChildren();if(path){const back=document.createElement('div');back.className='item';back.textContent=t('back');back.onclick=()=>loadTree(path.split('/').slice(0,-1).join('/'));root.append(back)}for(const e of data.entries){const el=document.createElement('div');el.className='item '+(e.isFolder?'folder':'')+(active===e.path?' active':'');el.textContent=(e.isFolder?'▸ ':'')+e.name;el.title=e.name;el.onclick=()=>e.isFolder?loadTree(e.path):openFile(e.path);root.append(el)}}
async function openFile(path){const data=await api('/api/file?path='+encodeURIComponent(path));active=path;activeVersion=data.version;editor.value=data.content;document.getElementById('title').textContent=path.split('/').pop();document.getElementById('crumb').textContent=path;await loadTree(folder)}
async function save(){if(!active)return msg(t('noFile'));try{const result=await api('/api/file?path='+encodeURIComponent(active),{method:'PUT',body:JSON.stringify({content:editor.value,baseVersion:activeVersion})});activeVersion=result.version;msg(t('saved'))}catch(e){if(e.message.startsWith('409:'))alert(t('changed'));else msg(t('saveError')+e.message)}}
async function newNote(){const name=safeName(await askText(t('noteName'))||'');if(!name)return;const path=[folder,name.toLowerCase().endsWith('.md')?name:name+'.md'].filter(Boolean).join('/');await api('/api/file',{method:'POST',body:JSON.stringify({path})});await loadTree(folder);await openFile(path)}
async function newFolder(){const name=safeName(await askText(t('folderName'))||'');if(!name)return;const path=[folder,name].filter(Boolean).join('/');await api('/api/folder',{method:'POST',body:JSON.stringify({path})});await loadTree(folder);msg(t('folderCreated'))}
function wrap(before,after){const a=editor.selectionStart,b=editor.selectionEnd,s=editor.value;editor.setRangeText(before+s.slice(a,b)+after,a,b,'select');editor.focus()}
function line(prefix){const a=editor.selectionStart,s=editor.value,start=s.lastIndexOf('\n',a-1)+1;editor.setRangeText(prefix,start,start,'end');editor.focus()}
</script><style>html[data-theme=system]{color-scheme:light dark}.ask-dialog{width:min(430px,calc(100% - 32px));border:1px solid var(--line);border-radius:14px;background:var(--panel);color:var(--text);padding:24px;box-shadow:0 24px 80px #10131a40}.ask-dialog::backdrop{background:#10131a70;backdrop-filter:blur(2px)}#ask-form{display:grid;gap:14px}#ask-label{font-weight:700}#ask-input{width:100%;font:inherit;color:var(--text);background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px 12px}.ask-actions{display:flex;justify-content:flex-end;gap:8px}.ask-actions .save{margin-top:0}html,body{height:100%;overflow:hidden}body{display:flex;flex-direction:column;min-height:100dvh}header{flex:0 0 auto}.layout{grid-template-columns:260px minmax(0,1fr);flex:1 1 auto;min-height:0}aside{min-height:0;overflow-y:auto}.main{max-width:none;width:100%;margin:0;display:flex;flex-direction:column;min-width:0;min-height:0;padding:clamp(20px,3vw,42px)}.crumb,.title,.toolbar,.hint,.save{flex:0 0 auto}.editor{flex:1 1 auto;height:auto;min-height:0;resize:none}@media(max-width:720px){html,body{height:auto;min-height:100%;overflow:auto}body{min-height:100dvh}.layout{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr);min-height:calc(100dvh - 76px)}aside{max-height:22vh;overflow:auto}.main{min-height:75vh;padding:20px 14px}.editor{flex:0 0 50vh;min-height:250px}}</style></body></html>
""";

app.MapGet("/", () => Results.Content(Page, "text/html; charset=utf-8"));

var listener = new NetworkAddressListener();
listener.Changed += () => PrintAddresses(port);
NetworkChange.NetworkAddressChanged += listener.Refresh;
PrintAddresses(port);
Console.WriteLine($"Notas: {notesRoot}");
Console.WriteLine($"Código de acesso para navegadores e agentes: {accessKey}");
Console.WriteLine("O acesso é restrito à rede local. Ctrl+C encerra o servidor.");
await app.RunAsync();

sealed record Entry(string Name, string Path, bool IsFolder);
sealed record TreeResponse(string Path, IEnumerable<Entry> Entries);
sealed record FileResponse(string Path, string Content, string Version);
sealed record SaveRequest(string Content, string BaseVersion);
sealed record CreateRequest(string Path);

sealed class NetworkAddressListener
{
    private readonly object gate = new();
    private string current = string.Join(',', NetworkInterface.GetAllNetworkInterfaces()
        .Where(x => x.OperationalStatus == OperationalStatus.Up)
        .SelectMany(x => x.GetIPProperties().UnicastAddresses)
        .Where(x => x.Address.AddressFamily == AddressFamily.InterNetwork && IsPrivateAddress(x.Address))
        .Select(x => x.Address).OrderBy(x => x.ToString()));
    public event Action? Changed;
    public void Refresh(object? sender, EventArgs args)
    {
        var next = string.Join(',', NetworkInterface.GetAllNetworkInterfaces()
            .Where(x => x.OperationalStatus == OperationalStatus.Up)
            .SelectMany(x => x.GetIPProperties().UnicastAddresses)
            .Where(x => x.Address.AddressFamily == AddressFamily.InterNetwork && IsPrivateAddress(x.Address))
            .Select(x => x.Address).OrderBy(x => x.ToString()));
        lock (gate) { if (current == next) return; current = next; }
        Changed?.Invoke();
    }
    private static bool IsPrivateAddress(IPAddress address)
    {
        var b = address.GetAddressBytes();
        return b[0] == 10 || (b[0] == 172 && b[1] is >= 16 and <= 31) || (b[0] == 192 && b[1] == 168);
    }
}
