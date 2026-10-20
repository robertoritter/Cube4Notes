# Author: Roberto Ritter
# Studio: Cube4Code
# Website: https://cube4code.com
# Copyright (c) 2026 Roberto Ritter
#
# Teste do app sem servidor (como na rua): a interface fica guardada no aparelho, abre rápido mesmo
# quando o endereço do servidor não responde, e edições feitas assim continuam guardadas.
# Uso: python dev/teste_offline.py (precisa de Node e Playwright)
import asyncio, os, shutil, subprocess, time, socket, threading
from playwright.async_api import async_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT=43196; URL=f"http://localhost:{PORT}/"
import tempfile; base=os.path.join(tempfile.gettempdir(), "c4n-off"); shutil.rmtree(base, ignore_errors=True); os.makedirs(f"{base}/n")
open(f"{base}/n/Lista.md","w").write("# Lista\n\n- leite\n\n```python\nprint(1)\n```\n")
R=[]
def check(n, ok, d=""): R.append(ok); print(f"  [{'OK ' if ok else 'FALHOU'}] {n}" + (f"  {d}" if not ok else ""))
def blackhole():
    # aceita conexões e nunca responde (como um endereço que não existe fora de casa)
    s=socket.socket(); s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1); s.bind(("127.0.0.1",PORT)); s.listen(50)
    conns=[]
    while True:
        c,_=s.accept(); conns.append(c)
async def main():
    srv=subprocess.Popen(["node",f"{ROOT}/dev/mock-server.mjs","--notes",f"{base}/n","--port",str(PORT),"--www",f"{ROOT}/wwwroot"],stdout=subprocess.DEVNULL); time.sleep(0.8)
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(locale="pt-BR"); pg=await ctx.new_page()
        await pg.goto(URL); await pg.wait_for_timeout(2500)
        await pg.evaluate("navigator.serviceWorker.ready")
        await pg.wait_for_timeout(4000)
        n=await pg.evaluate("caches.keys().then(async ks => { let t=0; for (const k of ks) t += (await (await caches.open(k)).keys()).length; return t; })")
        check("interface inteira guardada no aparelho", n > 100, str(n))
        srv.terminate(); srv.wait()
        threading.Thread(target=blackhole, daemon=True).start(); time.sleep(0.3)
        t0=time.time(); await pg.goto(URL, timeout=30000); 
        await pg.wait_for_selector(".tree .row", timeout=15000); dt=time.time()-t0
        check("abre sem servidor (endereço que não responde)", True)
        check(f"abre rápido ({dt:.1f}s)", dt < 8, f"{dt:.1f}s")
        await pg.click(".tree .row:has-text('Lista')"); await pg.wait_for_timeout(1500)
        await pg.click("#editor-host .ProseMirror"); await pg.keyboard.press("Control+End"); await pg.keyboard.type("\nEDITADO-NA-RUA", delay=5); await pg.wait_for_timeout(1500)
        txt=await pg.evaluate("document.querySelector('#editor-host').innerText")
        check("edita sem servidor", "EDITADO-NA-RUA" in txt)
        await pg.reload(); await pg.wait_for_selector(".tree .row", timeout=15000); await pg.wait_for_timeout(1000)
        pend=await pg.evaluate("document.querySelector('#sync-pill').innerText")
        check("edição continua guardada após reabrir", "pendente" in pend, pend)
        await b.close()
    print(f"\n{sum(R)} de {len(R)} verificações passaram.")
asyncio.run(main())
