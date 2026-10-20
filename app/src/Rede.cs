/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * Segurança de rede do Cube4Notes: cabeçalhos e política de conteúdo, nomes de host aceitos,
 * verificação de origem, validação de caminhos dentro dos vaults e detecção da rede local.
 */
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;
using Microsoft.AspNetCore.Http;

static class Security
{
    public const long MaxUpload = 25L * 1024 * 1024;

    // Interface sem scripts de terceiros; imagens externas permitidas nas notas.
    public const string Csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

    public static readonly HashSet<string> UploadTypes = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp", ".pdf"];

    public static readonly Dictionary<string, string> InlineTypes = new()
    {
        [".png"] = "image/png", [".jpg"] = "image/jpeg", [".jpeg"] = "image/jpeg", [".gif"] = "image/gif",
        [".webp"] = "image/webp", [".avif"] = "image/avif", [".bmp"] = "image/bmp", [".pdf"] = "application/pdf",
    };

    public static bool HostAllowed(string host)
    {
        if (string.IsNullOrEmpty(host)) return false;
        host = host.Trim('[', ']').TrimEnd('.').ToLowerInvariant();
        if (host is "localhost" or "127.0.0.1" or "::1") return true;
        var machine = Tls.Machine;
        if (machine.Length > 0 && (host == machine || host == machine + ".local")) return true;
        return IPAddress.TryParse(host, out var ip) && Lan.Addresses().Any(a => a.Address.Equals(ip));
    }

    public static bool SameOrigin(HttpRequest request)
    {
        var origin = request.Headers.Origin.ToString();
        if (string.IsNullOrEmpty(origin)) return !request.Headers.ContainsKey("Sec-Fetch-Site") || request.Headers["Sec-Fetch-Site"] == "same-origin" || request.Headers["Sec-Fetch-Site"] == "none";
        return Uri.TryCreate(origin, UriKind.Absolute, out var o) && string.Equals(o.Authority, request.Host.Value, StringComparison.OrdinalIgnoreCase);
    }

    public static string CleanName(string? name)
    {
        var clean = new string((name ?? "").Where(c => !char.IsControl(c) && c is not '<' and not '>').ToArray()).Trim();
        if (clean.Length == 0) clean = "Aparelho";
        return clean.Length > 60 ? clean[..60] : clean;
    }

    private static DateTime lastLog = DateTime.MinValue;
    private static int burst;
    public static void Log(string message)
    {
        // evita inundar o console num ataque
        var now = DateTime.UtcNow;
        if (now - lastLog > TimeSpan.FromSeconds(10)) burst = 0;
        lastLog = now;
        if (++burst <= 5) Console.WriteLine($"  [segurança] {DateTime.Now:HH:mm:ss} {message}");
    }
}

static class NotePaths
{
    private static readonly StringComparison Cmp = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;

    public static bool Same(string a, string b) => string.Equals(a, b, Cmp);

    // Caracteres proibidos no Windows valem em todos os sistemas, para as notas continuarem portáveis.
    private static readonly char[] Invalid = Path.GetInvalidFileNameChars().Concat(['<', '>', ':', '"', '|', '?', '*', '\\', '/']).Concat(Enumerable.Range(0, 32).Select(i => (char)i)).Distinct().ToArray();

    private static bool Reserved(string part)
    {
        var stem = part.Split('.')[0].TrimEnd().ToUpperInvariant();
        return stem is "CON" or "PRN" or "AUX" or "NUL" or "CONIN$" or "CONOUT$"
            || (stem.Length == 4 && (stem.StartsWith("COM") || stem.StartsWith("LPT")) && char.IsAsciiDigit(stem[3]));
    }

    // Converte um caminho relativo vindo do navegador num caminho dentro da pasta de notas, ou null se for inválido.
    public static string? Resolve(string root, string? relative, bool markdown)
    {
        if (relative is null) return null;
        if (relative.Length == 0) return markdown ? null : root;
        if (markdown && !relative.EndsWith(".md", StringComparison.OrdinalIgnoreCase)) return null;
        if (Path.IsPathRooted(relative) || relative.StartsWith('/') || relative.StartsWith('\\')) return null;
        var parts = relative.Replace('\\', '/').Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0) return markdown ? null : root;
        if (relative.Length > 400 || parts.Length > 32) return null;
        foreach (var p in parts)
            if (p is "." or ".." || p.StartsWith('.') || p.Length > 200 || p.IndexOfAny(Invalid) >= 0 || p.EndsWith(' ') || p.EndsWith('.') || Reserved(p))
                return null;
        var full = Path.GetFullPath(Path.Combine(root, Path.Combine(parts)));
        if (!full.StartsWith(root + Path.DirectorySeparatorChar, Cmp)) return null;
        for (var current = Path.GetDirectoryName(full); current is not null && current.Length > root.Length; current = Path.GetDirectoryName(current))
            if (Directory.Exists(current) && (File.GetAttributes(current) & FileAttributes.ReparsePoint) != 0) return null;
        if ((File.Exists(full) || Directory.Exists(full)) && (File.GetAttributes(full) & FileAttributes.ReparsePoint) != 0) return null;
        return full;
    }

    public static string SafeFileName(string name)
    {
        var clean = new string(Path.GetFileName(name.Replace('\\', '/')).Select(c => Invalid.Contains(c) ? '-' : c).ToArray()).Trim().TrimStart('.').TrimEnd('.', ' ');
        if (clean.Length > 120) clean = clean[^120..];
        if (clean.Length == 0 || Reserved(clean)) clean = "anexo" + Path.GetExtension(clean);
        return clean;
    }
}

static class Lan
{
    private static readonly object Sync = new();
    private static string lastSet = "";

    public static IPAddress Normalize(IPAddress a) => a.IsIPv4MappedToIPv6 ? a.MapToIPv4() : a;

    public record LanAddress(IPAddress Address, string Interface, bool Primary);

    // Endereços privados do computador; "Primary" = placa física (Wi-Fi/Ethernet), não VPN nem máquina virtual.
    public static IEnumerable<LanAddress> Addresses()
    {
        var list = new List<LanAddress>();
        foreach (var nic in NetworkInterface.GetAllNetworkInterfaces().Where(x => x.OperationalStatus == OperationalStatus.Up))
        {
            var text = (nic.Name + " " + nic.Description).ToLowerInvariant();
            var virtualNic = nic.NetworkInterfaceType is NetworkInterfaceType.Tunnel or NetworkInterfaceType.Ppp or NetworkInterfaceType.Loopback
                || new[] { "virtual", "vmware", "virtualbox", "vbox", "hyper-v", "vethernet", "wireguard", "wg", "vpn", "tap", "tun", "docker", "wsl", "zerotier", "tailscale", "hamachi" }.Any(k => text.Contains(k));
            foreach (var u in nic.GetIPProperties().UnicastAddresses)
                if (u.Address.AddressFamily == AddressFamily.InterNetwork && IsPrivate(u.Address))
                    list.Add(new LanAddress(u.Address, nic.Name, !virtualNic));
        }
        return list.GroupBy(x => x.Address).Select(g => g.First()).OrderByDescending(x => x.Primary).ThenBy(x => x.Address.ToString());
    }

    public static IEnumerable<IPAddress> LanAddresses() => Addresses().Select(x => x.Address);

    private static IEnumerable<UnicastIPAddressInformation> Unicast() => NetworkInterface.GetAllNetworkInterfaces()
        .Where(x => x.OperationalStatus == OperationalStatus.Up)
        .SelectMany(x => x.GetIPProperties().UnicastAddresses)
        .Where(x => x.Address.AddressFamily == AddressFamily.InterNetwork);

    public static bool IsPrivate(IPAddress address)
    {
        var b = address.GetAddressBytes();
        return b.Length == 4 && (b[0] == 10 || (b[0] == 172 && b[1] is >= 16 and <= 31) || (b[0] == 192 && b[1] == 168));
    }

    // Aceita o próprio computador e aparelhos na mesma sub-rede privada de uma interface ativa.
    public static bool IsLocalClient(IPAddress address)
    {
        address = Normalize(address);
        if (IPAddress.IsLoopback(address)) return true;
        if (address.AddressFamily != AddressFamily.InterNetwork || !IsPrivate(address)) return false;
        var remote = address.GetAddressBytes();
        foreach (var nic in Unicast())
        {
            if (!IsPrivate(nic.Address) || nic.IPv4Mask is null) continue;
            var local = nic.Address.GetAddressBytes();
            var mask = nic.IPv4Mask.GetAddressBytes();
            var same = true;
            for (var i = 0; i < 4; i++) if ((local[i] & mask[i]) != (remote[i] & mask[i])) { same = false; break; }
            if (same) return true;
        }
        return false;
    }

    public static void OnAddressesChanged(Action print)
    {
        var now = string.Join(',', LanAddresses());
        lock (Sync)
        {
            if (now == lastSet) return;
            lastSet = now;
        }
        Console.WriteLine("\n  A rede mudou. Endereços atuais:");
        print();
    }
}
