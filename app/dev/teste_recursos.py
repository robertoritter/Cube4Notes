# Author: Roberto Ritter
# Studio: Cube4Code
# Website: https://cube4code.com
# Copyright (c) 2026 Roberto Ritter
#
# Testes dos recursos de edição: links entre notas, anexos offline, histórico de versões, tags e propriedades,
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

    fails = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(fails)} de {len(RESULTS)} verificações passaram.")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
