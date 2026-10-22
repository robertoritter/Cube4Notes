# Author: Roberto Ritter
# Studio: Cube4Code
# Website: https://cube4code.com
# Copyright (c) 2026 Roberto Ritter
#
# Teste da troca para o endereço pelo nome do computador: o aparelho abre pelo IP, o app testa o nome,
# oferece a troca e o mesmo aparelho passa a usar o nome, sem QR novo e sem virar outro aparelho.
# Aqui "127.0.0.1" faz o papel do IP e "localhost" o do nome (computador.local).
# Uso: python dev/test_name_address.py  (precisa de Node, Playwright e openssl)
import asyncio, json, os, shutil, ssl, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 43215
R = []


def check(name, ok, detail=""):
    R.append(ok); print(f"  [{'OK ' if ok else 'FALHOU'}] {name}" + (f"  {detail}" if not ok else ""))


def certs(d):
    """Autoridade e certificado de teste para localhost e 127.0.0.1."""
    ca_cnf = os.path.join(d, "ca.cnf")
    open(ca_cnf, "w").write("[req]\ndistinguished_name=dn\nx509_extensions=v3\nprompt=no\n[dn]\nCN=Teste CA\n[v3]\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\nsubjectKeyIdentifier=hash\n")
    run = lambda *a: subprocess.run(a, cwd=d, check=True, capture_output=True)
    run("openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "ca.key", "-out", "ca.pem", "-days", "2", "-config", "ca.cnf")
    run("openssl", "req", "-newkey", "rsa:2048", "-nodes", "-keyout", "k.pem", "-out", "r.csr", "-subj", "/CN=Cube4Notes")
    open(os.path.join(d, "ext.cnf"), "w").write("subjectAltName=DNS:localhost,IP:127.0.0.1\nbasicConstraints=CA:FALSE\nextendedKeyUsage=serverAuth\nkeyUsage=digitalSignature,keyEncipherment\n")
    run("openssl", "x509", "-req", "-in", "r.csr", "-CA", "ca.pem", "-CAkey", "ca.key", "-CAcreateserial", "-out", "c.pem", "-days", "2", "-extfile", "ext.cnf")
    run("openssl", "x509", "-in", "ca.pem", "-outform", "der", "-out", "ca.der")


async def main():
    d = tempfile.mkdtemp(prefix="c4n-endereco-")
    certs(d)
    vault = os.path.join(d, "notas"); os.makedirs(vault)
    open(os.path.join(vault, "Lista.md"), "w", encoding="utf-8").write("# Lista\n\nleite\n")
    srv = subprocess.Popen(["node", os.path.join(ROOT, "dev/mock-server.mjs"), "--notes", vault, "--port", str(PORT), "--www", os.path.join(ROOT, "wwwroot"),
                            "--cert", os.path.join(d, "c.pem"), "--key", os.path.join(d, "k.pem"), "--ca", os.path.join(d, "ca.der"),
                            "--host-url", f"https://localhost:{PORT}/"], stdout=subprocess.DEVNULL)
    time.sleep(1.5)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            pg = await (await b.new_context(ignore_https_errors=True, locale="pt-BR", viewport={"width": 390, "height": 780})).new_page()
            await pg.goto(f"https://127.0.0.1:{PORT}/"); await pg.wait_for_timeout(6000)
            offer = await pg.locator(".modal.small h2").all_inner_texts()
            check("aparelho no endereço por IP recebe a oferta do nome", any("localhost" in o for o in offer), str(offer))
            await pg.click(".modal.small .btn.primary"); await pg.wait_for_timeout(5000)
            check("passa para o endereço pelo nome", pg.url.startswith(f"https://localhost:{PORT}/"), pg.url)
            await pg.click(".sidebar-toggle"); await pg.wait_for_timeout(400)
            check("conectado e com as notas, sem QR novo", "Lista" in await pg.locator(".tree .row").all_inner_texts())
            await pg.reload(); await pg.wait_for_timeout(4000)
            check("não oferece de novo no endereço pelo nome", await pg.locator(".modal.small").count() == 0)
            await b.close()
        devs = json.load(open(os.path.join(vault, ".cube4notes", "devices.json")))
        check("continua sendo o mesmo aparelho (sem duplicar)", len(devs) == 1 and len(devs[0].get("moreHashes") or []) == 1, str(devs))
        ctx = ssl._create_unverified_context()
        req = urllib.request.Request(f"https://localhost:{PORT}/api/pair", method="POST", data=json.dumps({"transfer": "x" * 24, "deviceName": "x"}).encode(),
                                     headers={"Content-Type": "application/json"})
        try: urllib.request.urlopen(req, context=ctx); st = 200
        except urllib.error.HTTPError as e: st = e.code
        check("transferência inventada é recusada", st == 403, str(st))
    finally:
        srv.terminate(); srv.wait(); shutil.rmtree(d, ignore_errors=True)
    print(f"\n{sum(R)} de {len(R)} verificações passaram.")
    return 0 if all(R) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
