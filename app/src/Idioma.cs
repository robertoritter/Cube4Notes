/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * Língua das mensagens do próprio programa (ícone ao lado do relógio, avisos do Windows, console e nomes de
 * cópias de conflito): português se o sistema estiver em português, senão inglês. A interface web tem a
 * própria escolha de língua, em Preferências.
 * O projeto usa InvariantGlobalization (CultureInfo não diz a língua do sistema), então ela é lida direto
 * do sistema: Windows pela API, macOS pelas preferências do usuário, Linux pelas variáveis LANG/LC_*.
 */
using System.Diagnostics;
using System.Runtime.InteropServices;

static class Idioma
{
    public static readonly bool Pt = Detect();

    public static string T(string pt, string en) => Pt ? pt : en;

    private static bool Detect()
    {
        try
        {
            var forced = Environment.GetEnvironmentVariable("CUBE4NOTES_LANG");
            if (!string.IsNullOrWhiteSpace(forced)) return IsPt(forced);
            if (OperatingSystem.IsWindows()) return (GetUserDefaultUILanguage() & 0x3FF) == 0x16; // LANG_PORTUGUESE
            foreach (var v in new[] { "LC_ALL", "LC_MESSAGES", "LANG" })
            {
                var value = Environment.GetEnvironmentVariable(v);
                if (!string.IsNullOrWhiteSpace(value) && value is not "C" and not "POSIX" && !value.StartsWith("C.")) return IsPt(value);
            }
            if (OperatingSystem.IsMacOS()) return IsPt(MacLanguage());
        }
        catch (Exception) { }
        return false;
    }

    private static bool IsPt(string value) => value.Trim().TrimStart('(', '"', ' ', '\n').StartsWith("pt", StringComparison.OrdinalIgnoreCase);

    // Primeira língua preferida no macOS (apps abertos pelo Finder não recebem LANG).
    private static string MacLanguage()
    {
        var info = new ProcessStartInfo("defaults", "read -g AppleLanguages") { RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false };
        using var p = Process.Start(info);
        if (p is null) return "";
        var output = p.StandardOutput.ReadToEnd();
        p.WaitForExit(3000);
        var first = output.Split('\n').Select(l => l.Trim().Trim(',', '"')).FirstOrDefault(l => l.Length > 1 && l != "(");
        return first ?? "";
    }

    [DllImport("kernel32.dll")] private static extern ushort GetUserDefaultUILanguage();
}
