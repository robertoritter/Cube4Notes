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

    fails = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(fails)} de {len(RESULTS)} verificações passaram.")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
