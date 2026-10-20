/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * Ícone do Cube4Notes perto do relógio do Windows (área de notificação), feito direto com a API do
 * Windows para o projeto continuar compilando no Linux (sem WinForms). Clique abre a janela;
 * botão direito mostra Abrir / Encerrar. Em outros sistemas não é usado.
 */
using System.Runtime.InteropServices;
using System.Runtime.Versioning;

[SupportedOSPlatform("windows")]
sealed class Bandeja : IDisposable
{
    private const uint WmTray = 0x8001, WmCommand = 0x0111, WmClose = 0x0010, WmDestroy = 0x0002, WmNull = 0x0000;
    private const uint WmLButtonUp = 0x0202, WmLButtonDblClk = 0x0203, WmRButtonUp = 0x0205, WmContextMenu = 0x007B;
    private const uint NimAdd = 0, NimModify = 1, NimDelete = 2;
    private const uint NifMessage = 1, NifIcon = 2, NifTip = 4, NifInfo = 0x10;
    private const int CmdOpen = 1, CmdQuit = 2;

    private readonly Action onOpen, onQuit;
    private readonly string? iconPath;
    private readonly string tip;
    private readonly WndProc proc;
    private IntPtr hwnd;
    private NotifyIconData data;

    public Bandeja(string? iconPath, string tip, Action onOpen, Action onQuit)
    {
        this.iconPath = iconPath; this.tip = tip; this.onOpen = onOpen; this.onQuit = onQuit;
        proc = WindowProc;
        var ready = new ManualResetEventSlim();
        var t = new Thread(() => Loop(ready)) { IsBackground = true, Name = "Cube4Notes bandeja" };
        t.SetApartmentState(ApartmentState.STA);
        t.Start();
        ready.Wait(3000);
    }

    public void Notify(string title, string text)
    {
        if (hwnd == IntPtr.Zero) return;
        var d = data;
        d.uFlags = NifInfo;
        d.szInfoTitle = title;
        d.szInfo = text;
        d.dwInfoFlags = 1; // ícone de informação
        Shell_NotifyIcon(NimModify, ref d);
    }

    // Traz para a frente a janela do Cube4Notes que já está aberta.
    public static void Focus(IntPtr window)
    {
        if (window == IntPtr.Zero) return;
        if (IsIconic(window)) ShowWindow(window, 9); // SW_RESTORE
        SetForegroundWindow(window);
    }

    public void Dispose()
    {
        if (hwnd != IntPtr.Zero) PostMessage(hwnd, WmClose, IntPtr.Zero, IntPtr.Zero);
    }

    private void Loop(ManualResetEventSlim ready)
    {
        try
        {
            var instance = GetModuleHandle(null);
            var wc = new WndClassEx
            {
                cbSize = (uint)Marshal.SizeOf<WndClassEx>(),
                lpfnWndProc = Marshal.GetFunctionPointerForDelegate(proc),
                hInstance = instance,
                lpszClassName = "Cube4NotesBandeja",
            };
            RegisterClassEx(ref wc);
            hwnd = CreateWindowEx(0, "Cube4NotesBandeja", "Cube4Notes", 0, 0, 0, 0, 0, IntPtr.Zero, IntPtr.Zero, instance, IntPtr.Zero);
            var icon = iconPath is not null ? LoadImage(IntPtr.Zero, iconPath, 1, 0, 0, 0x10 | 0x40) : IntPtr.Zero;
            if (icon == IntPtr.Zero) icon = LoadIcon(IntPtr.Zero, new IntPtr(32512));
            data = new NotifyIconData
            {
                cbSize = (uint)Marshal.SizeOf<NotifyIconData>(),
                hWnd = hwnd,
                uID = 1,
                uFlags = NifMessage | NifIcon | NifTip,
                uCallbackMessage = WmTray,
                hIcon = icon,
                szTip = tip,
                szInfo = "",
                szInfoTitle = "",
            };
            Shell_NotifyIcon(NimAdd, ref data);
        }
        finally { ready.Set(); }
        while (GetMessage(out var msg, IntPtr.Zero, 0, 0) > 0)
        {
            TranslateMessage(ref msg);
            DispatchMessage(ref msg);
        }
        Shell_NotifyIcon(NimDelete, ref data);
    }

    private IntPtr WindowProc(IntPtr h, uint msg, IntPtr w, IntPtr l)
    {
        switch (msg)
        {
            case WmTray:
                var ev = (uint)(l.ToInt64() & 0xFFFF);
                if (ev is WmLButtonUp or WmLButtonDblClk) Safe(onOpen);
                else if (ev is WmRButtonUp or WmContextMenu) ShowMenu();
                return IntPtr.Zero;
            case WmCommand:
                var id = (int)(w.ToInt64() & 0xFFFF);
                if (id == CmdOpen) Safe(onOpen);
                if (id == CmdQuit) Safe(onQuit);
                return IntPtr.Zero;
            case WmDestroy:
                PostQuitMessage(0);
                return IntPtr.Zero;
        }
        return DefWindowProc(h, msg, w, l);
    }

    private void ShowMenu()
    {
        var menu = CreatePopupMenu();
        AppendMenu(menu, 0, new IntPtr(CmdOpen), "Abrir Cube4Notes");
        AppendMenu(menu, 0x800, IntPtr.Zero, null);
        AppendMenu(menu, 0, new IntPtr(CmdQuit), "Encerrar o Cube4Notes");
        GetCursorPos(out var p);
        SetForegroundWindow(hwnd);
        TrackPopupMenu(menu, 0x2, p.X, p.Y, 0, hwnd, IntPtr.Zero);
        PostMessage(hwnd, WmNull, IntPtr.Zero, IntPtr.Zero);
        DestroyMenu(menu);
    }

    private static void Safe(Action a)
    {
        try { a(); } catch (Exception ex) { Console.WriteLine($"  Bandeja: {ex.Message}"); }
    }

    // ------------------------------------------------------------ API do Windows
    private delegate IntPtr WndProc(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct WndClassEx
    {
        public uint cbSize, style;
        public IntPtr lpfnWndProc;
        public int cbClsExtra, cbWndExtra;
        public IntPtr hInstance, hIcon, hCursor, hbrBackground;
        public string? lpszMenuName, lpszClassName;
        public IntPtr hIconSm;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct NotifyIconData
    {
        public uint cbSize;
        public IntPtr hWnd;
        public uint uID, uFlags, uCallbackMessage;
        public IntPtr hIcon;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string szTip;
        public uint dwState, dwStateMask;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string szInfo;
        public uint uVersion;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)] public string szInfoTitle;
        public uint dwInfoFlags;
        public Guid guidItem;
        public IntPtr hBalloonIcon;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Point { public int X, Y; }

    [StructLayout(LayoutKind.Sequential)]
    private struct Msg
    {
        public IntPtr hwnd;
        public uint message;
        public IntPtr wParam, lParam;
        public uint time;
        public Point pt;
        public uint lPrivate;
    }

    [DllImport("shell32.dll", CharSet = CharSet.Unicode)] private static extern bool Shell_NotifyIcon(uint message, ref NotifyIconData data);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern ushort RegisterClassEx(ref WndClassEx wc);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr CreateWindowEx(uint exStyle, string className, string windowName, uint style, int x, int y, int w, int h, IntPtr parent, IntPtr menu, IntPtr instance, IntPtr param);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr DefWindowProc(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetMessage(out Msg msg, IntPtr hWnd, uint min, uint max);
    [DllImport("user32.dll")] private static extern bool TranslateMessage(ref Msg msg);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr DispatchMessage(ref Msg msg);
    [DllImport("user32.dll")] private static extern void PostQuitMessage(int code);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr LoadImage(IntPtr instance, string name, uint type, int cx, int cy, uint load);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr LoadIcon(IntPtr instance, IntPtr name);
    [DllImport("user32.dll")] private static extern IntPtr CreatePopupMenu();
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern bool AppendMenu(IntPtr menu, uint flags, IntPtr id, string? text);
    [DllImport("user32.dll")] private static extern bool DestroyMenu(IntPtr menu);
    [DllImport("user32.dll")] private static extern bool TrackPopupMenu(IntPtr menu, uint flags, int x, int y, int reserved, IntPtr hWnd, IntPtr rect);
    [DllImport("user32.dll")] private static extern bool GetCursorPos(out Point p);
    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr hWnd, int cmd);
    [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr hWnd);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr GetModuleHandle(string? name);
}
