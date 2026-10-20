/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * Janela própria do Cube4Notes (Photino: WebView2 no Windows, WebKitGTK no Linux, WebKit no macOS),
 * sem navegador e sem console. A janela roda num processo separado (Cube4Notes --janela <endereço>):
 * fechar a janela não derruba o servidor, e abrir o Cube4Notes de novo só abre outra janela.
 */
using System.Diagnostics;
using System.Net.Sockets;
using System.Reflection;
using Photino.NET;

static class Janela
{
    // Há uma tela onde abrir janela? (servidor Linux sem interface gráfica usa o modo console)
    public static bool HasDesktop()
    {
        if (OperatingSystem.IsWindows() || OperatingSystem.IsMacOS()) return Environment.UserInteractive;
        return !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("DISPLAY"))
            || !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("WAYLAND_DISPLAY"));
    }

    // Outro Cube4Notes já está atendendo nesta porta?
    public static bool ServerRunning(int port)
    {
        try
        {
            using var tcp = new TcpClient();
            return tcp.ConnectAsync("127.0.0.1", port).Wait(700) && tcp.Connected;
        }
        catch (Exception) { return false; }
    }

    // Ícone gravado na pasta de configuração (a janela e a bandeja precisam de um arquivo).
    public static string? IconPath()
    {
        try
        {
            var path = Path.Combine(ConfigStore.Dir, OperatingSystem.IsWindows() ? "cube4notes.ico" : "cube4notes.png");
            var resource = OperatingSystem.IsWindows() ? "icone/cube4notes.ico" : "wwwroot/brand/icon-512.png";
            using var s = Assembly.GetExecutingAssembly().GetManifestResourceStream(resource);
            if (s is null) return null;
            if (!File.Exists(path) || new FileInfo(path).Length != s.Length)
            {
                using var f = File.Create(path);
                s.CopyTo(f);
            }
            return path;
        }
        catch (Exception) { return null; }
    }

    // Abre a janela num processo novo; devolve o processo para acompanhar quando ela fecha.
    public static Process? Spawn(string url)
    {
        try
        {
            var exe = Environment.ProcessPath!;
            var info = new ProcessStartInfo(exe) { UseShellExecute = false };
            // "dotnet run": o processo é o dotnet, então passa a dll do Cube4Notes antes dos argumentos
            if (Path.GetFileNameWithoutExtension(exe).Equals("dotnet", StringComparison.OrdinalIgnoreCase))
                info.ArgumentList.Add(Path.Combine(AppContext.BaseDirectory, "Cube4Notes.dll"));
            info.ArgumentList.Add("--janela");
            info.ArgumentList.Add(url);
            info.ArgumentList.Add("--config");
            info.ArgumentList.Add(ConfigStore.Dir);
            return Process.Start(info);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"  Não foi possível abrir a janela ({ex.Message}); abrindo no navegador.");
            OpenBrowser(url);
            return null;
        }
    }

    // Processo da janela: mostra o Cube4Notes e termina quando a janela fecha.
    public static int Run(string url)
    {
        var ok = false;
        void Show()
        {
            try
            {
                var window = new PhotinoWindow()
                    .SetTitle("Cube4Notes")
                    .SetUseOsDefaultSize(false)
                    .SetSize(1360, 860)
                    .SetMinSize(420, 480)
                    .Center()
                    .SetContextMenuEnabled(true)
                    .SetDevToolsEnabled(false);
                if (IconPath() is { } icon) window.SetIconFile(icon);
                // dados do WebView2 (notas offline da janela) ficam junto da configuração, não ao lado do .exe
                if (OperatingSystem.IsWindows()) window.SetTemporaryFilesPath(Path.Combine(ConfigStore.Dir, "janela"));
                window.Load(new Uri(url));
                ok = true;
                window.WaitForClose();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"  Janela indisponível ({ex.Message}); abrindo no navegador.");
            }
        }
        if (OperatingSystem.IsWindows())
        {
            // o WebView2 exige uma thread STA
            var t = new Thread(Show);
            t.SetApartmentState(ApartmentState.STA);
            t.Start();
            t.Join();
        }
        else Show();
        if (!ok) OpenBrowser(url);
        return 0;
    }

    public static void OpenBrowser(string url)
    {
        try
        {
            if (OperatingSystem.IsWindows()) Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            else if (OperatingSystem.IsMacOS()) Process.Start("open", url);
            else Process.Start("xdg-open", url);
        }
        catch (Exception) { Console.WriteLine($"  Abra no navegador: {url}"); }
    }
}
