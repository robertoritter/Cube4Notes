/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * Configuração do Cube4Notes num único arquivo (config.json): nome do servidor, modo (só neste computador
 * ou rede de casa), porta e lista de vaults. Inclui a migração da versão de uma pasta só e a validação
 * das pastas escolhidas para vaults.
 */
using System.Text.Json;

sealed record VaultConfig(string Id, string Name, string Path);

sealed class AppConfig
{
    public string Name { get; set; } = Environment.MachineName;
    // "rede": HTTPS para outros aparelhos da casa. "pessoal": só este computador (localhost).
    public string Mode { get; set; } = "rede";
    public int Port { get; set; } = 43125;
    public List<VaultConfig> Vaults { get; set; } = [];
    // Vault criado na migração da versão antiga (o navegador migra para ele as notas guardadas offline).
    public string? LegacyVault { get; set; }
}

static class ConfigStore
{
    private static readonly object Sync = new();
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true };

    public static string DefaultVaultName => Idioma.T("Notas", "Notes");
    public static string Dir { get; set; } = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Cube4Notes");
    public static string FilePath => Path.Combine(Dir, "config.json");

    public static AppConfig? Load()
    {
        lock (Sync)
        {
            if (!File.Exists(FilePath)) return null;
            try { return JsonSerializer.Deserialize<AppConfig>(File.ReadAllText(FilePath)); }
            catch (JsonException ex)
            {
                // Arquivo corrompido: guarda uma cópia e recomeça pelo assistente (as notas não são tocadas).
                var bad = FilePath + ".invalido-" + DateTime.Now.ToString("yyyyMMdd-HHmmss");
                File.Copy(FilePath, bad, true);
                Console.WriteLine(Idioma.T($"  config.json inválido ({ex.Message}). Cópia salva em {bad}.", $"  Invalid config.json ({ex.Message}). Copy saved as {bad}."));
                return null;
            }
        }
    }

    public static void Save(AppConfig config)
    {
        lock (Sync)
        {
            Directory.CreateDirectory(Dir);
            var temp = FilePath + ".tmp";
            File.WriteAllText(temp, JsonSerializer.Serialize(config, Json));
            File.Move(temp, FilePath, overwrite: true);
        }
    }

    // Converte a versão antiga (uma pasta só, devices.json dentro dela) para a configuração com vaults.
    public static AppConfig? Migrate(string? notesArg)
    {
        string? legacy = notesArg;
        var oldChoice = Path.Combine(Dir, "pasta-de-notas.txt");
        if (legacy is null && File.Exists(oldChoice)) legacy = File.ReadAllText(oldChoice).Trim();
        if (string.IsNullOrWhiteSpace(legacy)) return null;
        var root = Path.GetFullPath(legacy).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        Directory.CreateDirectory(root);
        var config = new AppConfig { LegacyVault = "notas" };
        config.Vaults.Add(new VaultConfig("notas", DefaultVaultName, root));
        var oldDevices = Path.Combine(root, ".cube4notes", "devices.json");
        var newDevices = Path.Combine(Dir, "devices.json");
        if (File.Exists(oldDevices) && !File.Exists(newDevices))
        {
            Directory.CreateDirectory(Dir);
            File.Copy(oldDevices, newDevices);
        }
        Save(config);
        Console.WriteLine(Idioma.T($"  Configuração criada a partir da pasta {root} (vault \"{ConfigStore.DefaultVaultName}\").", $"  Settings created from the folder {root} (vault \"{ConfigStore.DefaultVaultName}\")."));
        return config;
    }

    // Identificador estável e legível para a URL (ex.: "Trabalho 2026" -> "trabalho-2026").
    public static string NewVaultId(string name, IEnumerable<string> existing)
    {
        var taken = new HashSet<string>(existing, StringComparer.OrdinalIgnoreCase);
        var noMarks = new string(name.Normalize(System.Text.NormalizationForm.FormD)
            .Where(c => System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c) != System.Globalization.UnicodeCategory.NonSpacingMark).ToArray());
        var slug = new string(noMarks.ToLowerInvariant().Select(c => char.IsAsciiLetterOrDigit(c) ? c : '-').ToArray());
        while (slug.Contains("--")) slug = slug.Replace("--", "-");
        slug = slug.Trim('-');
        if (slug.Length == 0) slug = "vault";
        if (slug.Length > 40) slug = slug[..40].Trim('-');
        var id = slug;
        for (var i = 2; taken.Contains(id); i++) id = $"{slug}-{i}";
        return id;
    }

    public static string CleanName(string? name, string fallback)
    {
        var clean = new string((name ?? "").Where(c => !char.IsControl(c) && c is not '<' and not '>').ToArray()).Trim();
        if (clean.Length == 0) clean = fallback;
        return clean.Length > 60 ? clean[..60] : clean;
    }

    // Devolve null se a pasta pode ser um vault; senão, o código do motivo (a interface traduz).
    public static string? ValidateVaultPath(string? path, AppConfig config, string? exceptId = null)
    {
        if (string.IsNullOrWhiteSpace(path)) return "pick-folder";
        if (!Path.IsPathFullyQualified(path)) return "full-path";
        string full;
        try { full = Path.GetFullPath(path).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar); }
        catch (Exception) { return "bad-path"; }
        if (full.Length == 0 || Path.GetPathRoot(full) is { } r && r.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) == full)
            return "disk-root";
        var cmp = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
        bool Inside(string a, string b) => string.Equals(a, b, cmp) || a.StartsWith(b + Path.DirectorySeparatorChar, cmp);
        var dirFull = Path.GetFullPath(Dir).TrimEnd(Path.DirectorySeparatorChar);
        if (Inside(full, dirFull) || Inside(dirFull, full)) return "config-folder";
        foreach (var sys in SystemFolders())
            if (Inside(full, sys) || string.Equals(full, sys, cmp)) return "system-folder";
        foreach (var v in config.Vaults)
        {
            if (v.Id == exceptId) continue;
            var other = Path.GetFullPath(v.Path).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            if (Inside(full, other) || Inside(other, full)) return "in-vault:" + v.Name;
        }
        if (File.Exists(full)) return "is-file";
        return null;
    }

    private static IEnumerable<string> SystemFolders()
    {
        if (OperatingSystem.IsWindows())
        {
            foreach (var f in new[] { Environment.SpecialFolder.Windows, Environment.SpecialFolder.ProgramFiles, Environment.SpecialFolder.ProgramFilesX86, Environment.SpecialFolder.System })
            {
                var p = Environment.GetFolderPath(f);
                if (!string.IsNullOrEmpty(p)) yield return p.TrimEnd('\\');
            }
        }
        else
        {
            foreach (var p in new[] { "/bin", "/boot", "/dev", "/etc", "/lib", "/lib64", "/proc", "/sbin", "/sys", "/usr", "/var/lib/dpkg" }) yield return p;
        }
    }
}
