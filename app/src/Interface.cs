/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * Entrega a interface web (wwwroot) que vai embutida dentro do próprio executável, para o
 * Cube4Notes.exe funcionar como um arquivo único, sem pasta ao lado. Também calcula a versão
 * da interface usada para os navegadores recarregarem quando ela muda.
 */
using System.Reflection;
using System.Security.Cryptography;
using Microsoft.AspNetCore.StaticFiles;

static class Interface
{
    // "/assets/index-abc.js" -> nome do recurso embutido
    private static readonly Dictionary<string, string> Files = Assembly.GetExecutingAssembly().GetManifestResourceNames()
        .Where(n => n.StartsWith("wwwroot/", StringComparison.Ordinal) || n.StartsWith("wwwroot\\", StringComparison.Ordinal))
        .ToDictionary(n => "/" + n["wwwroot/".Length..].Replace('\\', '/'), n => n, StringComparer.Ordinal);

    private static readonly Lazy<string> version = new(() =>
    {
        if (!Files.TryGetValue("/index.html", out var name)) return "";
        using var s = Assembly.GetExecutingAssembly().GetManifestResourceStream(name)!;
        return Convert.ToHexString(SHA256.HashData(s))[..12].ToLowerInvariant();
    });

    public static bool Embedded => Files.Count > 0;
    public static string Version => version.Value;

    public static async Task<bool> TryServe(HttpContext ctx, FileExtensionContentTypeProvider types)
    {
        if (!HttpMethods.IsGet(ctx.Request.Method) && !HttpMethods.IsHead(ctx.Request.Method)) return false;
        var path = ctx.Request.Path.Value ?? "/";
        if (path.EndsWith('/')) path += "index.html";
        if (!Files.TryGetValue(path, out var name)) return false;
        ctx.Response.ContentType = types.TryGetContentType(path, out var type) ? type : "application/octet-stream";
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(name)!;
        ctx.Response.ContentLength = stream.Length;
        if (HttpMethods.IsGet(ctx.Request.Method)) await stream.CopyToAsync(ctx.Response.Body, ctx.RequestAborted);
        return true;
    }
}
