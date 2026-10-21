/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * Histórico de versões de cada nota, guardado no próprio vault (.cube4notes/historico/<caminho da nota>/).
 * Antes de uma nota ser sobrescrita, o texto anterior vira uma versão (no máximo uma a cada 5 minutos
 * de edição contínua). Ficam as últimas 100 versões de cada nota e nada com mais de 180 dias,
 * mantendo sempre as 10 mais recentes.
 */
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

sealed class History
{
    private const string Stamp = "yyyyMMdd-HHmmss-fff";
    private static readonly TimeSpan Gap = TimeSpan.FromMinutes(5);
    private const int MaxVersions = 100, KeepAlways = 10;
    private static readonly TimeSpan MaxAge = TimeSpan.FromDays(180);
    private readonly string root;

    public History(string vaultState) => root = Path.Combine(vaultState, "historico");

    private static readonly Regex IdRe = new(@"^\d{8}-\d{6}-\d{3}$", RegexOptions.CultureInvariant);
    private static Regex IdPattern() => IdRe;

    // Pasta das versões de uma nota (o caminho já foi validado por NotePaths antes de chegar aqui).
    private string Dir(string rel) => Path.Combine(root, Path.Combine(rel.Split('/')));

    // Guarda o texto que está para ser substituído.
    public void Save(string rel, string previous)
    {
        try
        {
            var dir = Dir(rel);
            Directory.CreateDirectory(dir);
            var files = Versions(dir);
            if (files.Count > 0)
            {
                var last = files[0];
                if (DateTime.UtcNow - last.At < Gap) return;
                if (File.ReadAllText(last.File) == previous) return;
            }
            var name = DateTime.UtcNow.ToString(Stamp, CultureInfo.InvariantCulture);
            File.WriteAllText(Path.Combine(dir, name + ".md"), previous, new UTF8Encoding(false));
            Prune(dir);
        }
        catch (Exception ex) { Console.WriteLine(Idioma.T($"  Histórico de {rel} não foi gravado: {ex.Message}", $"  History of {rel} was not saved: {ex.Message}")); }
    }

    public List<(string Id, DateTime At, long Size)> List(string rel)
    {
        var dir = Dir(rel);
        if (!Directory.Exists(dir)) return [];
        return Versions(dir).Select(v => (v.Id, v.At, new FileInfo(v.File).Length)).ToList();
    }

    public string? Read(string rel, string id)
    {
        if (!IdPattern().IsMatch(id)) return null;
        var file = Path.Combine(Dir(rel), id + ".md");
        return File.Exists(file) ? File.ReadAllText(file) : null;
    }

    // A nota (ou pasta) mudou de nome: o histórico vai junto.
    public void Move(string from, string to)
    {
        try
        {
            var a = Dir(from);
            var b = Dir(to);
            if (!Directory.Exists(a) || Directory.Exists(b)) return;
            Directory.CreateDirectory(Path.GetDirectoryName(b)!);
            Directory.Move(a, b);
        }
        catch (Exception ex) { Console.WriteLine(Idioma.T($"  Histórico de {from} não acompanhou a renomeação: {ex.Message}", $"  History of {from} did not follow the rename: {ex.Message}")); }
    }

    private static List<(string Id, DateTime At, string File)> Versions(string dir) =>
        Directory.EnumerateFiles(dir, "*.md")
            .Select(f => (Id: Path.GetFileNameWithoutExtension(f), File: f))
            .Where(x => IdPattern().IsMatch(x.Id))
            .Select(x => (x.Id, At: DateTime.SpecifyKind(DateTime.ParseExact(x.Id, Stamp, CultureInfo.InvariantCulture), DateTimeKind.Utc), x.File))
            .OrderByDescending(x => x.At)
            .ToList();

    private static void Prune(string dir)
    {
        var all = Versions(dir);
        for (var i = KeepAlways; i < all.Count; i++)
            if (i >= MaxVersions || DateTime.UtcNow - all[i].At > MaxAge) File.Delete(all[i].File);
    }
}
