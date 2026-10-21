# Author: Roberto Ritter
# Studio: Cube4Code
# Website: https://cube4code.com
# Copyright (c) 2026 Roberto Ritter
#
# Testes dos recursos de edição: links entre notas, anexos offline, histórico de versões, tags e propriedades,
# modelos, relações e listas por tipo,
# e acesso somente leitura para agentes (MCP). Usa a interface real num navegador e o servidor de teste.
# Uso: python dev/teste_recursos.py  (precisa de Node e Playwright)
import asyncio, os, sys, json, glob, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from teste_sync import Device, check, scenario, RESULTS, files, PORT  # noqa: E402
from playwright.async_api import async_playwright  # noqa: E402

URL = f"http://localhost:{PORT}/"


def read(v, rel):
    return open(os.path.join(v, rel), encoding="utf-8").read()


async def type_link(dev, query):
    """Digita [[ e o começo do nome, e escolhe a primeira nota sugerida."""
    await dev.page.keyboard.type("[[" + query, delay=20)
    await dev.page.wait_for_selector(".link-pop .pal-item", timeout=3000)
    await dev.page.keyboard.press("Enter")
    await dev.page.wait_for_timeout(900)


async def main():
    async with async_playwright() as p:
        # 1. Links: [[ escolhe a nota, o Markdown fica padrão e acompanha renomeações e movimentos
        async def links(A, B, v):
            await A.open("Diario")
            p_ = A.page.locator(".ProseMirror p").last
            await p_.click(); await A.page.keyboard.press("End"); await A.page.keyboard.type(" veja ", delay=5)
            await type_link(A, "reuni")
            await A.page.keyboard.type("e tambem ", delay=5)
            await type_link(A, "lista")
            await A.page.keyboard.type("[[Ideias novas]]", delay=15)
            await A.page.wait_for_timeout(600)
            await A.sync()
            d = read(v, "Diario.md")
            check("[[ insere link Markdown padrão com caminho relativo", "[Reunião de equipe](trabalho/Reuni%C3%A3o%20de%20equipe.md)" in d, d)
            check("segundo link na mesma linha", "[Lista](Lista.md)" in d, d)
            check("[[Nome]] digitado por inteiro vira link (nota ainda não existe)", "[Ideias novas](Ideias%20novas.md)" in d, d)
            # renomear a nota apontada
            await A.open("Reunião de equipe"); await A.rename("Reunião semanal"); await A.sync()
            d = read(v, "Diario.md")
            check("renomear nota atualiza os links nas outras (e o texto que era o nome antigo)", "[Reunião semanal](trabalho/Reuni%C3%A3o%20semanal.md)" in d and "equipe" not in d, d)
            # mover a própria nota para uma pasta: links dela continuam certos
            await A.page.locator(".row:has(.name:text-is('Diario'))").first.drag_to(A.page.locator(".row.folder:has(.name:text-is('trabalho'))").first)
            await A.page.wait_for_timeout(900); await A.sync()
            d = read(v, "trabalho/Diario.md")
            check("mover a nota ajusta os links relativos dela", "](Reuni%C3%A3o%20semanal.md)" in d and "](../Lista.md)" in d and "](../anexos/foto.png)" in d, d)
            # renomear pasta: notas de fora que apontam para dentro dela
            await A.rename_row("trabalho", "empresa"); await A.sync()
            l = read(v, "Lista.md")
            check("renomear pasta atualiza links de fora", "](empresa/Diario.md)" in l, l)
            # clique: Ctrl+clique abre a nota; link para nota inexistente oferece criar
            await A.open("Diario")
            await A.page.click("#editor-host a:has-text('Lista')", modifiers=["Control"])
            await A.page.wait_for_timeout(800)
            check("Ctrl+clique abre a nota do link", await A.page.input_value("#title") == "Lista")
            await A.open("Diario")
            await A.page.click("#editor-host a:has-text('Ideias novas')", modifiers=["Control"])
            await A.page.wait_for_timeout(400)
            await A.page.click(".modal .btn.primary"); await A.page.wait_for_timeout(900); await A.sync()
            check("link para nota que não existe cria a nota (onde o link aponta)", os.path.exists(os.path.join(v, "Ideias novas.md")), str(files(v)))
            # modo Markdown também completa
            await A.open("Lista")
            await A.page.keyboard.press("Control+/"); await A.page.wait_for_timeout(500)
            await A.page.click("#source"); await A.page.keyboard.press("Control+End")
            await A.page.keyboard.type("\nver ", delay=5)
            await type_link(A, "diar")
            await A.sync()
            l = read(v, "Lista.md")
            check("[[ no modo Markdown insere o link", "ver [Diario](empresa/Diario.md)" in l, l)
            await A.page.keyboard.press("Control+/")
        await scenario(p, "1. Links entre notas", {
            "Diario.md": "# Diario\n\nhoje ![foto](anexos/foto.png)\n",
            "Lista.md": "# Lista\n\n- leite\n- [diario](Diario.md)\n",
            "trabalho/Reunião de equipe.md": "# Reunião\n\npauta\n",
            "anexos/.keep.md": "",
        }, links)

        # 2. Anexos: colar imagem sem servidor, subir depois, outro aparelho ver mesmo offline
        PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
        async def paste(dev, name, b64=PNG, mime="image/png"):
            await dev.page.evaluate("""([name, b64, mime]) => {
                const bin = atob(b64); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
                const dt = new DataTransfer(); dt.items.add(new File([a], name, { type: mime }));
                const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
                document.querySelector('#editor-host .ProseMirror').dispatchEvent(ev);
            }""", [name, b64, mime])
            await dev.page.wait_for_timeout(1200)

        async def anexos(A, B, v):
            await A.open("Viagem"); await B.open("Viagem")
            await A.offline()
            open(os.path.join(v, "anexos/foto.png"), "wb").write(b"antiga")  # chega ao servidor por outro caminho
            p_ = A.page.locator(".ProseMirror p").last
            await p_.click(); await A.page.keyboard.press("End")
            await paste(A, "image.png")
            await paste(A, "foto.png")
            n_img = await A.page.evaluate("[...document.querySelectorAll('#editor-host img')].filter(i => i.src.startsWith('blob:') && i.naturalWidth > 0).length")
            check("imagem colada sem servidor aparece na hora", n_img >= 2, str(n_img))
            pend = await A.page.inner_text("#sync-pill")
            check("anexos ficam pendentes enquanto offline", "pendente" in pend, pend)
            await A.offline(False); await A.sync(); await A.page.wait_for_timeout(1500)
            att = sorted(os.path.relpath(x, v) for x in glob.glob(os.path.join(v, "anexos", "*")))
            check("anexos sobem quando o servidor volta", any(a.startswith("anexos/Imagem ") for a in att) and "anexos/foto-2.png" in att, str(att))
            d = read(v, "Viagem.md")
            check("nota aponta para o nome final (foto-2.png, sem sobrescrever a foto que já existia)", "anexos/foto-2.png" in d and "anexos/foto.png)" not in d, d)
            check("foto antiga do servidor intacta", open(os.path.join(v, "anexos/foto.png"), "rb").read() == b"antiga", "")
            await B.sync(); await B.page.wait_for_timeout(2500)
            await B.offline(); await B.page.reload(); await B.page.wait_for_timeout(2500)
            await B.open("Viagem"); await B.page.wait_for_timeout(1500)
            n_b = await B.page.evaluate("[...document.querySelectorAll('#editor-host img')].filter(i => i.naturalWidth > 0).length")
            check("outro aparelho mostra as imagens sem servidor", n_b >= 2, str(n_b))
            # PDF colado vira link e abre pelo arquivo guardado
            await B.offline(False)
            await A.open("Viagem"); p_ = A.page.locator(".ProseMirror p").last
            await p_.click(); await A.page.keyboard.press("End")
            await paste(A, "bilhete.pdf", "JVBERi0xLjQKJSVFT0YK", "application/pdf")
            await A.sync()
            d = read(v, "Viagem.md")
            check("PDF colado vira link para o arquivo", "[bilhete.pdf](anexos/bilhete.pdf)" in d and os.path.exists(os.path.join(v, "anexos/bilhete.pdf")), d)
            await paste(A, "virus.exe", "TVo=", "application/octet-stream")
            toast = await A.page.evaluate("document.querySelector('.toast')?.innerText || ''")
            check("tipo não permitido é recusado com aviso", "não foi anexado" in toast, toast)
        await scenario(p, "2. Anexos offline", {"Viagem.md": "# Viagem\n\nfotos:\n", "anexos/.x.md": ""}, anexos)

        # 3. Histórico de versões: cada gravação guarda o texto anterior; restaurar não perde o atual
        async def historico(A, B, v):
            await A.open("Plano")
            for i in range(3):
                await A.append(f"PASSO-{i}"); await A.sync()
            vers = glob.glob(os.path.join(v, ".cube4notes", "historico", "Plano.md", "*.md"))
            check("servidor guarda as versões anteriores", len(vers) >= 3, str(len(vers)))
            await A.page.click(".history-btn"); await A.page.wait_for_selector(".hist-item")
            n = await A.page.locator(".hist-item").count()
            check("histórico lista as versões", n >= 3, str(n))
            diff = await A.page.inner_text(".hist-view")
            check("mostra a diferença para o texto atual", "PASSO-2" in diff, diff[:200])
            await A.page.locator(".hist-item").last.click(); await A.page.wait_for_timeout(500)
            await A.page.click(".hist-actions .btn.primary"); await A.page.click(".modal.small .btn.primary")
            await A.page.wait_for_timeout(800); await A.sync()
            d = read(v, "Plano.md")
            check("restaurar volta o texto original", d == "# Plano\n\ninicio\n" or ("PASSO" not in d and "inicio" in d), d)
            ultimo = sorted(glob.glob(os.path.join(v, ".cube4notes", "historico", "Plano.md", "*.md")))[-1]
            check("texto de antes de restaurar continua no histórico", "PASSO-2" in open(ultimo, encoding="utf-8").read())
            await A.rename("Plano 2026"); await A.sync()
            check("histórico acompanha a renomeação", len(glob.glob(os.path.join(v, ".cube4notes", "historico", "Plano 2026.md", "*.md"))) >= 4)
            await A.offline(); await A.page.click(".history-btn"); await A.page.wait_for_timeout(1500)
            msg = await A.page.inner_text(".history")
            check("sem servidor o histórico avisa", "servidor" in msg, msg)
            await A.page.keyboard.press("Escape"); await A.offline(False)
        await scenario(p, "3. Histórico de versões", {"Plano.md": "# Plano\n\ninicio\n"}, historico, extra=("--history-gap-ms", "0"))

        # 4. Tags e propriedades
        async def tags(A, B, v):
            await A.page.click(".side-tab[data-view='tags']"); await A.page.wait_for_timeout(400)
            rows = await A.page.locator(".tag-row .name").all_inner_texts()
            check("painel de tags lista #tags do texto e da propriedade tags", set(["ideia", "trabalho", "projeto/cube4"]) <= set(rows) and "codigo" not in rows, str(rows))
            await A.page.click(".tag-row:has-text('trabalho')"); await A.page.wait_for_timeout(400)
            hits = await A.page.locator(".hit-title span").all_inner_texts()
            check("clicar na tag filtra as notas", sorted(hits) == ["Ata", "Ideias"], str(hits))
            await A.page.fill("#search-input", "status:aberto"); await A.page.wait_for_timeout(300)
            hits = await A.page.locator(".hit-title span").all_inner_texts()
            check("busca por propriedade:valor", hits == ["Ata"], str(hits))
            await A.page.fill("#search-input", "#projeto pauta"); await A.page.wait_for_timeout(300)
            hits = await A.page.locator(".hit-title span").all_inner_texts()
            check("tag (com subtag) + texto", hits == ["Ata"], str(hits))
            # editar propriedade em campos
            await A.open("Ata")
            await A.page.click(".props summary") if not await A.page.locator(".props[open]").count() else None
            val = A.page.locator(".prop-row:has(.prop-key[value='status']) .prop-val")
            await val.fill("fechado"); await A.page.wait_for_timeout(600); await A.sync()
            d = read(v, "Ata.md")
            check("editar propriedade grava YAML limpo e mantém o resto", d.startswith("---\ntags: [trabalho, projeto/cube4]\nstatus: fechado\n---\n") and "#ideia" not in d and "pauta" in d, d)
            # adicionar propriedades numa nota sem
            await A.open("Sem props")
            await A.page.keyboard.press("Control+k"); await A.page.keyboard.type(">propriedades"); await A.page.keyboard.press("Enter")
            await A.page.wait_for_timeout(500)
            await A.page.click(".prop-actions .btn:has-text('Adicionar propriedade')"); await A.page.wait_for_timeout(300)
            await A.page.keyboard.type("ideia, casa", delay=10); await A.page.wait_for_timeout(700); await A.sync()
            d = read(v, "Sem props.md")
            check("adicionar propriedades cria o frontmatter", d.startswith("---\ntags: [ideia, casa]\n---\n") and "texto simples" in d, d)
            # YAML complexo não é reescrito
            await A.open("Complexa")
            n = await A.page.locator(".props textarea.props-raw").count()
            check("YAML elaborado fica como texto (não é reescrito)", n == 1)
        await scenario(p, "4. Tags e propriedades", {
            "Ata.md": "---\ntags: [trabalho, projeto/cube4]\nstatus: aberto\n---\n# Ata\n\npauta da reunião\n",
            "Ideias.md": "# Ideias\n\numa #ideia de #trabalho e `#codigo`\n",
            "Sem props.md": "texto simples\n",
            "Complexa.md": "---\nautor:\n  nome: X\n---\nok\n",
        }, tags)

        # 5. Agentes de IA (MCP): token somente leitura, só os vaults escolhidos
        def http(method, path, token=None, data=None, origin=None):
            req = urllib.request.Request(URL.rstrip("/") + path, method=method, data=None if data is None else json.dumps(data).encode())
            req.add_header("Content-Type", "application/json")
            if token: req.add_header("Authorization", "Bearer " + token)
            if origin: req.add_header("Origin", origin)
            try:
                with urllib.request.urlopen(req, timeout=10) as r: return r.status, json.loads(r.read() or b"null")
            except urllib.error.HTTPError as e:
                return e.code, None
        def call(token, method, params=None, id_=1):
            return http("POST", "/mcp", token, {"jsonrpc": "2.0", "id": id_, "method": method, "params": params or {}})
        def tool(token, name, args=None):
            st, r = call(token, "tools/call", {"name": name, "arguments": args or {}})
            return r["result"]["content"][0]["text"], r["result"].get("isError", False)

        async def agentes(A, B, v):
            await A.page.click(".side-foot .icon-btn"); await A.page.click(".connect-btn"); await A.page.wait_for_timeout(800)
            await A.page.click(".agents .btn:has-text('Criar acesso')")
            await A.page.fill(".agent-form input.field", "Agente HAL")
            await A.page.click(".agent-form .btn.primary"); await A.page.wait_for_timeout(800)
            token = (await A.page.inner_text(".agent-created code.qr-link")).strip()
            check("cria token de agente e mostra uma vez", token.startswith("c4n_agente_"), token[:20])
            cmd = await A.page.inner_text(".agent-created")
            check("mostra o comando para o Claude Code", "claude mcp add --transport http cube4notes" in cmd)
            st, r = call(token, "initialize", {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "t", "version": "1"}})
            check("MCP initialize", st == 200 and r["result"]["serverInfo"]["name"] == "Cube4Notes", str(r))
            st, _ = http("POST", "/mcp", token, {"jsonrpc": "2.0", "method": "notifications/initialized"})
            check("MCP notificação recebe 202", st == 202, str(st))
            st, r = call(token, "tools/list")
            names = [x["name"] for x in r["result"]["tools"]]
            check("MCP lista as 5 ferramentas de leitura", names == ["list_vaults", "list_notes", "read_note", "search_notes", "recent_notes"], str(names))
            txt, _ = tool(token, "list_vaults")
            check("agente vê só o vault liberado", '"notas"' in txt and "segredo" not in txt, txt)
            txt, _ = tool(token, "search_notes", {"query": "reuniao"})
            check("busca sem acento acha a nota", "trabalho/Reunião.md" in txt, txt)
            txt, err = tool(token, "read_note", {"vault": "notas", "path": "trabalho/Reunião.md"})
            check("lê a nota inteira", "pauta secreta" in txt and not err, txt)
            txt, err = tool(token, "read_note", {"vault": "notas", "path": "../../etc/passwd.md"})
            check("caminho fora do vault é recusado", err, txt)
            txt, err = tool(token, "list_notes", {"vault": "segredo"})
            check("vault não liberado é recusado", err and "não está liberado" in txt, txt)
            st, _ = http("POST", "/api/v/notas/sync", token, {"ops": [{"id": 1, "type": "put", "path": "x.md", "content": "hack", "baseVersion": None}]})
            check("token de agente não escreve (403)", st == 403 and not os.path.exists(os.path.join(v, "x.md")), str(st))
            st, r = http("GET", "/api/status", token)
            check("token de agente nunca é administrador", r and r["admin"] is False, str(r))
            st, _ = http("GET", "/api/admin/devices", token)
            check("token de agente não acessa a administração", st == 403, str(st))
            st, _ = http("POST", "/mcp", None, {"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
            check("MCP sem token: 401", st == 401, str(st))
            st, _ = http("POST", "/mcp", token, {"jsonrpc": "2.0", "id": 1, "method": "tools/list"}, origin="https://site-malicioso.com")
            check("MCP chamado por outro site (Origin): 403", st == 403, str(st))
            await A.page.click(".agent-created .btn.primary"); await A.page.wait_for_timeout(600)
            await A.page.click(".agents .device .btn.danger-text"); await A.page.click(".modal.small .btn.danger"); await A.page.wait_for_timeout(600)
            st, _ = call(token, "tools/list")
            check("remover o agente invalida o token na hora", st == 401, str(st))
        await scenario(p, "5. Agentes de IA (MCP)", {"trabalho/Reunião.md": "# Reunião\n\npauta secreta\n", "Lista.md": "leite\n"}, agentes)

        # 6. Modelos, conjuntos, relações e listas por tipo
        import datetime
        async def relacoes(A, B, v):
            pg = A.page
            await pg.keyboard.press("Control+k"); await pg.keyboard.type(">conjunto"); await pg.keyboard.press("Enter")
            await pg.wait_for_selector(".kit-card"); await pg.click(".kit-card:has-text('Trabalho') .btn"); await pg.wait_for_timeout(500); await A.sync()
            check("conjunto Trabalho cria os modelos", all(os.path.exists(os.path.join(v, "modelos", f + ".md")) for f in ["Empresa", "Pessoa", "Reunião", "Projeto", "Decisão", "Diário"]), str(files(v)))
            # nova nota pela janela: modelo Empresa + tag
            async def nova(nome, modelo, tags=()):
                await pg.keyboard.press("Escape"); await pg.keyboard.press("Alt+n"); await pg.wait_for_selector(".create-sheet")
                await pg.fill(".create-sheet input.field", nome)
                await pg.click(f".tpl-card:has-text('{modelo}')")
                for tg in tags:
                    await pg.fill(".chip-input", tg); await pg.press(".chip-input", "Enter")
                await pg.click(".create-sheet .btn.primary"); await pg.wait_for_timeout(900)
            await nova("Empresa Y", "Empresa", ["cliente"])
            await A.sync()
            d = read(v, "Empresas/Empresa Y.md")
            check("nota criada do modelo, na pasta do modelo, com tags", d.startswith("---\ntipo: empresa\ntags: [empresa, cliente]\nramo:\nsite:\n---\n# Empresa Y") and "## O que faz" in d and "destino" not in d, d)
            await nova("Ana Souza", "Pessoa")
            await pg.fill(".prop-row:has(.prop-key[value='empresa']) .prop-val", "Empresa Y")
            await pg.fill(".prop-row:has(.prop-key[value='cargo']) .prop-val", "diretora")
            await pg.wait_for_timeout(700); await A.sync()
            check("campo empresa liga a pessoa à empresa", "empresa: Empresa Y" in read(v, "Pessoas/Ana Souza.md"), read(v, "Pessoas/Ana Souza.md"))
            await nova("Rodada X Y Z", "Reunião")
            await pg.click(".ProseMirror h2:has-text('Anotações')"); await pg.keyboard.press("End"); await pg.keyboard.press("Enter")
            await pg.keyboard.type("falamos com [[Empresa X", delay=20)
            await pg.wait_for_selector(".link-pop .pal-item")
            await pg.click(".link-pop .pal-item:has-text('como Empresa')"); await pg.wait_for_timeout(800)
            await pg.keyboard.type("e [[Empresa Y]] sobre #cli", delay=20); await pg.wait_for_timeout(500)
            sugg = await pg.locator(".link-pop .pal-label").all_inner_texts()
            check("# sugere tags existentes", "#cliente" in sugg, str(sugg))
            await pg.keyboard.press("Enter"); await pg.wait_for_timeout(700); await A.sync()
            hoje = datetime.date.today().isoformat()
            m = read(v, "Reuniões/Rodada X Y Z.md")
            check("reunião com data preenchida e links", f'data: "{hoje}"' in m or f"data: {hoje}" in m, m[:120])
            check("[[ cria a empresa X a partir do modelo, na pasta Empresas", os.path.exists(os.path.join(v, "Empresas/Empresa X.md")) and "tipo: empresa" in read(v, "Empresas/Empresa X.md") and "](../Empresas/Empresa%20X.md)" in m, m)
            check("tag escolhida entra no texto", "#cliente " in m or m.rstrip().endswith("#cliente"), m[-80:])
            # relações na ficha da empresa (computador: painel lateral)
            await A.open("Empresa Y"); await pg.wait_for_timeout(700)
            rel = await pg.inner_text("#panel .relations")
            check("ficha mostra pessoas e reuniões agrupadas por tipo", "Pessoa" in rel and "Ana Souza" in rel and "diretora" in rel and "Reunião" in rel and "Rodada X Y Z" in rel, rel)
            await A.open("Ana Souza"); await pg.wait_for_timeout(500)
            rel = await pg.inner_text("#panel .relations")
            check("ficha da pessoa mostra a empresa dela", "empresa" in rel and "Empresa Y" in rel, rel)
            # lista por tipo
            await A.open("Empresa Y"); await pg.wait_for_timeout(500)
            await pg.click("#panel .rel-head:has-text('Pessoa') .rel-all"); await pg.wait_for_timeout(600)
            await pg.keyboard.press("Escape")
            await pg.click(".side-tab[data-view='tags']"); await pg.wait_for_timeout(300)
            await pg.click(".tag-row:has-text('Empresa')"); await pg.wait_for_timeout(700)
            rows = await pg.locator(".type-table tbody tr td.name").all_inner_texts()
            check("lista de empresas em tabela", any("Empresa Y" in r for r in rows) and any("Empresa X" in r for r in rows), str(rows))
            head = await pg.locator(".type-table thead").inner_text()
            check("colunas dos campos e das relações", "ramo" in head and "Pessoa" in head and "Reunião" in head, head)
            await pg.click(".type-list .tag-chip:has-text('#cliente')"); await pg.wait_for_timeout(300)
            rows = await pg.locator(".type-table tbody tr td.name").all_inner_texts()
            check("filtro por tag na lista", len(rows) == 1 and "Empresa Y" in rows[0], str(rows))
            # nota do dia
            await pg.keyboard.press("Alt+d"); await pg.wait_for_timeout(900); await A.sync()
            check("nota de hoje criada do modelo Diário", os.path.exists(os.path.join(v, f"Diário/{hoje}.md")) and "## Hoje" in read(v, f"Diário/{hoje}.md"), str(files(v)))
            # renomear empresa atualiza o campo da pessoa
            await A.open("Empresa Y"); await A.rename("Empresa Ypsilon"); await A.sync()
            check("renomear a empresa atualiza o campo empresa da pessoa", "empresa: Empresa Ypsilon" in read(v, "Pessoas/Ana Souza.md"), read(v, "Pessoas/Ana Souza.md"))
            # celular: relações abaixo da nota e lista em cartões
            await B.page.set_viewport_size({"width": 390, "height": 800}); await B.sync(); await B.page.reload(); await B.page.wait_for_timeout(2000)
            await B.open("Empresa Ypsilon"); await B.page.wait_for_timeout(800)
            inl = await B.page.inner_text("#relations-inline")
            check("celular: relações aparecem abaixo da nota", "Ana Souza" in inl and "Rodada X Y Z" in inl, inl)
            await B.page.click("#relations-inline .rel-head:has-text('Pessoa') .rel-all"); await B.page.wait_for_timeout(600)
            n = await B.page.locator(".type-card").count()
            check("celular: lista em cartões", n == 1, str(n))
        await scenario(p, "6. Modelos, relações e listas", {"Inicio.md": "# Início\n"}, relacoes)

    fails = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(fails)} de {len(RESULTS)} verificações passaram.")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
