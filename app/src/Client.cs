/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * Modo cliente: este computador não guarda notas nem atende outros aparelhos; a janela abre o Cube4Notes
 * de outro computador (o servidor). Confere o endereço, baixa a autoridade certificadora do servidor e,
 * no Windows, pede ao sistema para confiar nela (a janela usa a confiança do sistema). Quando o servidor
 * não responde, a janela mostra uma página local: abrir a cópia offline, tentar de novo, trocar o
 * endereço ou voltar a ser servidor. A interface conversa com a janela por mensagens (Photino).
 */
using System.Net;
using System.Net.Security;
using System.Net.Sockets;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json;
using Photino.NET;

static class Client
{
    public const int DefaultPort = 43125;

    public sealed record Result(string? Url, string? Name, string? Error);

    // "192.168.0.10", "nome-notes.local:43125", "http://192.168.0.10:43124" ou "https://..." -> "https://host:porta/".
    public static string? Normalize(string? input)
    {
        var text = (input ?? "").Trim();
        if (text.Length == 0 || text.Length > 300) return null;
        if (!text.Contains("://", StringComparison.Ordinal)) text = "https://" + text;
        if (!Uri.TryCreate(text, UriKind.Absolute, out var uri)) return null;
        if (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp) return null;
        if (string.IsNullOrEmpty(uri.Host) || !string.IsNullOrEmpty(uri.UserInfo)) return null;
        var port = uri.IsDefaultPort ? DefaultPort : uri.Port;
        // a porta HTTP do Cube4Notes é sempre a de baixo da HTTPS
        if (uri.Scheme == Uri.UriSchemeHttp && !uri.IsDefaultPort) port = uri.Port + 1;
        if (port is < 1025 or > 65535) return null;
        return new UriBuilder(Uri.UriSchemeHttps, uri.Host, port, "/").Uri.ToString();
    }

    // Endereço deste próprio computador? (ser cliente de si mesmo não faz sentido)
    private static bool IsSelf(string host)
    {
        var h = host.Trim('[', ']').TrimEnd('.').ToLowerInvariant();
        if (h == "localhost") return true;
        if (Tls.Machine.Length > 0 && (h == Tls.Machine || h == Tls.Machine + ".local" || h == Tls.NetName)) return true;
        return IPAddress.TryParse(h, out var ip) && (IPAddress.IsLoopback(ip) || Lan.LanAddresses().Any(a => a.Equals(ip)));
    }

    // O servidor atende nesse endereço? (resposta rápida, só a conexão)
    public static bool Reachable(string url, int ms = 2000)
    {
        try
        {
            var uri = new Uri(url);
            using var tcp = new TcpClient();
            return tcp.ConnectAsync(uri.DnsSafeHost, uri.Port).Wait(ms) && tcp.Connected;
        }
        catch (Exception) { return false; }
    }

    // Confere se o endereço é um Cube4Notes configurado e confia no certificado dele. Erro vem como código estável.
    public static async Task<Result> Check(string? address)
    {
        var url = Normalize(address);
        if (url is null) return new(null, null, "bad-address");
        var uri = new Uri(url);
        if (IsSelf(uri.Host)) return new(url, null, "self-address");

        // Autoridade do servidor, servida em HTTP na porta de baixo (a mesma que celulares baixam para instalar)
        byte[] der;
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(6) };
            using var response = await http.GetAsync(new UriBuilder(Uri.UriSchemeHttp, uri.Host, uri.Port - 1, Tls.CertPath).Uri);
            if (!response.IsSuccessStatusCode) return new(url, null, "not-cube4notes");
            der = await response.Content.ReadAsByteArrayAsync();
        }
        catch (Exception) { return new(url, null, "unreachable"); }

        X509Certificate2 ca;
        try { ca = X509CertificateLoader.LoadCertificate(der); }
        catch (Exception) { return new(url, null, "not-cube4notes"); }
        using (ca)
        {
            string? name;
            try
            {
                using var handler = new HttpClientHandler { ServerCertificateCustomValidationCallback = (_, cert, _, errors) => SignedBy(ca, cert, errors) };
                using var http = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(6) };
                using var doc = JsonDocument.Parse(await http.GetStringAsync(new Uri(uri, "/api/status")));
                if (doc.RootElement.TryGetProperty("setup", out var setup) && setup.ValueKind == JsonValueKind.True) return new(url, null, "server-setup");
                name = doc.RootElement.TryGetProperty("name", out var n) ? n.GetString() : null;
            }
            catch (Exception) { return new(url, null, "not-cube4notes"); }
            try { File.WriteAllBytes(Path.Combine(ConfigStore.Dir, "server-ca.cer"), der); } catch (Exception) { }
            if (!Trust(ca)) return new(url, name, "not-trusted");
            return new(url, name, null);
        }
    }

    // Certificado do servidor assinado pela autoridade baixada e válido para o nome usado.
    private static bool SignedBy(X509Certificate2 ca, X509Certificate2? cert, SslPolicyErrors errors)
    {
        if (cert is null) return false;
        if ((errors & ~SslPolicyErrors.RemoteCertificateChainErrors) != SslPolicyErrors.None) return false;
        using var chain = new X509Chain();
        chain.ChainPolicy.TrustMode = X509ChainTrustMode.CustomRootTrust;
        chain.ChainPolicy.CustomTrustStore.Add(ca);
        chain.ChainPolicy.RevocationMode = X509RevocationMode.NoCheck;
        return chain.Build(cert);
    }

    // Windows: a janela (WebView2) usa a confiança do sistema, que pede confirmação na primeira vez.
    // macOS e Linux: a janela também usa a confiança do sistema; o arquivo fica salvo para instalar.
    private static bool Trust(X509Certificate2 ca)
    {
        var saved = Path.Combine(ConfigStore.Dir, "server-ca.cer");
        if (!OperatingSystem.IsWindows())
        {
            Console.WriteLine(Lang.T($"  Se a janela avisar sobre o certificado, instale {saved} como confiável neste sistema.", $"  If the window warns about the certificate, install {saved} as trusted on this system."));
            return true;
        }
        try
        {
            using var store = new X509Store(StoreName.Root, StoreLocation.CurrentUser);
            store.Open(OpenFlags.ReadWrite);
            if (store.Certificates.Find(X509FindType.FindByThumbprint, ca.Thumbprint, false).Count > 0) return true;
            Console.WriteLine(Lang.T("  O Windows vai pedir confirmação para confiar no certificado do servidor Cube4Notes. Clique em Sim.", "  Windows will ask to trust the Cube4Notes server certificate. Click Yes."));
            store.Add(ca);
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine(Lang.T($"  Certificado do servidor não instalado ({ex.Message}).", $"  Server certificate not installed ({ex.Message})."));
            return false;
        }
    }

    public static string ErrorText(string code) => code switch
    {
        "bad-address" => Lang.T("Endereço inválido.", "Invalid address."),
        "self-address" => Lang.T("Esse é o endereço deste próprio computador.", "That is the address of this computer."),
        "unreachable" => Lang.T("O servidor não respondeu. Confira o endereço e se o Cube4Notes está aberto nele.", "The server did not answer. Check the address and that Cube4Notes is running there."),
        "not-cube4notes" => Lang.T("Esse endereço não respondeu como um Cube4Notes. Use o endereço que aparece no servidor.", "That address did not answer as Cube4Notes. Use the address shown on the server."),
        "server-setup" => Lang.T("Esse Cube4Notes ainda não foi configurado. Termine a configuração nele primeiro.", "That Cube4Notes is not set up yet. Finish the setup there first."),
        "not-trusted" => Lang.T("O certificado do servidor não foi aceito.", "The server certificate was not accepted."),
        _ => Lang.T("Não foi possível conectar a esse servidor.", "Could not connect to that server."),
    };

    // ------------------------------------------------------------ janela no modo cliente
    // Mensagens da interface (window.external.sendMessage): client:info, client:open, client:retry,
    // client:server e "client:set\n<endereço>". Respostas em JSON: client-info e client-error.
    public static void Attach(PhotinoWindow window, string url)
    {
        window.RegisterWebMessageReceivedHandler((_, message) =>
        {
            var cut = message.IndexOf('\n');
            var command = cut >= 0 ? message[..cut] : message;
            var arg = cut >= 0 ? message[(cut + 1)..] : "";
            switch (command)
            {
                case "client:info":
                    Reply(window, new { type = "client-info", server = url });
                    break;
                case "client:open":
                    window.Load(new Uri(url));
                    break;
                case "client:retry":
                    _ = Task.Run(() =>
                    {
                        var ok = Reachable(url, 3000);
                        window.Invoke(() => { if (ok) window.Load(new Uri(url)); else Reply(window, new { type = "client-error", error = "unreachable" }); });
                    });
                    break;
                case "client:server":
                    ConfigStore.UseServer();
                    window.Close();
                    break;
                case "client:set":
                    _ = Task.Run(async () =>
                    {
                        var result = await Check(arg);
                        window.Invoke(() =>
                        {
                            if (result.Error is not null) { Reply(window, new { type = "client-error", error = result.Error }); return; }
                            // a janela fecha e o Cube4Notes abre outra no endereço novo
                            ConfigStore.SetClient(result.Url!);
                            window.Close();
                        });
                    });
                    break;
            }
        });
    }

    private static void Reply(PhotinoWindow window, object message)
    {
        try { window.SendWebMessage(JsonSerializer.Serialize(message)); } catch (Exception) { }
    }

    // Página local para quando o servidor não responde (sem ela, a janela ficaria numa página de erro sem saída).
    public static string OfflinePage(string url)
    {
        var e = (string s) => WebUtility.HtmlEncode(s);
        var errors = JsonSerializer.Serialize(new[] { "bad-address", "self-address", "unreachable", "not-cube4notes", "server-setup", "not-trusted", "" }
            .ToDictionary(c => c, ErrorText));
        return $$"""
<!doctype html>
<html lang="{{Lang.T("pt-BR", "en")}}"><head><meta charset="utf-8"><title>Cube4Notes</title>
<style>
:root { color-scheme: light dark; --bg: #f6f5f2; --card: #fff; --text: #1d1d1f; --muted: #6b6b70; --line: #dcdad4; --accent: #6d4aff; }
@media (prefers-color-scheme: dark) { :root { --bg: #17171a; --card: #202024; --text: #ececf0; --muted: #9a9aa2; --line: #34343a; } }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--text); font: 15px/1.5 system-ui, sans-serif; }
.card { width: min(460px, calc(100vw - 32px)); background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 28px; }
h1 { font-size: 20px; margin: 0 0 6px; } .brand { font-weight: 700; font-size: 18px; margin-bottom: 18px; } .brand b { color: #6d4aff; }
p { color: var(--muted); margin: 0 0 16px; } code { color: var(--text); word-break: break-all; }
button, input { font: inherit; border-radius: 10px; padding: 9px 14px; border: 1px solid var(--line); background: var(--bg); color: var(--text); }
button { cursor: pointer; } button.primary { background: var(--accent); border-color: var(--accent); color: #fff; width: 100%; margin-bottom: 8px; }
.row { display: flex; gap: 8px; margin-bottom: 8px; } .row > * { flex: 1; } input { width: 100%; }
#msg { color: #c0392b; min-height: 1.5em; margin: 8px 0 0; } hr { border: 0; border-top: 1px solid var(--line); margin: 18px 0; }
.link { background: none; border: 0; padding: 0; color: var(--accent); text-decoration: underline; }
</style></head><body><div class="card">
<div class="brand">Cube<b>4</b>Notes</div>
<h1>{{e(Lang.T("O servidor não respondeu", "The server did not answer"))}}</h1>
<p>{{e(Lang.T("Este computador abre o Cube4Notes de", "This computer opens Cube4Notes from"))}} <code>{{e(url)}}</code>. {{e(Lang.T("As notas já sincronizadas abrem offline e as mudanças sobem quando o servidor voltar.", "Notes already synced open offline, and changes are sent when the server is back."))}}</p>
<button class="primary" onclick="send('client:open')">{{e(Lang.T("Abrir offline", "Open offline"))}}</button>
<div class="row"><button onclick="busy();send('client:retry')">{{e(Lang.T("Tentar de novo", "Try again"))}}</button></div>
<hr>
<label for="addr">{{e(Lang.T("Outro endereço do servidor", "Another server address"))}}</label>
<div class="row" style="margin-top:6px"><input id="addr" value="{{e(new Uri(url).Authority)}}" autocomplete="off"><button style="flex:0 0 auto" onclick="busy();send('client:set\n'+document.getElementById('addr').value)">{{e(Lang.T("Conectar", "Connect"))}}</button></div>
<p id="msg" role="alert"></p>
<button class="link" onclick="if(confirm({{e(JsonSerializer.Serialize(Lang.T("Usar este computador como servidor? A janela fecha e o Cube4Notes abre com os vaults deste computador.", "Use this computer as the server? The window closes and Cube4Notes opens with this computer's vaults.")))}}))send('client:server')">{{e(Lang.T("Usar este computador como servidor", "Use this computer as the server"))}}</button>
</div>
<script>
const errors = {{errors}};
const msg = document.getElementById('msg');
function send(m) { try { window.external.sendMessage(m); } catch (e) { msg.textContent = String(e); } }
function busy() { msg.textContent = {{JsonSerializer.Serialize(Lang.T("Conferindo…", "Checking…"))}}; }
try { window.external.receiveMessage(m => { try { const d = JSON.parse(m); if (d.type === 'client-error') msg.textContent = errors[d.error] || errors['']; } catch {} }); } catch {}
</script></body></html>
""";
    }
}
