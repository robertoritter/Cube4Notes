# Author: Roberto Ritter
# Studio: Cube4Code
# Website: https://cube4code.com
# Copyright (c) 2026 Roberto Ritter
#
# Testes "maldosos" de sincronização: dois aparelhos usando a interface real, com rede ligando e desligando,
# edições, renomeações e exclusões concorrentes. Regra verificada: nenhum texto digitado pode sumir.
# Uso: python dev/teste_sync.py  (sobe o servidor de teste sozinho; precisa de Node e Playwright)
import asyncio, os, shutil, subprocess, sys, time, glob
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 43190
URL = f"http://localhost:{PORT}/"
RESULTS = []


def all_text(vault):
    """Todo texto existente no vault, inclusive cópias de conflito e lixeira."""
    out = []
    for p in glob.glob(os.path.join(vault, "**", "*.md"), recursive=True):
        out.append(open(p, encoding="utf-8").read())
    for p in glob.glob(os.path.join(vault, ".lixeira", "**", "*.md"), recursive=True):
        out.append(open(p, encoding="utf-8").read())
    return "\n".join(out)


def files(vault):
    return sorted(os.path.relpath(p, vault) for p in glob.glob(os.path.join(vault, "**", "*.md"), recursive=True))


class Device:
    def __init__(self, ctx, page, name):
        self.ctx, self.page, self.name = ctx, page, name

    async def offline(self, v=True):
        await self.ctx.set_offline(v)

    async def sync(self):
        await self.page.keyboard.press("Control+s")
        await self.page.wait_for_timeout(1800)

    async def open(self, name):
        await self.page.keyboard.press("Escape")
        await self.page.keyboard.press("Control+k")
        await self.page.keyboard.type(name)
        await self.page.wait_for_timeout(150)
        await self.page.keyboard.press("Enter")
        await self.page.wait_for_timeout(900)

    async def append(self, text):
        p = self.page.locator(".ProseMirror p").last
        await p.click()
        await self.page.keyboard.press("End")
        await self.page.keyboard.type(" " + text, delay=8)
        await self.page.wait_for_timeout(800)

    async def rename(self, new):
        t = self.page.locator("#title")
        await t.click(); await t.fill(new); await t.press("Enter")
        await self.page.wait_for_timeout(700)

    async def delete_row(self, label):
        await self.page.locator(f".row:has(.name:text-is('{label}'))").first.click(button="right")
        await self.page.click(".menu button.danger")
        await self.page.click(".modal .btn.danger")
        await self.page.wait_for_timeout(600)

    async def rename_row(self, label, new):
        await self.page.locator(f".row:has(.name:text-is('{label}'))").first.click(button="right")
        await self.page.click(".menu button:has-text('Renomear')")
        inp = self.page.locator(".row input.rename")
        await inp.fill(new); await inp.press("Enter")
        await self.page.wait_for_timeout(600)

    async def new_note(self, title, text):
        await self.page.keyboard.press("Alt+n"); await self.page.wait_for_timeout(700)
        await self.page.keyboard.type(title); await self.page.keyboard.press("Enter")
        await self.page.wait_for_timeout(300)
        await self.page.keyboard.type(text, delay=8); await self.page.wait_for_timeout(800)


def check(name, ok, detail=""):
    RESULTS.append((name, ok, detail))
    print(f"  [{'OK ' if ok else 'FALHOU'}] {name}" + (f"\n         {detail}" if detail and not ok else ""))


async def scenario(p, title, seed, fn):
    vault = f"/tmp/c4n-sync-{len(RESULTS)}-{int(time.time()*1000)}"
    shutil.rmtree(vault, ignore_errors=True); os.makedirs(vault)
    for rel, txt in seed.items():
        os.makedirs(os.path.dirname(os.path.join(vault, rel)) or vault, exist_ok=True)
        open(os.path.join(vault, rel), "w", encoding="utf-8").write(txt)
    srv = subprocess.Popen(["node", os.path.join(ROOT, "dev/mock-server.mjs"), "--notes", vault, "--port", str(PORT), "--www", os.path.join(ROOT, "wwwroot")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    b = await p.chromium.launch()
    devs = []
    try:
        for n in ("A", "B"):
            ctx = await b.new_context(viewport={"width": 1280, "height": 800}, locale="pt-BR")
            pg = await ctx.new_page()
            pg.on("pageerror", lambda e, n=n: print(f"     erro JS em {n}: {e}"))
            await pg.goto(URL); await pg.wait_for_timeout(1500)
            devs.append(Device(ctx, pg, n))
        print(f"\n{title}")
        await fn(devs[0], devs[1], vault)
    finally:
        await b.close(); srv.terminate(); srv.wait()


async def main():
    async with async_playwright() as p:
        # 1. Mesma nota editada nos dois aparelhos offline
        async def s1(A, B, v):
            await A.open("Lista"); await B.open("Lista")
            await A.offline(); await B.offline()
            await A.append("EDICAO-A-1"); await B.append("EDICAO-B-1")
            await A.offline(False); await A.sync(); await B.offline(False); await B.sync(); await A.sync()
            txt = all_text(v)
            check("as duas edições existem no servidor", "EDICAO-A-1" in txt and "EDICAO-B-1" in txt, str(files(v)))
            check("uma cópia de conflito foi criada", any("conflito" in f for f in files(v)), str(files(v)))
        await scenario(p, "1. Mesma nota editada nos dois aparelhos sem rede", {"Lista.md": "# Lista\n\nitem base\n"}, s1)

        # 2. Renomear a mesma nota com nomes diferentes nos dois aparelhos
        async def s2(A, B, v):
            await A.open("Ideia"); await B.open("Ideia")
            await A.offline(); await B.offline()
            await A.rename("Ideia A"); await B.rename("Ideia B")
            await A.offline(False); await A.sync(); await B.offline(False); await B.sync(); await A.sync()
            txt = all_text(v); fs = files(v)
            check("conteúdo original preservado", "texto da ideia" in txt, str(fs))
            check("nenhuma nota fantasma: só um arquivo com o conteúdo", sum(1 for f in fs if "Ideia" in f) >= 1, str(fs))
            names_b = await B.page.locator(".row .name").all_inner_texts()
            check("aparelho B mostra a nota que existe no servidor", any(n in ("Ideia A", "Ideia B") for n in names_b), str(names_b))
        await scenario(p, "2. Mesma nota renomeada de jeitos diferentes", {"Ideia.md": "# Ideia\n\ntexto da ideia\n"}, s2)

        # 3. A apaga a pasta enquanto B edita uma nota dentro dela, offline
        async def s3(A, B, v):
            await B.open("Dentro"); await B.offline()
            await B.append("EDICAO-B-DENTRO")
            await A.delete_row("Projeto"); await A.sync()
            await B.offline(False); await B.sync(); await A.sync()
            check("edição de B sobrevive à exclusão da pasta", "EDICAO-B-DENTRO" in all_text(v), str(files(v)))
            check("versão antiga da pasta está na lixeira", os.path.isdir(os.path.join(v, ".lixeira")), "")
        await scenario(p, "3. Pasta apagada enquanto outro aparelho edita dentro", {"Projeto/Dentro.md": "# Dentro\n\nconteúdo\n", "Projeto/Outra.md": "# Outra\n\nx\n"}, s3)

        # 4. A apaga a nota, B editou antes (B sincroniza primeiro)
        async def s4(A, B, v):
            await A.open("Rascunho"); await B.open("Rascunho")
            await A.offline()
            await B.append("EDICAO-B-ANTES"); await B.sync()
            await A.delete_row("Rascunho")
            await A.offline(False); await A.sync()
            fs = files(v)
            check("nota mantida porque mudou antes da exclusão chegar", "Rascunho.md" in fs and "EDICAO-B-ANTES" in all_text(v), str(fs))
            await A.page.wait_for_timeout(500)
            names_a = await A.page.locator(".row .name").all_inner_texts()
            check("aparelho A recebe a nota de volta", "Rascunho" in names_a, str(names_a))
        await scenario(p, "4. Exclusão chega depois de uma edição", {"Rascunho.md": "# Rascunho\n\nbase\n"}, s4)

        # 5. A apaga, B edita offline e sincroniza depois
        async def s5(A, B, v):
            await B.open("Texto"); await B.offline()
            await B.append("EDICAO-B-DEPOIS")
            await A.delete_row("Texto"); await A.sync()
            await B.offline(False); await B.sync()
            check("edição feita offline volta mesmo após a exclusão", "EDICAO-B-DEPOIS" in all_text(v), str(files(v)))
        await scenario(p, "5. Edição offline de uma nota que foi apagada", {"Texto.md": "# Texto\n\nbase\n"}, s5)

        # 6. A edita enquanto B renomeia a mesma nota
        async def s6(A, B, v):
            await A.open("Plano"); await B.open("Plano")
            await A.offline(); await B.offline()
            await A.append("EDICAO-A-PLANO"); await B.rename("Plano Final")
            await B.offline(False); await B.sync(); await A.offline(False); await A.sync(); await B.sync()
            txt = all_text(v); fs = files(v)
            check("edição de A preservada", "EDICAO-A-PLANO" in txt, str(fs))
            check("renomeação de B aplicada", any("Plano Final" in f for f in fs), str(fs))
            check("sem duplicata: a edição foi para a nota renomeada", fs.count("Plano.md") == 0, str(fs))
            title_a = await A.page.locator("#title").input_value()
            check("aparelho A passa a mostrar o nome novo", title_a == "Plano Final", title_a)
        await scenario(p, "6. Edição e renomeação ao mesmo tempo", {"Plano.md": "# Plano\n\nbase\n"}, s6)

        # 6b. Pasta renomeada enquanto o outro edita uma nota dentro
        async def s6b(A, B, v):
            await A.open("Tarefa"); await A.offline()
            await A.append("EDICAO-A-TAREFA")
            await B.page.locator(".row.folder:has(.name:text-is('Obra'))").click()
            await B.rename_row("Obra", "Obra 2026"); await B.sync()
            await A.offline(False); await A.sync(); await B.sync()
            fs = files(v)
            check("edição de A foi para a pasta renomeada", "Obra 2026/Tarefa.md" in fs and "EDICAO-A-TAREFA" in open(os.path.join(v, "Obra 2026/Tarefa.md"), encoding="utf-8").read(), str(fs))
            check("pasta antiga não foi recriada", not any(f.startswith("Obra/") for f in fs), str(fs))
        await scenario(p, "6b. Pasta renomeada enquanto outro aparelho edita dentro", {"Obra/Tarefa.md": "# Tarefa\n\nbase\n", "Obra/Orcamento.md": "# Orcamento\n"}, s6b)

        # 7. Mesmo nome de nota nova criado nos dois aparelhos
        async def s7(A, B, v):
            await A.offline(); await B.offline()
            await A.new_note("Reuniao", "PAUTA-A"); await B.new_note("Reuniao", "PAUTA-B")
            await A.offline(False); await A.sync(); await B.offline(False); await B.sync()
            txt = all_text(v)
            check("as duas notas novas existem", "PAUTA-A" in txt and "PAUTA-B" in txt, str(files(v)))
        await scenario(p, "7. Nota nova com o mesmo nome nos dois aparelhos", {"Inicio.md": "# Inicio\n"}, s7)

        # 8. Muitas edições offline, fechar e reabrir o navegador, depois sincronizar
        async def s8(A, B, v):
            await A.open("Diario"); await A.offline()
            for i in range(5): await A.append(f"LINHA-{i}")
            await A.page.reload(); await A.page.wait_for_timeout(1500)
            await A.offline(False); await A.sync()
            txt = all_text(v)
            check("5 edições offline sobrevivem ao recarregar e chegam ao servidor", all(f"LINHA-{i}" in txt for i in range(5)), txt[-200:])
        await scenario(p, "8. Várias edições offline e reabertura do navegador", {"Diario.md": "# Diario\n\ninicio\n"}, s8)

    fails = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(fails)} de {len(RESULTS)} verificações passaram.")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
