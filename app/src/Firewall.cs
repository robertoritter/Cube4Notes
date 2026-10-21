/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * Firewall do Windows: libera as portas do Cube4Notes só para a rede local, com uma regra por porta
 * (vale para qualquer cópia do programa, mesmo depois de mover ou recompilar o .exe). A regra é criada
 * uma vez, com a confirmação do Windows (UAC). Regras antigas presas a um caminho do .exe são removidas,
 * porque uma regra de bloqueio do programa venceria a liberação por porta.
 */
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.Versioning;

[SupportedOSPlatform("windows")]
static class Firewall
{
    public const string RuleName = "Cube4Notes (rede local)";
    private static string DeclinedFile => Path.Combine(ConfigStore.Dir, "firewall-recusado.txt");

    // A regra já existe? (consultar não precisa de administrador)
    public static bool HasRule()
    {
        try
        {
            var info = new ProcessStartInfo("netsh", $"advfirewall firewall show rule name=\"{RuleName}\"")
            {
                UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true,
            };
            using var p = Process.Start(info);
            if (p is null) return true;
            p.StandardOutput.ReadToEnd();
            p.StandardError.ReadToEnd();
            p.WaitForExit(10000);
            return p.ExitCode == 0;
        }
        catch (Exception) { return true; } // sem netsh: não insiste
    }

    // Recusado há menos de 30 dias: não pergunta de novo sozinho (o menu do ícone continua oferecendo).
    public static bool RecentlyDeclined()
    {
        try { return File.Exists(DeclinedFile) && File.GetLastWriteTimeUtc(DeclinedFile) > DateTime.UtcNow.AddDays(-30); }
        catch (Exception) { return false; }
    }

    // Cria a regra (o Windows pede confirmação). Devolve true se a regra ficou criada.
    public static bool Allow(int port)
    {
        var commands = new List<string>();
        var exe = Environment.ProcessPath;
        if (exe is not null && !Path.GetFileNameWithoutExtension(exe).Equals("dotnet", StringComparison.OrdinalIgnoreCase))
            commands.Add($"netsh advfirewall firewall delete rule name=all dir=in program=\"{exe}\"");
        commands.Add($"netsh advfirewall firewall delete rule name=\"{RuleName}\"");
        commands.Add($"netsh advfirewall firewall add rule name=\"{RuleName}\" dir=in action=allow protocol=TCP localport={port - 1}-{port} remoteip=localsubnet profile=any");
        var info = new ProcessStartInfo("cmd.exe", "/c " + string.Join(" & ", commands))
        {
            UseShellExecute = true, Verb = "runas", WindowStyle = ProcessWindowStyle.Hidden,
        };
        try
        {
            using var p = Process.Start(info);
            p?.WaitForExit(60000);
        }
        catch (Win32Exception)
        {
            // usuário clicou em Não na confirmação do Windows
            try { File.WriteAllText(DeclinedFile, DateTime.UtcNow.ToString("O")); } catch (Exception) { }
            return false;
        }
        catch (Exception) { return false; }
        var ok = HasRule();
        if (ok) try { File.Delete(DeclinedFile); } catch (Exception) { }
        return ok;
    }
}
