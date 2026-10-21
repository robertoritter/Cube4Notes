/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * Cube4Notes Server: inicialização, assistente de primeira execução e rotas da API. Serve a interface web,
 * sincroniza os vaults (pastas de notas Markdown) com os aparelhos e administra aparelhos e vaults.
 * Modo "pessoal": só este computador (localhost). Modo "rede": HTTPS para os aparelhos da casa.
 * Nenhuma alteração é descartada (conflito vira cópia, exclusão vai para a .lixeira).
 * Com tela disponível, abre numa janela própria (processo separado) e, no Windows, fica com um ícone
 * perto do relógio; sem tela (servidor), roda só no console. "--sem-janela" força o modo console.
 */
using System.Diagnostics;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

Console.OutputEncoding = Encoding.UTF8;

var configArg = ArgValue(args, "--config");
if (configArg is not null) ConfigStore.Dir = Path.GetFullPath(configArg);
Directory.CreateDirectory(ConfigStore.Dir);
// Processo da janela: só mostra o Cube4Notes que já está rodando.
if (ArgValue(args, "--janela") is { } windowUrl) return Janela.Run(windowUrl);
var portArg = ArgValue(args, "--port") is { } portText ? ParsePort(portText) : (int?)null;
var notesArg = ArgValue(args, "--notes");
var forceHttp = args.Contains("--sem-https");
var openBrowser = !args.Contains("--sem-navegador");

var devices = new DeviceStore(Path.Combine(ConfigStore.Dir, "devices.json"));
var invites = new InviteStore();
var throttle = new FailureThrottle();
var registry = new VaultRegistry();
var contentTypes = new FileExtensionContentTypeProvider();
contentTypes.Mappings[".webmanifest"] = "application/manifest+json";
var tlsReady = false;
var windowMode = !args.Contains("--sem-janela") && Janela.HasDesktop();

// Janela, ícone na bandeja e encerramento: compartilhados entre reinícios do servidor
Process? windowProc = null;
Bandeja? tray = null;
var trayHinted = false;
var currentPersonal = false;
var currentUrl = "";
Action? stopServer = null;

if (windowMode)
{
    // Cube4Notes já aberto: este processo vira só mais uma janela dele.
    var existing = ConfigStore.Load();
    var existingPort = portArg ?? existing?.Port ?? 43125;
    if (existing is not null && Janela.ServerRunning(existingPort))
        return Janela.Run(existing.Mode == "pessoal" || forceHttp ? $"http://localhost:{existingPort}/" : $"https://localhost:{existingPort}/");
    if (OperatingSystem.IsWindows())
        tray = new Bandeja(Janela.IconPath(), "Cube4Notes", () => StartWindow(currentUrl), Quit, () => _ = Task.Run(() => AllowFirewall(true)));
}

// Reinicia o servidor (sem fechar o programa) quando o modo ou a porta mudam.
while (true)
{
    var config = ConfigStore.Load() ?? ConfigStore.Migrate(notesArg);
    var result = await RunAsync(config);
    if (result <= 0)
    {
        if (OperatingSystem.IsWindows()) tray?.Dispose();
        try { if (windowProc is { HasExited: false }) windowProc.Kill(); } catch (Exception) { }
        return result == 0 ? 0 : 1;
    }
    openBrowser = false;
    Console.WriteLine(Idioma.T("\n  Reiniciando com a nova configuração...\n", "\n  Restarting with the new settings...\n"));
}

void StartWindow(string url)
{
    if (string.IsNullOrEmpty(url)) return;
    if (windowProc is { HasExited: false })
    {
        if (OperatingSystem.IsWindows()) Bandeja.Focus(windowProc.MainWindowHandle);
        return;
    }
    windowProc = Janela.Spawn(url);
    if (windowProc is null) return;
    windowProc.EnableRaisingEvents = true;
    windowProc.Exited += (_, _) =>
    {
        // Só este computador: fechar a janela encerra. Rede de casa: continua atendendo os outros aparelhos.
        if (currentPersonal) stopServer?.Invoke();
        else if (OperatingSystem.IsWindows())
        {
            if (tray is null || trayHinted) return;
            trayHinted = true;
            tray.Notify(Idioma.T("Cube4Notes continua rodando", "Cube4Notes is still running"), Idioma.T("Os outros aparelhos seguem sincronizando. Clique no ícone para abrir ou encerrar.", "Your other devices keep syncing. Click the icon to open or quit."));
        }
    };
}

// Libera as portas na rede local (uma vez, com a confirmação do Windows). manual: pedido pelo menu do ícone.
void AllowFirewall(bool manual)
{
    if (!OperatingSystem.IsWindows()) return;
    if (currentPersonal || string.IsNullOrEmpty(currentUrl)) return;
    if (!manual && (Firewall.HasRule() || Firewall.RecentlyDeclined())) return;
    var port = new Uri(currentUrl).Port;
    Console.WriteLine(Idioma.T("  O Windows vai pedir confirmação para liberar o Cube4Notes na rede local (portas " + (port - 1) + " e " + port + ").", "  Windows will ask to allow Cube4Notes on the local network (ports " + (port - 1) + " and " + port + ")."));
    var ok = Firewall.Allow(port);
    Console.WriteLine(ok ? Idioma.T("  Firewall liberado para a rede local.", "  Firewall allowed for the local network.") : Idioma.T("  Firewall não foi liberado; celular e outros aparelhos podem não conectar.", "  Firewall was not changed; phones and other devices may not connect."));
    if (tray is not null) tray.Notify(ok ? Idioma.T("Rede local liberada", "Local network allowed") : Idioma.T("Firewall não liberado", "Firewall not changed"),
        ok ? Idioma.T("Celular e outros aparelhos da casa já podem conectar.", "Phones and other devices at home can connect now.") : Idioma.T("Se o celular não conectar, use o menu do ícone: Liberar no firewall.", "If a phone cannot connect, use the icon menu: Allow through firewall."));
}

void Quit()
{
    try { if (windowProc is { HasExited: false }) windowProc.Kill(); } catch (Exception) { }
    stopServer?.Invoke();
}

// 0 = encerrar, 1 = reiniciar, -1 = erro
async Task<int> RunAsync(AppConfig? config)
{
    var setup = config is null || config.Vaults.Count == 0;
    var setupCode = setup ? NewSetupCode() : "";
    // Primeira execução numa janela: o assistente roda só neste computador (sem certificado); o HTTPS só entra se escolher "Rede de casa".
    var personal = setup ? windowMode : config!.Mode == "pessoal";
    var port = portArg ?? config?.Port ?? 43125;
    var useHttps = !personal && !forceHttp;
    var httpPort = port - 1;
    var scheme = useHttps ? "https" : "http";
    if (useHttps && !tlsReady) { Tls.Init(Path.Combine(ConfigStore.Dir, "tls")); tlsReady = true; }
    if (config is not null) registry.Load(config);
    var restart = false;

    var builder = WebApplication.CreateBuilder(new WebApplicationOptions
    {
        Args = args,
        ContentRootPath = AppContext.BaseDirectory,
        WebRootPath = Path.Combine(AppContext.BaseDirectory, "wwwroot"),
    });
    builder.Logging.SetMinimumLevel(LogLevel.Warning);
    builder.WebHost.ConfigureKestrel(k =>
    {
        k.Limits.MaxRequestBodySize = 32L * 1024 * 1024;
        k.Limits.MaxRequestHeadersTotalSize = 32 * 1024;
        if (personal)
        {
            // Só este computador: nada exposto na rede, sem firewall e sem certificado.
            k.Listen(IPAddress.Loopback, port);
            k.Listen(IPAddress.IPv6Loopback, port);
        }
        else if (useHttps)
        {
            k.ListenAnyIP(port, o => o.UseHttps(h => h.ServerCertificateSelector = (_, _) => Tls.Current()));
            k.ListenAnyIP(httpPort);
        }
        else k.ListenAnyIP(port);
    });
    var app = builder.Build();

    // ------------------------------------------------------------ rede local, origem e autorização
    app.Use(async (context, next) =>
    {
        var remote = context.Connection.RemoteIpAddress;
        var headers = context.Response.Headers;
        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "DENY";
        headers["Referrer-Policy"] = "no-referrer";
        headers["Cross-Origin-Opener-Policy"] = "same-origin";
        headers["Cross-Origin-Resource-Policy"] = "same-origin";
        headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=(), usb=()";
        headers["Content-Security-Policy"] = Security.Csp;

        if (remote is null || !Lan.IsLocalClient(remote))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }
        if (!Security.HostAllowed(context.Request.Host.Host))
        {
            Security.Log(Idioma.T($"Host recusado: {context.Request.Host.Host} de {Lan.Normalize(remote)}", $"Host refused: {context.Request.Host.Host} from {Lan.Normalize(remote)}"));
            context.Response.StatusCode = StatusCodes.Status421MisdirectedRequest;
            return;
        }
        var path = context.Request.Path;
        // Agente no próprio computador pode usar /mcp em http (o token não sai da máquina); da rede, só https.
        var localMcp = path.Equals("/mcp", StringComparison.OrdinalIgnoreCase) && IsLoopback(context);
        if (useHttps && !context.Request.IsHttps && !localMcp)
        {
            if (path.Equals(Tls.CertPath, StringComparison.OrdinalIgnoreCase))
            {
                context.Response.ContentType = "application/x-x509-ca-cert";
                context.Response.Headers.ContentDisposition = "attachment; filename=Cube4Notes-CA.cer";
                await context.Response.Body.WriteAsync(Tls.CaDer);
                return;
            }
            context.Response.Redirect($"https://{context.Request.Host.Host}:{port}{context.Request.PathBase}{path}{context.Request.QueryString}");
            return;
        }
        if (!HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method) && !Security.SameOrigin(context.Request))
        {
            Security.Log(Idioma.T($"Origem recusada: {context.Request.Headers.Origin} de {Lan.Normalize(remote)}", $"Origin refused: {context.Request.Headers.Origin} from {Lan.Normalize(remote)}"));
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }
        if (path.StartsWithSegments("/api"))
        {
            headers.CacheControl = "no-store";
            var open = path.StartsWithSegments("/api/status") || path.StartsWithSegments("/api/pair") || path.StartsWithSegments("/api/setup");
            if (setup && !open)
            {
                context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
                return;
            }
            if (!open)
            {
                var device = DeviceOf(context);
                if (device is null)
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return;
                }
                context.Items["device"] = device;
                // Token de agente: só leitura, nunca administra (nem no próprio computador)
                if (device.ReadOnly && !HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method))
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    return;
                }
                var admin = !device.ReadOnly && (device.Admin || IsLoopback(context));
                context.Items["admin"] = admin;
                if (path.StartsWithSegments("/api/admin") && !admin)
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    return;
                }
                // /api/v/{vault}/...: só vaults liberados para este aparelho
                if (path.StartsWithSegments("/api/v", out var rest))
                {
                    var id = rest.Value?.TrimStart('/').Split('/')[0] ?? "";
                    var vault = registry.Get(id);
                    if (vault is null || !(admin || device.CanAccess(id)))
                    {
                        context.Response.StatusCode = StatusCodes.Status404NotFound;
                        return;
                    }
                    context.Items["vault"] = vault;
                }
            }
        }
        else headers.CacheControl = path.StartsWithSegments("/assets") ? "public, max-age=31536000, immutable" : "no-cache";
        // O ícone pode ser carregado de outro endereço do mesmo servidor: é como o aparelho testa se acha o computador pelo nome.
        if (path.Equals("/brand/favicon.png", StringComparison.OrdinalIgnoreCase)) headers["Cross-Origin-Resource-Policy"] = "cross-origin";
        await next();
    });

    app.MapGet(Tls.CertPath, () => useHttps ? Results.File(Tls.CaDer, "application/x-x509-ca-cert", "Cube4Notes-CA.cer") : Results.NotFound());
    // Interface embutida no executável; a pasta wwwroot no disco só é usada se o executável não tiver a interface.
    app.Use(async (ctx, next) =>
    {
        if (!ctx.Request.Path.StartsWithSegments("/api") && await Interface.TryServe(ctx, contentTypes)) return;
        await next();
    });
    if (!Interface.Embedded && Directory.Exists(app.Environment.WebRootPath))
    {
        app.UseDefaultFiles();
        app.UseStaticFiles(new StaticFileOptions { ContentTypeProvider = contentTypes });
    }

    // ------------------------------------------------------------ estado e pareamento
    // MCP: agentes de IA leem as notas liberadas (somente leitura).
    app.MapMethods("/mcp", ["GET", "POST", "DELETE"], async (HttpContext ctx) =>
    {
        ctx.Response.Headers.CacheControl = "no-store";
        if (setup) return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
        var device = DeviceOf(ctx);
        if (device is null)
        {
            ctx.Response.Headers.WWWAuthenticate = "Bearer";
            return Results.Json(new { error = "Send the agent token in the header Authorization: Bearer <token>." }, statusCode: StatusCodes.Status401Unauthorized);
        }
        return await Mcp.Handle(ctx, device, registry);
    });

    app.MapGet("/api/status", (HttpContext ctx) =>
    {
        var device = DeviceOf(ctx);
        var loopback = IsLoopback(ctx);
        return Results.Ok(new
        {
            name = config?.Name ?? Environment.MachineName,
            setup,
            mode = personal ? "pessoal" : "rede",
            paired = device is not null,
            loopback,
            admin = device is not null && !device.ReadOnly && (device.Admin || loopback),
            ui = UiVersion(),
            // endereço pelo nome do computador (não muda quando o IP muda); os aparelhos testam se conseguem usá-lo
            hostUrl = useHttps && Tls.NetName.Length > 0 ? $"https://{Tls.NetName}:{port}/" : null,
        });
    });

    app.MapPost("/api/pair", (HttpContext ctx, PairRequest body) =>
    {
        if (setup) return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
        var ip = Lan.Normalize(ctx.Connection.RemoteIpAddress!).ToString();
        var loopback = IsLoopback(ctx);
        var admin = loopback;
        var vaults = registry.All().Select(v => v.Id).ToList();
        // Convite de transferência: o mesmo aparelho, agora por outro endereço (ganha um token a mais, nada é duplicado)
        if (!string.IsNullOrEmpty(body.Transfer))
        {
            if (throttle.Blocked(ip)) return Results.Json(new { error = "wait" }, statusCode: StatusCodes.Status429TooManyRequests);
            var transfer = invites.Consume(body.Transfer);
            var target = transfer?.DeviceId is { } did ? devices.All().FirstOrDefault(d => d.Id == did) : null;
            if (transfer?.DeviceId is null || target is null)
            {
                throttle.Fail(ip);
                Security.Log(Idioma.T($"Transferência inválida de {ip}", $"Invalid transfer from {ip}"));
                return Results.Json(new { error = "invite" }, statusCode: StatusCodes.Status403Forbidden);
            }
            var extra = devices.AddToken(target.Id)!;
            Console.WriteLine(Idioma.T($"  Aparelho passou a usar o endereço {ctx.Request.Host.Host}: {target.Name} ({ip})", $"  Device moved to the address {ctx.Request.Host.Host}: {target.Name} ({ip})"));
            return Results.Ok(new { token = extra, deviceId = target.Id, deviceName = target.Name, transferred = true });
        }
        if (!loopback)
        {
            if (throttle.Blocked(ip)) return Results.Json(new { error = "wait" }, statusCode: StatusCodes.Status429TooManyRequests);
            var invite = invites.Consume(body.Invite);
            if (invite is null)
            {
                throttle.Fail(ip);
                Security.Log(Idioma.T($"Convite inválido de {ip}", $"Invalid invite from {ip}"));
                return Results.Json(new { error = "invite" }, statusCode: StatusCodes.Status403Forbidden);
            }
            if (invite.DeviceId is not null)
            {
                throttle.Fail(ip);
                return Results.Json(new { error = "invite" }, statusCode: StatusCodes.Status403Forbidden);
            }
            admin = invite.Admin;
            vaults = invite.Vaults;
        }
        // Aparelho já conectado que leu um convite novo: troca o acesso dele em vez de criar outro aparelho.
        var existing = DeviceOf(ctx);
        if (existing is { ReadOnly: true }) return Results.StatusCode(StatusCodes.Status403Forbidden);
        if (existing is not null)
        {
            var updated = loopback ? existing : devices.Update(existing.Id, admin, admin ? null : vaults)!;
            Console.WriteLine(Idioma.T($"  Acesso atualizado por convite: {updated.Name} ({ip})", $"  Access updated by invite: {updated.Name} ({ip})"));
            return Results.Ok(new { token = (string?)null, deviceId = updated.Id, deviceName = updated.Name, updated = true });
        }
        var name = ConfigStore.CleanName(body.DeviceName, "Aparelho");
        var (token, device) = devices.Add(name, admin, vaults);
        Console.WriteLine(Idioma.T($"  Aparelho conectado: {device.Name} ({ip})", $"  Device connected: {device.Name} ({ip})"));
        return Results.Ok(new { token, deviceId = device.Id, deviceName = device.Name });
    });

    // Convite para o próprio aparelho abrir o Cube4Notes por outro endereço (o nome do computador), sem novo QR.
    app.MapPost("/api/transfer", (HttpContext ctx) =>
    {
        var device = (Device)ctx.Items["device"]!;
        var invite = invites.Create(device.Admin, device.Vaults ?? [], device.Id);
        return Results.Ok(new { invite = invite.Long, expires = invite.Expires });
    });

    // ------------------------------------------------------------ assistente de primeira execução
    app.MapGet("/api/setup/browse", (HttpContext ctx, string? path, string? code) =>
    {
        if (!setup) return Results.NotFound();
        if (!SetupAllowed(ctx, code)) return Results.StatusCode(StatusCodes.Status403Forbidden);
        return Browse(path);
    });

    app.MapPost("/api/setup", (HttpContext ctx, SetupRequest body) =>
    {
        if (!setup) return Results.Conflict(new { error = "already-set-up" });
        if (!SetupAllowed(ctx, body.Code)) return Results.Json(new { error = "wrong-code" }, statusCode: StatusCodes.Status403Forbidden);
        var fresh = new AppConfig
        {
            Name = ConfigStore.CleanName(body.ServerName, Environment.MachineName),
            Mode = body.Mode == "pessoal" ? "pessoal" : "rede",
            Port = port,
        };
        var problem = ConfigStore.ValidateVaultPath(body.VaultPath, fresh);
        if (problem is not null) return Results.BadRequest(new { error = problem });
        var vaultName = ConfigStore.CleanName(body.VaultName, ConfigStore.DefaultVaultName);
        var id = ConfigStore.NewVaultId(vaultName, []);
        fresh.Vaults.Add(new VaultConfig(id, vaultName, Path.GetFullPath(body.VaultPath!)));
        Directory.CreateDirectory(fresh.Vaults[0].Path);
        ConfigStore.Save(fresh);
        var (token, device) = devices.Add(ConfigStore.CleanName(body.DeviceName, "Administrador"), true, []);
        Console.WriteLine(Idioma.T($"  Configuração concluída. Administrador: {device.Name}", $"  Setup complete. Administrator: {device.Name}"));
        var host = IsLoopback(ctx) ? "localhost" : ctx.Request.Host.Host;
        var nextUrl = fresh.Mode == "pessoal" ? $"http://localhost:{port}/" : $"https://{host}:{port}/";
        restart = true;
        _ = Task.Run(async () => { await Task.Delay(600); app.Lifetime.StopApplication(); });
        return Results.Ok(new { token, deviceId = device.Id, deviceName = device.Name, next = nextUrl });
    });

    // ------------------------------------------------------------ vaults
    app.MapGet("/api/vaults", (HttpContext ctx) =>
    {
        var device = (Device)ctx.Items["device"]!;
        var admin = (bool)ctx.Items["admin"]!;
        var list = registry.All().Where(v => admin || device.CanAccess(v.Id))
            .OrderBy(v => v.Name, StringComparer.CurrentCultureIgnoreCase)
            .Select(v => new { id = v.Id, name = v.Name, legacy = v.Id == config?.LegacyVault, path = admin ? v.Root : null });
        return Results.Ok(new { vaults = list });
    });

    app.MapGet("/api/v/{vault}/manifest", (HttpContext ctx) =>
    {
        var vault = (Vault)ctx.Items["vault"]!;
        var folders = new List<string>();
        var files = new List<ManifestFile>();
        var attachments = new List<ManifestAttachment>();
        vault.Walk(vault.Root, "", folders, files, attachments);
        return Results.Ok(new { folders, files, attachments });
    });

    app.MapPost("/api/v/{vault}/fetch", (HttpContext ctx, FetchRequest body) =>
    {
        var vault = (Vault)ctx.Items["vault"]!;
        if ((body.Paths?.Count ?? 0) > 500) return Results.BadRequest(new { error = "too many paths" });
        var list = new List<FileContent>();
        foreach (var rel in body.Paths ?? [])
        {
            var full = NotePaths.Resolve(vault.Root, rel, markdown: true);
            if (full is null || !File.Exists(full)) continue;
            var content = File.ReadAllText(full);
            list.Add(new FileContent(rel, content, Vault.Version(content)));
        }
        return Results.Ok(new { files = list });
    });

    app.MapGet("/api/v/{vault}/raw", (HttpContext ctx, string? path) =>
    {
        var vault = (Vault)ctx.Items["vault"]!;
        var full = NotePaths.Resolve(vault.Root, path ?? "", markdown: false);
        if (full is null || !File.Exists(full)) return Results.NotFound();
        ctx.Response.Headers["Content-Security-Policy"] = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox";
        var ext = Path.GetExtension(full).ToLowerInvariant();
        if (Security.InlineTypes.TryGetValue(ext, out var type)) return Results.File(full, type);
        return Results.File(full, "application/octet-stream", Path.GetFileName(full));
    });

    app.MapPost("/api/v/{vault}/sync", async (HttpContext ctx, SyncRequest body) =>
    {
        var vault = (Vault)ctx.Items["vault"]!;
        var device = (Device)ctx.Items["device"]!;
        if ((body.Ops?.Count ?? 0) > 500) return Results.BadRequest(new { error = "too many ops" });
        var results = new List<OpResult>();
        await vault.Gate.WaitAsync();
        try
        {
            foreach (var op in body.Ops ?? [])
            {
                try { results.Add(vault.Apply(op, device.Name)); }
                catch (Exception ex)
                {
                    Console.WriteLine(Idioma.T($"  Erro ao aplicar {op.Type} {op.Path ?? op.From} em {vault.Name}: {ex.Message}", $"  Error applying {op.Type} {op.Path ?? op.From} in {vault.Name}: {ex.Message}"));
                    results.Add(new OpResult(op.Id, "error", Message: "server error"));
                }
            }
        }
        finally { vault.Gate.Release(); }
        return Results.Ok(new { results });
    });

    // Histórico de versões de uma nota (mais recente primeiro) e o texto de uma versão.
    app.MapGet("/api/v/{vault}/history", (HttpContext ctx, string? path) =>
    {
        var vault = (Vault)ctx.Items["vault"]!;
        var full = NotePaths.Resolve(vault.Root, path, markdown: true);
        if (full is null) return Results.BadRequest(new { error = "invalid path" });
        var versions = vault.History.List(vault.Rel(full)).Select(v => new { id = v.Id, at = v.At, size = v.Size });
        return Results.Ok(new { versions });
    });

    app.MapGet("/api/v/{vault}/history/version", (HttpContext ctx, string? path, string? id) =>
    {
        var vault = (Vault)ctx.Items["vault"]!;
        var full = NotePaths.Resolve(vault.Root, path, markdown: true);
        if (full is null || string.IsNullOrEmpty(id)) return Results.BadRequest(new { error = "invalid path" });
        var content = vault.History.Read(vault.Rel(full), id);
        return content is null ? Results.NotFound() : Results.Ok(new { id, content });
    });

    // Anexo: "path" é o caminho escolhido pelo aparelho (anexo colado offline); "name" deixa o servidor escolher em anexos/.
    // Se já existe outro arquivo com o mesmo nome, este ganha um sufixo e o caminho final volta na resposta.
    app.MapPost("/api/v/{vault}/attachment", async (HttpContext ctx, string? name, string? path) =>
    {
        var vault = (Vault)ctx.Items["vault"]!;
        var request = ctx.Request;
        string folder, clean;
        if (!string.IsNullOrEmpty(path))
        {
            var full = NotePaths.Resolve(vault.Root, path, markdown: false);
            if (full is null || NotePaths.Same(full, vault.Root)) return Results.BadRequest(new { error = "invalid path" });
            folder = Path.GetDirectoryName(full)!;
            clean = Path.GetFileName(full);
        }
        else
        {
            folder = Path.Combine(vault.Root, "anexos");
            clean = NotePaths.SafeFileName(string.IsNullOrWhiteSpace(name) ? "imagem.png" : name);
        }
        var ext = Path.GetExtension(clean).ToLowerInvariant();
        if (!Security.UploadTypes.Contains(ext)) return Results.StatusCode(StatusCodes.Status415UnsupportedMediaType);
        if (request.ContentLength is > Security.MaxUpload) return Results.StatusCode(StatusCodes.Status413PayloadTooLarge);
        Directory.CreateDirectory(folder);
        var stem = Path.GetFileNameWithoutExtension(clean);
        var target = Path.Combine(folder, clean);
        var temp = Path.Combine(folder, "." + Guid.NewGuid().ToString("N")[..8] + ".upload");
        long total = 0;
        await using (var file = File.Create(temp))
        {
            var buffer = new byte[81920];
            int read;
            while ((read = await request.Body.ReadAsync(buffer)) > 0)
            {
                total += read;
                if (total > Security.MaxUpload) break;
                await file.WriteAsync(buffer.AsMemory(0, read));
            }
        }
        if (total > Security.MaxUpload || total == 0)
        {
            File.Delete(temp);
            return Results.StatusCode(total == 0 ? StatusCodes.Status400BadRequest : StatusCodes.Status413PayloadTooLarge);
        }
        await vault.Gate.WaitAsync();
        try
        {
            // mesmo arquivo enviado de novo (a resposta anterior se perdeu): não duplica
            if (File.Exists(target) && SameBytes(temp, target)) { File.Delete(temp); }
            else
            {
                for (var i = 2; File.Exists(target); i++) target = Path.Combine(folder, $"{stem}-{i}{ext}");
                File.Move(temp, target);
            }
        }
        finally { vault.Gate.Release(); }
        var relative = Path.GetRelativePath(vault.Root, target).Replace('\\', '/');
        return Results.Ok(new { path = relative });
    });

    // ------------------------------------------------------------ administração (aparelho administrador ou o próprio computador)
    app.MapGet("/api/admin/browse", (string? path) => Browse(path));

    app.MapPost("/api/admin/vaults", (VaultRequest body) =>
    {
        var current = ConfigStore.Load()!;
        var problem = ConfigStore.ValidateVaultPath(body.Path, current);
        if (problem is not null) return Results.BadRequest(new { error = problem });
        var name = ConfigStore.CleanName(body.Name, ConfigStore.DefaultVaultName);
        var id = ConfigStore.NewVaultId(name, current.Vaults.Select(v => v.Id));
        var full = Path.GetFullPath(body.Path!);
        Directory.CreateDirectory(full);
        current.Vaults.Add(new VaultConfig(id, name, full));
        ConfigStore.Save(current);
        config = current;
        registry.Load(current);
        Console.WriteLine(Idioma.T($"  Vault criado: {name} ({full})", $"  Vault created: {name} ({full})"));
        return Results.Ok(new { id, name, path = full });
    });

    app.MapPatch("/api/admin/vaults/{id}", (string id, VaultRequest body) =>
    {
        var current = ConfigStore.Load()!;
        var i = current.Vaults.FindIndex(v => v.Id == id);
        if (i < 0) return Results.NotFound();
        current.Vaults[i] = current.Vaults[i] with { Name = ConfigStore.CleanName(body.Name, current.Vaults[i].Name) };
        ConfigStore.Save(current);
        config = current;
        registry.Load(current);
        return Results.Ok(new { id, name = current.Vaults[i].Name });
    });

    // Tira o vault do Cube4Notes; a pasta e as notas continuam no disco.
    app.MapDelete("/api/admin/vaults/{id}", (string id) =>
    {
        var current = ConfigStore.Load()!;
        var vault = current.Vaults.FirstOrDefault(v => v.Id == id);
        if (vault is null) return Results.NotFound();
        if (current.Vaults.Count == 1) return Results.BadRequest(new { error = "last-vault" });
        current.Vaults.Remove(vault);
        ConfigStore.Save(current);
        config = current;
        registry.Load(current);
        devices.ForgetVault(id);
        Console.WriteLine(Idioma.T($"  Vault removido da lista: {vault.Name} (a pasta {vault.Path} não foi apagada)", $"  Vault removed from the list: {vault.Name} (the folder {vault.Path} was not deleted)"));
        return Results.Ok(new { removed = id });
    });

    app.MapPost("/api/admin/invite", (HttpContext ctx, InviteRequest body) =>
    {
        var known = registry.All().Select(v => v.Id).ToHashSet();
        var vaults = (body.Vaults ?? known.ToList()).Where(known.Contains).Distinct().ToList();
        var invite = invites.Create(body.Admin == true, vaults);
        var addresses = Lan.Addresses().Select(a => new { address = a.Address.ToString(), url = $"{scheme}://{a.Address}:{port}/#convite={invite.Long}", primary = a.Primary, name = a.Interface });
        return Results.Ok(new { expires = invite.Expires, shortCode = invite.Short, addresses, personal });
    });

    app.MapGet("/api/admin/devices", (HttpContext ctx) =>
    {
        var me = (Device)ctx.Items["device"]!;
        return Results.Ok(new
        {
            devices = devices.All().Select(d => new { id = d.Id, name = d.Name, created = d.Created, lastSeen = devices.LastSeen(d.Id), current = d.Id == me.Id, admin = d.Admin, vaults = d.Vaults, agent = d.ReadOnly }),
        });
    });

    // Agente de IA: token somente leitura para os vaults escolhidos (mostrado uma vez).
    app.MapPost("/api/admin/agents", (AgentRequest body) =>
    {
        var known = registry.All().Select(v => v.Id).ToHashSet();
        var vaults = (body.Vaults ?? []).Where(known.Contains).Distinct().ToList();
        if (vaults.Count == 0) return Results.BadRequest(new { error = "pick-vault" });
        var (token, agent) = devices.Add(ConfigStore.CleanName(body.Name, "Agente"), false, vaults, readOnly: true);
        Console.WriteLine(Idioma.T($"  Agente criado: {agent.Name} (somente leitura: {string.Join(", ", vaults)})", $"  Agent created: {agent.Name} (read only: {string.Join(", ", vaults)})"));
        var addresses = Lan.Addresses().Where(a => a.Primary).Select(a => $"{scheme}://{a.Address}:{port}/mcp").ToList();
        return Results.Ok(new { id = agent.Id, name = agent.Name, token, local = $"http://localhost:{(useHttps ? port - 1 : port)}/mcp", network = personal ? new List<string>() : addresses, https = useHttps });
    });

    app.MapPatch("/api/admin/devices/{id}", (string id, DeviceRequest body) =>
    {
        var known = registry.All().Select(v => v.Id).ToHashSet();
        var updated = devices.Update(id, body.Admin, body.Vaults?.Where(known.Contains).Distinct().ToList());
        return updated is null ? Results.NotFound() : Results.Ok(new { id, admin = updated.Admin, vaults = updated.Vaults });
    });

    app.MapDelete("/api/admin/devices/{id}", (string id) =>
    {
        var removed = devices.Remove(id);
        if (removed is null) return Results.NotFound();
        Console.WriteLine(Idioma.T($"  Aparelho removido: {removed.Name}", $"  Device removed: {removed.Name}"));
        return Results.Ok(new { removed = removed.Id });
    });

    // Encerrar o Cube4Notes (só do próprio computador): útil onde não há ícone na bandeja.
    app.MapPost("/api/admin/quit", (HttpContext ctx) =>
    {
        if (!IsLoopback(ctx)) return Results.StatusCode(StatusCodes.Status403Forbidden);
        Console.WriteLine(Idioma.T("  Encerrado pela interface.", "  Closed from the interface."));
        _ = Task.Run(async () => { await Task.Delay(400); app.Lifetime.StopApplication(); });
        return Results.Ok(new { quitting = true });
    });

    app.MapGet("/api/admin/server", () => Results.Ok(new { name = config!.Name, mode = config.Mode, port, configDir = ConfigStore.Dir }));

    app.MapPatch("/api/admin/server", (ServerRequest body) =>
    {
        var current = ConfigStore.Load()!;
        if (body.Name is not null) current.Name = ConfigStore.CleanName(body.Name, current.Name);
        var mode = body.Mode is "pessoal" or "rede" ? body.Mode! : current.Mode;
        var changedMode = mode != current.Mode;
        current.Mode = mode;
        ConfigStore.Save(current);
        config = current;
        if (changedMode)
        {
            restart = true;
            _ = Task.Run(async () => { await Task.Delay(600); app.Lifetime.StopApplication(); });
        }
        var nextUrl = mode == "pessoal" ? $"http://localhost:{port}/" : $"https://localhost:{port}/";
        return Results.Ok(new { name = current.Name, mode, restart = changedMode, next = nextUrl });
    });

    // ------------------------------------------------------------ início
    PrintBanner(config, setup, setupCode, personal, scheme, port, httpPort, useHttps);
    // Rede de casa: responde pelo nome do computador (<nome>.local), que continua valendo quando o IP muda.
    using var mdns = !personal && !setup && Tls.NetName.Length > 0 && !args.Contains("--sem-nome-na-rede") ? new Mdns(Tls.NetName) : null;
    if (mdns is not null && mdns.Start()) Console.WriteLine(Idioma.T($"  Pelo nome:        {scheme}://{mdns.Name}:{port}", $"  By name:          {scheme}://{mdns.Name}:{port}"));
    void OnNetworkChange(object? s, EventArgs e) { Lan.OnAddressesChanged(() => PrintAddresses(personal, scheme, port)); mdns?.Refresh(); }
    NetworkChange.NetworkAddressChanged += OnNetworkChange;
    if (useHttps && OperatingSystem.IsWindows() && !args.Contains("--sem-instalar-certificado")) Tls.TrustOnWindows();
    currentPersonal = personal;
    currentUrl = $"{scheme}://localhost:{port}/";
    stopServer = () => app.Lifetime.StopApplication();
    if (openBrowser)
        app.Lifetime.ApplicationStarted.Register(() => { if (windowMode) StartWindow(currentUrl); else OpenBrowser(currentUrl); });
    // Rede de casa no Windows: sem a regra de firewall, o celular não alcança o servidor.
    if (!personal && OperatingSystem.IsWindows() && !args.Contains("--sem-firewall"))
        app.Lifetime.ApplicationStarted.Register(() => _ = Task.Run(() => AllowFirewall(false)));
    try
    {
        await app.RunAsync();
    }
    catch (IOException ex) when (ex.InnerException is SocketException || ex.Message.Contains("address", StringComparison.OrdinalIgnoreCase))
    {
        Console.WriteLine(Idioma.T($"\nA porta {port} já está em uso. Feche a outra janela do Cube4Notes ou use --port 43200.", $"\nPort {port} is already in use. Close the other Cube4Notes window or use --port 43200."));
        return -1;
    }
    finally
    {
        NetworkChange.NetworkAddressChanged -= OnNetworkChange;
    }
    return restart ? 1 : 0;

    bool SetupAllowed(HttpContext ctx, string? code)
    {
        if (IsLoopback(ctx)) return true;
        var ip = Lan.Normalize(ctx.Connection.RemoteIpAddress!).ToString();
        if (throttle.Blocked(ip)) return false;
        var ok = !string.IsNullOrEmpty(code) && code.Length < 32
            && CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(new string(code.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant()), Encoding.ASCII.GetBytes(setupCode));
        if (!ok) { throttle.Fail(ip); Security.Log(Idioma.T($"Código de configuração inválido de {ip}", $"Invalid setup code from {ip}")); }
        return ok;
    }
}

// ================================================================ funções
Device? DeviceOf(HttpContext ctx)
{
    var auth = ctx.Request.Headers.Authorization.ToString();
    return auth.StartsWith("Bearer ", StringComparison.Ordinal) ? devices.Find(auth[7..]) : null;
}

// Muda quando a interface é atualizada: o navegador recarrega sozinho para não ficar com a versão velha em memória.
static string UiVersion()
{
    if (Interface.Embedded) return Interface.Version;
    var index = Path.Combine(AppContext.BaseDirectory, "wwwroot", "index.html");
    return File.Exists(index) ? File.GetLastWriteTimeUtc(index).Ticks.ToString("x") : "";
}

static bool SameBytes(string a, string b)
{
    if (new FileInfo(a).Length != new FileInfo(b).Length) return false;
    using var fa = File.OpenRead(a);
    using var fb = File.OpenRead(b);
    return SHA256.HashData(fa).AsSpan().SequenceEqual(SHA256.HashData(fb));
}

static bool IsLoopback(HttpContext ctx) => ctx.Connection.RemoteIpAddress is { } ip && IPAddress.IsLoopback(Lan.Normalize(ip));

// Lista só subpastas (nunca arquivos) para escolher a pasta de um vault.
static IResult Browse(string? path)
{
    var home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
    var docs = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
    var roots = OperatingSystem.IsWindows()
        ? DriveInfo.GetDrives().Where(d => d.IsReady && d.DriveType is DriveType.Fixed or DriveType.Removable).Select(d => d.RootDirectory.FullName).ToList()
        : ["/", home];
    var suggested = Path.Combine(string.IsNullOrEmpty(docs) ? home : docs, "Cube4Notes");
    string dir;
    try { dir = string.IsNullOrWhiteSpace(path) ? home : Path.GetFullPath(path); }
    catch (Exception) { return Results.BadRequest(new { error = "bad-path" }); }
    if (!Directory.Exists(dir)) return Results.Ok(new { path = dir, exists = false, parent = Path.GetDirectoryName(dir), entries = Array.Empty<object>(), roots, suggested });
    List<object> entries;
    try
    {
        entries = new DirectoryInfo(dir).EnumerateDirectories()
            .Where(d => !d.Name.StartsWith('.') && (d.Attributes & (FileAttributes.Hidden | FileAttributes.System)) == 0)
            .OrderBy(d => d.Name, StringComparer.CurrentCultureIgnoreCase)
            .Take(500)
            .Select(d => (object)new { name = d.Name, path = d.FullName })
            .ToList();
    }
    catch (UnauthorizedAccessException) { entries = []; }
    return Results.Ok(new { path = dir, exists = true, parent = Path.GetDirectoryName(dir), entries, roots, suggested });
}

static string NewSetupCode()
{
    const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return new string(Enumerable.Range(0, 6).Select(_ => alphabet[RandomNumberGenerator.GetInt32(alphabet.Length)]).ToArray());
}

static string? ArgValue(string[] args, string name)
{
    var i = Array.IndexOf(args, name);
    return i >= 0 && i + 1 < args.Length ? args[i + 1] : null;
}

static int ParsePort(string value)
{
    if (int.TryParse(value, out var v) && v is >= 1024 and <= 65535) return v;
    throw new ArgumentException("Use --port seguido de um número entre 1024 e 65535.");
}

static void PrintBanner(AppConfig? config, bool setup, string setupCode, bool personal, string scheme, int port, int httpPort, bool useHttps)
{
    Console.WriteLine();
    if (setup)
    {
        Console.WriteLine(Idioma.T("  Cube4Notes: primeira execução.", "  Cube4Notes: first run."));
        Console.WriteLine(Idioma.T($"  Neste computador, abra {scheme}://localhost:{port} para configurar.", $"  On this computer, open {scheme}://localhost:{port} to set it up."));
        if (!personal)
        {
            Console.WriteLine(Idioma.T("  De outro aparelho da rede (útil em servidor sem tela):", "  From another device on the network (useful on a server without a screen):"));
            PrintAddresses(personal, scheme, port);
            Console.WriteLine(Idioma.T($"  e digite o código de configuração: {setupCode}", $"  and type the setup code: {setupCode}"));
        }
        Console.WriteLine();
        return;
    }
    Console.WriteLine(Idioma.T($"  {config!.Name}: Cube4Notes está rodando.", $"  {config!.Name}: Cube4Notes is running."));
    foreach (var v in config.Vaults) Console.WriteLine($"  Vault \"{v.Name}\": {v.Path}");
    Console.WriteLine(Idioma.T($"  Configuração: {ConfigStore.Dir}", $"  Settings: {ConfigStore.Dir}"));
    Console.WriteLine(Idioma.T($"  Neste computador: {scheme}://localhost:{port}", $"  On this computer: {scheme}://localhost:{port}"));
    if (personal)
    {
        Console.WriteLine(Idioma.T("  Modo pessoal: só este computador acessa (nada fica exposto na rede).", "  Personal mode: only this computer has access (nothing is exposed on the network)."));
    }
    else
    {
        PrintAddresses(personal, scheme, port);
        Console.WriteLine();
        Console.WriteLine(Idioma.T("  Para conectar celular, iPad ou outro computador: abra o Cube4Notes num aparelho administrador,", "  To connect a phone, iPad or another computer: open Cube4Notes on an administrator device,"));
        Console.WriteLine(Idioma.T("  Preferências > Conectar aparelho, e aponte a câmera para o QR code.", "  Settings > Connect device, and point the camera at the QR code."));
        if (useHttps)
        {
            Console.WriteLine(Idioma.T($"  Conexão protegida por HTTPS com certificado próprio do Cube4Notes (impressão digital {Tls.CaThumbprint[..16]}...).", $"  Connection protected by HTTPS with Cube4Notes' own certificate (fingerprint {Tls.CaThumbprint[..16]}...)."));
            Console.WriteLine(Idioma.T($"  Certificado para instalar nos aparelhos: http://<endereço>:{httpPort}{Tls.CertPath}", $"  Certificate to install on devices: http://<address>:{httpPort}{Tls.CertPath}"));
        }
        Console.WriteLine(Idioma.T("  Acesso restrito à rede local.", "  Access limited to the local network."));
    }
    Console.WriteLine(Idioma.T("  Feche esta janela ou use Ctrl+C para encerrar.", "  Close this window or press Ctrl+C to stop."));
    Console.WriteLine();
}

static void PrintAddresses(bool personal, string scheme, int port)
{
    if (personal) return;
    var addresses = Lan.Addresses().ToList();
    if (addresses.Count == 0) Console.WriteLine(Idioma.T("  Nenhuma rede local ativa encontrada.", "  No active local network found."));
    foreach (var a in addresses.Where(a => a.Primary)) Console.WriteLine(Idioma.T($"  Na rede local:    {scheme}://{a.Address}:{port}   ({a.Interface})", $"  On the network:   {scheme}://{a.Address}:{port}   ({a.Interface})"));
    var others = addresses.Where(a => !a.Primary).Select(a => a.Address.ToString()).ToList();
    if (others.Count > 0) Console.WriteLine(Idioma.T($"  Também responde em (VPN/placas virtuais): {string.Join(", ", others)}", $"  Also answers on (VPN/virtual adapters): {string.Join(", ", others)}"));
}

static void OpenBrowser(string url)
{
    try
    {
        if (OperatingSystem.IsWindows()) Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
        else if (OperatingSystem.IsMacOS()) Process.Start("open", url);
        else if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("DISPLAY"))) Process.Start("xdg-open", url);
    }
    catch (Exception) { /* sem navegador disponível: o endereço já está no console */ }
}

// ================================================================ tipos da API
record PairRequest(string? Invite, string? DeviceName, string? Transfer = null);
record SetupRequest(string? Code, string? Mode, string? ServerName, string? VaultName, string? VaultPath, string? DeviceName);
record VaultRequest(string? Name, string? Path);
record InviteRequest(bool? Admin, List<string>? Vaults);
record DeviceRequest(bool? Admin, List<string>? Vaults);
record AgentRequest(string? Name, List<string>? Vaults);
record ServerRequest(string? Name, string? Mode);
record FetchRequest(List<string>? Paths);
record SyncRequest(List<SyncOp>? Ops);
record SyncOp(long? Id, string? Type, string? Path, string? Content, string? BaseVersion, string? From, string? To);
record OpResult(long? Id, string Status, string? Version = null, string? ConflictPath = null, string? ConflictVersion = null, string? Message = null, string? MovedTo = null);
record ManifestFile(string Path, string Version, DateTime Modified);
record ManifestAttachment(string Path, long Size, DateTime Modified);
record FileContent(string Path, string Content, string Version);
