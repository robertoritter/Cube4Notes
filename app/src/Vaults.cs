/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * Vault: uma pasta de notas Markdown. Aplica as alterações enviadas pelos aparelhos (criar, editar, mover,
 * apagar) sem nunca descartar texto: conflito vira cópia, exclusão vai para a .lixeira e edição feita no
 * nome antigo de uma nota renomeada segue para o nome novo. O texto substituído vai para o histórico de versões.
 */
using System.Security.Cryptography;
using System.Text;

sealed class Vault
{
    public string Id { get; }
    public string Name { get; }
    public string Root { get; }
    public RenameStore Renames { get; }
    public History History { get; }
    public SemaphoreSlim Gate { get; } = new(1, 1);

    public Vault(VaultConfig config)
    {
        Id = config.Id;
        Name = config.Name;
        Root = System.IO.Path.GetFullPath(config.Path).TrimEnd(System.IO.Path.DirectorySeparatorChar, System.IO.Path.AltDirectorySeparatorChar);
        Directory.CreateDirectory(Root);
        var state = System.IO.Path.Combine(Root, ".cube4notes");
        Directory.CreateDirectory(state);
        Renames = new RenameStore(System.IO.Path.Combine(state, "renames.json"));
        History = new History(state);
    }

    public static void WriteAtomic(string full, string content)
    {
        Directory.CreateDirectory(System.IO.Path.GetDirectoryName(full)!);
        var temp = full + "." + Guid.NewGuid().ToString("N")[..8] + ".tmp";
        File.WriteAllText(temp, content, new UTF8Encoding(false));
        File.Move(temp, full, overwrite: true);
    }

    // Caminho relativo normalizado (com /) de um arquivo do vault.
    public string Rel(string full) => System.IO.Path.GetRelativePath(Root, full).Replace('\\', '/');

    public static string Version(string content) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(content))).ToLowerInvariant();

    public OpResult Apply(SyncOp op, string deviceName)
    {
        switch (op.Type)
        {
            case "put":
            {
                var full = NotePaths.Resolve(Root, op.Path, markdown: true);
                if (full is null) return new OpResult(op.Id, "error", Message: "invalid path");
                var content = op.Content ?? "";
                if (content.Length > 10_000_000) return new OpResult(op.Id, "error", Message: "too large");
                if (!File.Exists(full))
                {
                    // Nome antigo de uma nota renomeada em outro aparelho: a edição vai para o nome novo (sem duplicar).
                    var moved = op.BaseVersion is null ? null : Renames.Follow(op.Path!);
                    var movedFull = moved is null ? null : NotePaths.Resolve(Root, moved, markdown: true);
                    if (moved is not null && movedFull is not null && File.Exists(movedFull))
                    {
                        var movedCurrent = File.ReadAllText(movedFull);
                        if (movedCurrent == content) return new OpResult(op.Id, "applied", Version(movedCurrent), MovedTo: moved);
                        if (op.BaseVersion == Version(movedCurrent))
                        {
                            History.Save(Rel(movedFull), movedCurrent);
                            WriteAtomic(movedFull, content);
                            return new OpResult(op.Id, "applied", Version(content), MovedTo: moved);
                        }
                        var movedCopy = ConflictPath(moved, deviceName);
                        WriteAtomic(NotePaths.Resolve(Root, movedCopy, markdown: true)!, content);
                        Console.WriteLine($"  Conflito em {moved}: cópia salva como {movedCopy}");
                        return new OpResult(op.Id, "conflict", Version(movedCurrent), movedCopy, Version(content), MovedTo: moved);
                    }
                    // nova nota, ou nota apagada em outro lugar: a versão deste aparelho é mantida
                    WriteAtomic(full, content);
                    return new OpResult(op.Id, "applied", Version(content));
                }
                var current = File.ReadAllText(full);
                if (current == content) return new OpResult(op.Id, "applied", Version(current));
                if (op.BaseVersion is not null && op.BaseVersion == Version(current))
                {
                    History.Save(Rel(full), current);
                    WriteAtomic(full, content);
                    return new OpResult(op.Id, "applied", Version(content));
                }
                // Mudou dos dois lados: o servidor fica com a sua versão e a do aparelho vira uma cópia ao lado.
                var copy = ConflictPath(op.Path!, deviceName);
                WriteAtomic(NotePaths.Resolve(Root, copy, markdown: true)!, content);
                Console.WriteLine($"  Conflito em {op.Path}: cópia salva como {copy}");
                return new OpResult(op.Id, "conflict", Version(current), copy, Version(content));
            }
            case "delete":
            {
                var full = NotePaths.Resolve(Root, op.Path, markdown: true);
                if (full is null) return new OpResult(op.Id, "error", Message: "invalid path");
                if (!File.Exists(full)) return new OpResult(op.Id, "applied");
                if (op.BaseVersion != Version(File.ReadAllText(full))) return new OpResult(op.Id, "kept");
                MoveToTrash(full);
                return new OpResult(op.Id, "applied");
            }
            case "mkdir":
            {
                var full = NotePaths.Resolve(Root, op.Path, markdown: false);
                if (full is null || NotePaths.Same(full, Root)) return new OpResult(op.Id, "error", Message: "invalid path");
                Directory.CreateDirectory(full);
                return new OpResult(op.Id, "applied");
            }
            case "rmdir":
            {
                var full = NotePaths.Resolve(Root, op.Path, markdown: false);
                if (full is null || NotePaths.Same(full, Root)) return new OpResult(op.Id, "error", Message: "invalid path");
                if (Directory.Exists(full)) MoveToTrash(full);
                return new OpResult(op.Id, "applied");
            }
            case "move":
            {
                var isMd = (op.From ?? "").EndsWith(".md", StringComparison.OrdinalIgnoreCase);
                var a = NotePaths.Resolve(Root, op.From, markdown: isMd);
                var b = NotePaths.Resolve(Root, op.To, markdown: isMd);
                if (a is null || b is null || NotePaths.Same(a, Root) || NotePaths.Same(b, Root)) return new OpResult(op.Id, "error", Message: "invalid path");
                var exists = isMd ? File.Exists(a) : Directory.Exists(a);
                if (!exists) return new OpResult(op.Id, "error", Message: "missing");
                var caseOnly = !string.Equals(a, b, StringComparison.Ordinal) && NotePaths.Same(a, b);
                if (!caseOnly && (File.Exists(b) || Directory.Exists(b))) return new OpResult(op.Id, "error", Message: "exists");
                if (!isMd && (b + Path.DirectorySeparatorChar).StartsWith(a + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) && !caseOnly)
                    return new OpResult(op.Id, "error", Message: "inside itself");
                Directory.CreateDirectory(Path.GetDirectoryName(b)!);
                if (caseOnly)
                {
                    // Windows: renomear só maiúsculas/minúsculas exige um nome intermediário
                    var temp = a + ".c4n-" + Guid.NewGuid().ToString("N")[..8];
                    if (isMd) { File.Move(a, temp); File.Move(temp, b); } else { Directory.Move(a, temp); Directory.Move(temp, b); }
                }
                else if (isMd) File.Move(a, b);
                else Directory.Move(a, b);
                Renames.Record(op.From!, op.To!, folder: !isMd);
                History.Move(Rel(a), Rel(b));
                return new OpResult(op.Id, "applied");
            }
            default:
                return new OpResult(op.Id, "error", Message: "unknown op");
        }
    }

    private string ConflictPath(string rel, string device)
    {
        var stem = rel[..^3];
        var safe = new string(device.Where(c => char.IsLetterOrDigit(c) || c is ' ' or '-' or '_').ToArray()).Trim();
        if (safe.Length == 0) safe = "aparelho";
        var stamp = DateTime.Now.ToString("yyyy-MM-dd HHmm");
        var candidate = $"{stem} (conflito {safe} {stamp}).md";
        for (var i = 2; File.Exists(NotePaths.Resolve(Root, candidate, markdown: true)); i++)
            candidate = $"{stem} (conflito {safe} {stamp} {i}).md";
        return candidate;
    }

    private void MoveToTrash(string full)
    {
        var trash = Path.Combine(Root, ".lixeira", DateTime.Now.ToString("yyyy-MM-dd HHmmss-fff"));
        Directory.CreateDirectory(trash);
        var target = Path.Combine(trash, Path.GetFileName(full));
        if (File.Exists(full)) File.Move(full, target); else Directory.Move(full, target);
    }

    // Notas (com versão), pastas e anexos (imagens e PDFs, só nome, tamanho e data) do vault.
    public void Walk(string dir, string rel, List<string> folders, List<ManifestFile> files, List<ManifestAttachment>? attachments = null)
    {
        foreach (var entry in new DirectoryInfo(dir).EnumerateFileSystemInfos())
        {
            if (entry.Name.StartsWith('.') || (entry.Attributes & FileAttributes.ReparsePoint) != 0) continue;
            var r = rel.Length == 0 ? entry.Name : rel + "/" + entry.Name;
            if (entry is DirectoryInfo d) { folders.Add(r); Walk(d.FullName, r, folders, files, attachments); }
            else if (entry.Name.EndsWith(".md", StringComparison.OrdinalIgnoreCase) && !entry.Name.EndsWith(".tmp", StringComparison.OrdinalIgnoreCase))
            {
                string content;
                try { content = File.ReadAllText(entry.FullName); } catch (IOException) { continue; }
                files.Add(new ManifestFile(r, Version(content), entry.LastWriteTimeUtc));
            }
            else if (attachments is not null && entry is FileInfo f && Security.UploadTypes.Contains(f.Extension.ToLowerInvariant()))
                attachments.Add(new ManifestAttachment(r, f.Length, f.LastWriteTimeUtc));
        }
    }

}

// Vaults ativos, recarregados quando a configuração muda.
sealed class VaultRegistry
{
    private readonly object sync = new();
    private Dictionary<string, Vault> vaults = new(StringComparer.Ordinal);

    public void Load(AppConfig config)
    {
        var next = new Dictionary<string, Vault>(StringComparer.Ordinal);
        lock (sync)
        {
            foreach (var v in config.Vaults)
            {
                // Mantém o objeto (e a trava) de vaults que não mudaram de pasta.
                if (vaults.TryGetValue(v.Id, out var old) && old.Root == System.IO.Path.GetFullPath(v.Path).TrimEnd(System.IO.Path.DirectorySeparatorChar, System.IO.Path.AltDirectorySeparatorChar) && old.Name == v.Name) next[v.Id] = old;
                else next[v.Id] = new Vault(v);
            }
            vaults = next;
        }
    }

    public Vault? Get(string id) { lock (sync) return vaults.TryGetValue(id, out var v) ? v : null; }

    public List<Vault> All() { lock (sync) return vaults.Values.ToList(); }
}
