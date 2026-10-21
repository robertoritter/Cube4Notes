/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * Aparelhos conectados (token guardado só como hash, administrador e vaults liberados), convites de uso
 * único para conectar aparelhos, registro de renomeações e bloqueio de tentativas repetidas.
 */
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

// Vaults == null: acesso a todos (aparelhos conectados antes dos vaults existirem).
// ReadOnly: agente de IA (só lê pelo /mcp, nunca administra nem escreve, sempre com lista de vaults).
record Device(string Id, string Name, string Hash, DateTime Created, bool Admin = false, List<string>? Vaults = null, bool ReadOnly = false)
{
    public bool CanAccess(string vaultId) => ReadOnly ? Vaults?.Contains(vaultId) == true : Admin || Vaults is null || Vaults.Contains(vaultId);
}

sealed class DeviceStore
{
    private readonly string file;
    private readonly object sync = new();
    private List<Device> list;
    private readonly Dictionary<string, DateTime> seen = new();
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true };

    public DeviceStore(string file)
    {
        this.file = file;
        try { list = File.Exists(file) ? JsonSerializer.Deserialize<List<Device>>(File.ReadAllText(file)) ?? [] : []; }
        catch (JsonException) { list = []; }
    }

    public Device? Find(string? token)
    {
        if (string.IsNullOrEmpty(token) || token.Length > 200) return null;
        var hash = Encoding.ASCII.GetBytes(Hash(token));
        lock (sync)
        {
            Device? found = null;
            foreach (var d in list)
                if (CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(d.Hash), hash)) found = d;
            if (found is not null) seen[found.Id] = DateTime.UtcNow;
            return found;
        }
    }

    public List<Device> All() { lock (sync) return list.ToList(); }

    public DateTime? LastSeen(string id) { lock (sync) return seen.TryGetValue(id, out var t) ? t : null; }

    public (string Token, Device Device) Add(string name, bool admin, List<string> vaults, bool readOnly = false)
    {
        var token = (readOnly ? "c4n_agente_" : "") + Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        var device = readOnly
            ? new Device(Guid.NewGuid().ToString(), name, Hash(token), DateTime.UtcNow, false, vaults, true)
            : new Device(Guid.NewGuid().ToString(), name, Hash(token), DateTime.UtcNow, admin, admin ? null : vaults);
        lock (sync)
        {
            list.Add(device);
            seen[device.Id] = DateTime.UtcNow;
            Save();
        }
        return (token, device);
    }

    public Device? Update(string id, bool? admin, List<string>? vaults)
    {
        lock (sync)
        {
            var i = list.FindIndex(x => x.Id == id);
            if (i < 0) return null;
            var d = list[i];
            var isAdmin = !d.ReadOnly && (admin ?? d.Admin); // agente nunca vira administrador
            d = d with { Admin = isAdmin, Vaults = isAdmin ? null : vaults ?? d.Vaults ?? [] };
            list[i] = d;
            Save();
            return d;
        }
    }

    // Tira um vault removido da lista de todos os aparelhos.
    public void ForgetVault(string vaultId)
    {
        lock (sync)
        {
            for (var i = 0; i < list.Count; i++)
                if (list[i].Vaults is { } v && v.Contains(vaultId)) list[i] = list[i] with { Vaults = v.Where(x => x != vaultId).ToList() };
            Save();
        }
    }

    public Device? Remove(string id)
    {
        lock (sync)
        {
            var d = list.FirstOrDefault(x => x.Id == id);
            if (d is null) return null;
            list.Remove(d);
            seen.Remove(id);
            Save();
            return d;
        }
    }

    private void Save()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(file)!);
        var temp = file + ".tmp";
        File.WriteAllText(temp, JsonSerializer.Serialize(list, Json));
        File.Move(temp, file, overwrite: true);
    }

    private static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();
}

// Convites de uso único, válidos por 5 minutos. Cada um tem um código longo (vai no QR), um código curto de
// 6 caracteres (para digitar) e o que o aparelho poderá acessar.
sealed record Invite(string Long, string Short, DateTime Expires, bool Admin, List<string> Vaults);

sealed class InviteStore
{
    private readonly object sync = new();
    private readonly List<Invite> active = new();
    private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O e 1/I
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(5);

    public Invite Create(bool admin, List<string> vaults)
    {
        var code = Convert.ToBase64String(RandomNumberGenerator.GetBytes(18)).Replace('+', '-').Replace('/', '_');
        var shortCode = new string(Enumerable.Range(0, 6).Select(_ => Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)]).ToArray());
        var invite = new Invite(code, shortCode, DateTime.UtcNow + Lifetime, admin, vaults);
        lock (sync)
        {
            Purge();
            while (active.Count >= 5) active.Remove(active.OrderBy(x => x.Expires).First());
            active.Add(invite);
        }
        return invite;
    }

    public Invite? Consume(string? code)
    {
        if (string.IsNullOrEmpty(code) || code.Length > 64) return null;
        var asShort = new string(code.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
        lock (sync)
        {
            Purge();
            Invite? match = null;
            foreach (var i in active)
                if (Same(i.Long, code) || (asShort.Length == 6 && Same(i.Short, asShort))) match = i;
            if (match is not null) active.Remove(match);
            return match;
        }
    }

    private static bool Same(string a, string b) => a.Length == b.Length && CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(a), Encoding.ASCII.GetBytes(b));

    private void Purge() => active.RemoveAll(x => x.Expires < DateTime.UtcNow);
}

record RenameEntry(string From, string To, bool Folder, DateTime At);

// Renomeações dos últimos 30 dias, para que edições feitas no nome antigo sigam para o nome novo.
sealed class RenameStore
{
    private readonly string file;
    private readonly object sync = new();
    private List<RenameEntry> list;

    public RenameStore(string file)
    {
        this.file = file;
        try { list = File.Exists(file) ? JsonSerializer.Deserialize<List<RenameEntry>>(File.ReadAllText(file)) ?? [] : []; }
        catch (JsonException) { list = []; }
    }

    public void Record(string from, string to, bool folder)
    {
        lock (sync)
        {
            list.RemoveAll(x => x.At < DateTime.UtcNow.AddDays(-30));
            list.Add(new RenameEntry(from, to, folder, DateTime.UtcNow));
            var temp = file + ".tmp";
            File.WriteAllText(temp, JsonSerializer.Serialize(list));
            File.Move(temp, file, overwrite: true);
        }
    }

    // Segue a cadeia de renomeações (até 10 passos); null se o caminho nunca foi renomeado.
    public string? Follow(string path)
    {
        lock (sync)
        {
            var current = path;
            for (var hop = 0; hop < 10; hop++)
            {
                string? next = null;
                for (var i = list.Count - 1; i >= 0 && next is null; i--)
                {
                    var r = list[i];
                    if (!r.Folder && r.From == current) next = r.To;
                    else if (r.Folder && current.StartsWith(r.From + "/", StringComparison.Ordinal)) next = r.To + current[r.From.Length..];
                }
                if (next is null) break;
                current = next;
            }
            return current == path ? null : current;
        }
    }
}

// Bloqueia por 10 minutos um endereço que errar convites 10 vezes.
sealed class FailureThrottle
{
    private readonly object sync = new();
    private readonly Dictionary<string, (int Count, DateTime Since)> failures = new();

    public bool Blocked(string ip)
    {
        lock (sync) return failures.TryGetValue(ip, out var f) && f.Count >= 10 && DateTime.UtcNow - f.Since < TimeSpan.FromMinutes(10);
    }

    public void Fail(string ip)
    {
        lock (sync)
        {
            var now = DateTime.UtcNow;
            failures[ip] = failures.TryGetValue(ip, out var f) && now - f.Since < TimeSpan.FromMinutes(10) ? (f.Count + 1, f.Since) : (1, now);
            if (failures[ip].Count == 10) Security.Log($"Muitas tentativas de pareamento de {ip}; bloqueado por 10 minutos");
        }
    }
}

