/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * Acesso somente leitura para agentes de IA pelo protocolo MCP (Model Context Protocol, transporte HTTP),
 * em /mcp. Cada agente tem um token próprio, criado por um administrador, que só enxerga os vaults
 * escolhidos e nunca escreve. Ferramentas: listar vaults, listar notas, ler, buscar e notas recentes.
 */
using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http;

static class Mcp
{
    private const string LatestProtocol = "2025-06-18";
    private static readonly string[] Protocols = ["2025-06-18", "2025-03-26", "2024-11-05"];
    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public static async Task<IResult> Handle(HttpContext ctx, Device device, VaultRegistry registry)
    {
        if (!HttpMethods.IsPost(ctx.Request.Method))
            return Results.StatusCode(StatusCodes.Status405MethodNotAllowed); // sem fluxo SSE: só pedido e resposta
        JsonNode? request;
        try { request = await JsonNode.ParseAsync(ctx.Request.Body, cancellationToken: ctx.RequestAborted); }
        catch (JsonException) { return Results.Json(Error(null, -32700, "Parse error")); }
        if (request is not JsonObject rpc) return Results.Json(Error(null, -32600, "Invalid request (send one JSON-RPC message per request)"));
        var id = rpc["id"]?.DeepClone();
        var method = Str(rpc["method"]) ?? "";
        // notificação (sem id) ou resposta do cliente: só confirma
        if (id is null) return Results.StatusCode(StatusCodes.Status202Accepted);
        var args = rpc["params"] as JsonObject ?? new JsonObject();
        try
        {
            return method switch
            {
                "initialize" => Results.Json(Result(id, Initialize(args))),
                "ping" => Results.Json(Result(id, new JsonObject())),
                "tools/list" => Results.Json(Result(id, new JsonObject { ["tools"] = Tools() })),
                "tools/call" => Results.Json(Result(id, Call(args, device, registry))),
                _ => Results.Json(Error(id, -32601, "Method not found")),
            };
        }
        catch (Exception ex)
        {
            Console.WriteLine($"  MCP: erro em {method}: {ex.Message}");
            return Results.Json(Error(id, -32603, "Internal error"));
        }
    }

    private static JsonObject Initialize(JsonObject args)
    {
        var asked = Str(args["protocolVersion"]);
        return new JsonObject
        {
            ["protocolVersion"] = asked is not null && Protocols.Contains(asked) ? asked : LatestProtocol,
            ["capabilities"] = new JsonObject { ["tools"] = new JsonObject { ["listChanged"] = false } },
            ["serverInfo"] = new JsonObject { ["name"] = "Cube4Notes", ["version"] = "1.0.0" },
            ["instructions"] = "Notas Markdown pessoais do Cube4Notes, somente leitura. Use list_vaults para ver os vaults liberados, search_notes para achar notas e read_note para ler o texto completo.",
        };
    }

    private static JsonArray Tools()
    {
        static JsonObject Tool(string name, string description, JsonObject properties, params string[] required) => new()
        {
            ["name"] = name,
            ["description"] = description,
            ["inputSchema"] = new JsonObject
            {
                ["type"] = "object",
                ["properties"] = properties,
                ["required"] = new JsonArray(required.Select(r => (JsonNode)r).ToArray()),
            },
            ["annotations"] = new JsonObject { ["readOnlyHint"] = true },
        };
        static JsonObject Schema(string description) => new() { ["type"] = "string", ["description"] = description };
        static JsonObject Int(string description) => new() { ["type"] = "integer", ["description"] = description };
        return new JsonArray(
            Tool("list_vaults", "Lista os vaults (pastas de notas) liberados para este agente.", new JsonObject()),
            Tool("list_notes", "Lista os caminhos das notas de um vault, opcionalmente só de uma pasta.",
                new JsonObject { ["vault"] = Schema("id do vault (de list_vaults)"), ["folder"] = Schema("pasta dentro do vault, por exemplo trabalho/2026") }, "vault"),
            Tool("read_note", "Lê o texto Markdown completo de uma nota.",
                new JsonObject { ["vault"] = Schema("id do vault"), ["path"] = Schema("caminho da nota, por exemplo trabalho/Reunião.md") }, "vault", "path"),
            Tool("search_notes", "Busca notas que contêm todas as palavras (sem diferenciar acentos e maiúsculas). Devolve caminho e trecho.",
                new JsonObject { ["query"] = Schema("palavras a buscar"), ["vault"] = Schema("id do vault (opcional: todos os liberados)"), ["limit"] = Int("máximo de resultados (padrão 20, até 100)") }, "query"),
            Tool("recent_notes", "Notas alteradas mais recentemente.",
                new JsonObject { ["vault"] = Schema("id do vault (opcional: todos os liberados)"), ["limit"] = Int("máximo de resultados (padrão 20, até 100)") }));
    }

    private static JsonObject Call(JsonObject args, Device device, VaultRegistry registry)
    {
        var name = Str(args["name"]) ?? "";
        var input = args["arguments"] as JsonObject ?? new JsonObject();
        string S(string key) => Str(input[key]) ?? "";
        int Limit() => Math.Clamp(input["limit"] is JsonValue v && v.TryGetValue<int>(out var n) ? n : 20, 1, 100);
        var allowed = registry.All().Where(v => device.CanAccess(v.Id)).OrderBy(v => v.Name, StringComparer.CurrentCultureIgnoreCase).ToList();
        Vault? VaultArg(bool optional, out string? problem)
        {
            problem = null;
            var id = S("vault");
            if (id.Length == 0) { if (!optional) problem = "Informe o vault (use list_vaults)."; return null; }
            var v = allowed.FirstOrDefault(x => x.Id == id);
            if (v is null) problem = $"Vault \"{id}\" não existe ou não está liberado para este agente.";
            return v;
        }
        Console.WriteLine($"  Agente {device.Name}: {name}");
        switch (name)
        {
            case "list_vaults":
                return Text(JsonSerializer.Serialize(allowed.Select(v => new { id = v.Id, name = v.Name }), Json));
            case "list_notes":
            {
                var vault = VaultArg(false, out var problem);
                if (vault is null) return Fail(problem!);
                var folder = S("folder").Trim('/');
                var notes = Notes(vault).Select(n => n.Path).Where(p => folder.Length == 0 || p.StartsWith(folder + "/", StringComparison.OrdinalIgnoreCase)).Take(5000).ToList();
                return Text(notes.Count == 0 ? "Nenhuma nota." : string.Join('\n', notes));
            }
            case "read_note":
            {
                var vault = VaultArg(false, out var problem);
                if (vault is null) return Fail(problem!);
                var full = NotePaths.Resolve(vault.Root, S("path"), markdown: true);
                if (full is null || !File.Exists(full)) return Fail("Nota não encontrada. Use list_notes ou search_notes para ver os caminhos.");
                return Text(File.ReadAllText(full));
            }
            case "search_notes":
            {
                var words = Fold(S("query")).Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                if (words.Length == 0) return Fail("Informe o que buscar.");
                var single = VaultArg(true, out var problem);
                if (problem is not null) return Fail(problem);
                var hits = new List<object>();
                List<Vault> scope = single is not null ? new List<Vault> { single } : allowed;
                foreach (var vault in scope)
                    foreach (var n in Notes(vault).OrderByDescending(x => x.Modified))
                    {
                        if (hits.Count >= Limit()) break;
                        string content;
                        try { content = File.ReadAllText(n.Full); } catch (IOException) { continue; }
                        var folded = Fold(n.Path + "\n" + content);
                        if (!words.All(folded.Contains)) continue;
                        hits.Add(new { vault = vault.Id, path = n.Path, modified = n.Modified, snippet = Snippet(content, words[0]) });
                    }
                return Text(hits.Count == 0 ? "Nada encontrado." : JsonSerializer.Serialize(hits, Json));
            }
            case "recent_notes":
            {
                var single = VaultArg(true, out var problem);
                if (problem is not null) return Fail(problem);
                List<Vault> scope = single is not null ? new List<Vault> { single } : allowed;
                var recent = scope
                    .SelectMany(v => Notes(v).Select(n => new { vault = v.Id, path = n.Path, modified = n.Modified }))
                    .OrderByDescending(n => n.modified).Take(Limit());
                return Text(JsonSerializer.Serialize(recent, Json));
            }
            default:
                return Fail($"Ferramenta desconhecida: {name}");
        }
    }

    private static IEnumerable<(string Path, string Full, DateTime Modified)> Notes(Vault vault)
    {
        var folders = new List<string>();
        var files = new List<ManifestFile>();
        vault.Walk(vault.Root, "", folders, files);
        return files.Select(f => (f.Path, Path.Combine(vault.Root, Path.Combine(f.Path.Split('/'))), f.Modified));
    }

    // Sem acentos e em minúsculas, para buscar "reuniao" e achar "Reunião".
    private static string Fold(string s)
    {
        try
        {
            var d = s.Normalize(NormalizationForm.FormD);
            var sb = new StringBuilder(d.Length);
            foreach (var c in d) if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) sb.Append(c);
            return sb.ToString().ToLowerInvariant();
        }
        catch (Exception) { return s.ToLowerInvariant(); }
    }

    private static string Snippet(string content, string word)
    {
        var at = Math.Min(Math.Max(0, Fold(content).IndexOf(word, StringComparison.Ordinal)), content.Length);
        var start = Math.Max(0, at - 80);
        var end = Math.Min(content.Length, start + 240);
        return (start > 0 ? "…" : "") + content[start..end].Replace('\n', ' ') + (end < content.Length ? "…" : "");
    }

    private static string? Str(JsonNode? node) => node is JsonValue v && v.TryGetValue<string>(out var s) ? s : null;

    private static JsonObject Text(string text) => new()
    {
        ["content"] = new JsonArray(new JsonObject { ["type"] = "text", ["text"] = text }),
    };

    private static JsonObject Fail(string text)
    {
        var r = Text(text);
        r["isError"] = true;
        return r;
    }

    private static JsonObject Result(JsonNode id, JsonNode result) => new() { ["jsonrpc"] = "2.0", ["id"] = id, ["result"] = result };

    private static JsonObject Error(JsonNode? id, int code, string message) => new()
    {
        ["jsonrpc"] = "2.0", ["id"] = id, ["error"] = new JsonObject { ["code"] = code, ["message"] = message },
    };
}
