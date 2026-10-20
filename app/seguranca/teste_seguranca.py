# Author: Roberto Ritter
# Studio: Cube4Code
# Website: https://cube4code.com
# Copyright (c) 2026 Roberto Ritter
#
# Bateria de testes de segurança do Cube4Notes (OWASP Top 10) contra um servidor em execução.
"""Bateria de testes de segurança do Cube4Notes (baseada no OWASP Top 10).

Roda contra um servidor em execução, sem dependências além do Python 3.

    python seguranca/teste_seguranca.py --lan https://192.168.0.10:43125

--url  endereço local (padrão https://localhost:43125): testa como o próprio computador do servidor.
--lan  endereço de rede do mesmo computador: o servidor enxerga como outro aparelho da rede.

O teste cria uma pasta "_teste_seguranca" (enviada à .lixeira no fim) e dois aparelhos de teste (removidos no fim).
O teste de força bruta bloqueia o endereço --lan por 10 minutos; use --sem-forca-bruta para pular.
"""
from __future__ import annotations

import argparse
import http.client
import ssl
import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)
import json
import sys
import urllib.parse

RESULTS: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> bool:
    RESULTS.append((name, ok, detail))
    print(f"  [{'OK ' if ok else 'FALHOU'}] {name}" + (f"  ({detail})" if detail and not ok else ""))
    return ok


class Client:
    ctx: ssl.SSLContext | None = None

    def __init__(self, base: str):
        u = urllib.parse.urlsplit(base)
        self.https = u.scheme == "https"
        self.scheme = u.scheme
        self.host, self.port = u.hostname, u.port or (443 if self.https else 80)
        self.netloc = u.netloc

    def req(self, method: str, path: str, body=None, token: str | None = None, headers: dict | None = None, raw: bytes | None = None):
        h = {"Host": self.netloc}
        if body is not None:
            raw = json.dumps(body).encode()
            h["Content-Type"] = "application/json"
            h["Origin"] = f"{self.scheme}://{self.netloc}"
        if raw is not None and "Origin" not in h:
            h["Origin"] = f"{self.scheme}://{self.netloc}"
        if token:
            h["Authorization"] = "Bearer " + token
        h.update(headers or {})
        c = http.client.HTTPSConnection(self.host, self.port, timeout=15, context=Client.ctx) if self.https else http.client.HTTPConnection(self.host, self.port, timeout=15)
        try:
            c.request(method, path, body=raw, headers=h)
            r = c.getresponse()
            data = r.read()
            return r.status, {k.lower(): v for k, v in r.getheaders()}, data
        finally:
            c.close()

    def json(self, *a, **k):
        s, h, d = self.req(*a, **k)
        try:
            return s, json.loads(d or b"null")
        except ValueError:
            return s, None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="https://localhost:43125")
    ap.add_argument("--ca", help="certificado da autoridade do Cube4Notes; se omitido, é baixado pela porta HTTP")
    ap.add_argument("--lan", required=True)
    ap.add_argument("--sem-forca-bruta", action="store_true")
    a = ap.parse_args()
    loc, lan = Client(a.url), Client(a.lan)

    if loc.https:
        print("\nA02 Criptografia: HTTPS")
        plain = http.client.HTTPConnection(loc.host, loc.port - 1, timeout=15)
        plain.request("GET", "/qualquer?x=1", headers={"Host": f"{loc.host}:{loc.port - 1}"})
        r = plain.getresponse(); r.read()
        check("porta HTTP redireciona para HTTPS", r.status in (301, 302, 307, 308) and (r.getheader("Location") or "").startswith("https://"), f"{r.status} {r.getheader('Location')}")
        if a.ca:
            der = open(a.ca, "rb").read()
        else:
            plain = http.client.HTTPConnection(loc.host, loc.port - 1, timeout=15)
            plain.request("GET", "/cube4notes-ca.cer", headers={"Host": f"{loc.host}:{loc.port - 1}"})
            r = plain.getresponse(); der = r.read()
            check("certificado da autoridade disponível para instalar", r.status == 200 and "x509" in (r.getheader("Content-Type") or ""), str(r.status))
        ctx = ssl.create_default_context()
        try:
            ctx.load_verify_locations(cadata=der if der[:1] != b"-" else der.decode())
        except ssl.SSLError as e:
            check("certificado da autoridade é válido", False, str(e)); return report()
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        Client.ctx = ctx
        for c, label in ((loc, "localhost"), (lan, "endereço de rede")):
            try:
                with ssl.create_connection((c.host, c.port), timeout=10) as raw, ctx.wrap_socket(raw, server_hostname=c.host) as tls:
                    ok = tls.version() in ("TLSv1.2", "TLSv1.3")
                    check(f"HTTPS válido e verificado no {label} ({tls.version()})", ok, tls.version() or "")
            except (ssl.SSLError, OSError) as e:
                check(f"HTTPS válido e verificado no {label}", False, str(e))
        old = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT); old.check_hostname = False; old.verify_mode = ssl.CERT_NONE
        old.maximum_version = ssl.TLSVersion.TLSv1_1
        try:
            old.minimum_version = ssl.TLSVersion.TLSv1
            with ssl.create_connection((loc.host, loc.port), timeout=10) as raw, old.wrap_socket(raw, server_hostname=loc.host):
                check("TLS 1.0/1.1 recusados", False, "servidor aceitou TLS antigo")
        except (ssl.SSLError, OSError, ValueError):
            check("TLS 1.0/1.1 recusados", True)

    print("\nA05 Configuração: cabeçalhos de segurança")
    s, h, _ = loc.req("GET", "/")
    check("página inicial responde", s == 200, str(s))
    csp = h.get("content-security-policy", "")
    check("Content-Security-Policy sem scripts externos nem inline", "script-src 'self'" in csp and "unsafe-eval" not in csp and "frame-ancestors 'none'" in csp, csp)
    check("X-Frame-Options DENY (clickjacking)", h.get("x-frame-options") == "DENY")
    check("X-Content-Type-Options nosniff", h.get("x-content-type-options") == "nosniff")
    check("Referrer-Policy no-referrer", h.get("referrer-policy") == "no-referrer")
    s, h, _ = loc.req("GET", "/api/status")
    check("API não é guardada em cache", "no-store" in h.get("cache-control", ""))

    print("\nA01 Controle de acesso: DNS rebinding e CSRF")
    for evil in ["evil.example", "attacker.local", "127.0.0.1.nip.io"]:
        s, _, _ = loc.req("GET", "/", headers={"Host": evil + ":43125"})
        check(f"Host falso '{evil}' recusado", s in (400, 421), str(s))
    s, _, _ = loc.req("POST", "/api/pair", body={"deviceName": "x"}, headers={"Origin": "http://evil.example"})
    check("pareamento vindo de outro site recusado (Origin)", s == 403, str(s))
    s, _, _ = loc.req("POST", "/api/pair", raw=b'{"deviceName":"x"}', headers={"Origin": "null", "Content-Type": "text/plain"})
    check("pareamento com Origin null recusado", s == 403, str(s))

    s, j = loc.json("POST", "/api/pair", body={"deviceName": "teste-seguranca-local"})
    if not check("pareamento automático no próprio computador", s == 200 and j and j.get("token"), str(s)):
        return report()
    tok, dev_a = j["token"], j["deviceId"]
    s, j = loc.json("GET", "/api/vaults", token=tok)
    if not check("lista de vaults do aparelho", s == 200 and j.get("vaults"), str(s)):
        return report()
    vid = j["vaults"][0]["id"]
    V = "/api/v/" + urllib.parse.quote(vid)

    print("\nA07 Autenticação")
    for method, path, body in [("GET", V + "/manifest", None), ("POST", V + "/fetch", {"paths": []}), ("POST", V + "/sync", {"ops": []}),
                               ("GET", V + "/raw?path=x.png", None), ("GET", "/api/vaults", None), ("POST", "/api/admin/invite", {}), ("GET", "/api/admin/devices", None),
                               ("POST", "/api/admin/vaults", {"name": "x", "path": "/tmp/x"}), ("GET", "/api/admin/browse", None)]:
        s, _, _ = loc.req(method, path, body=body)
        check(f"sem token: {method} {path.split('?')[0]} -> 401", s == 401, str(s))
    s, _, _ = loc.req("GET", V + "/manifest", token="0" * 64)
    check("token inválido -> 401", s == 401, str(s))
    s, _, _ = loc.req("GET", V + "/manifest?t=" + tok)
    check("token na URL não é aceito", s == 401, str(s))
    s, _, _ = loc.req("GET", V + "/manifest", token="a" * 5000)
    check("token gigante -> 401", s == 401, str(s))
    s, _, _ = loc.req("GET", V + "/manifest", token=tok)
    check("token válido -> 200", s == 200, str(s))

    print("\nA01 Controle de acesso: caminhos (path traversal)")
    base = "_teste_seguranca"
    s, j = loc.json("POST", V + "/sync", body={"ops": [{"id": 1, "type": "mkdir", "path": base}, {"id": 2, "type": "put", "path": base + "/ok.md", "content": "ok", "baseVersion": None}]}, token=tok)
    check("escrita normal funciona", s == 200 and all(r["status"] == "applied" for r in j["results"]), str(j))
    evil_paths = ["../fora.md", "..\\fora.md", "a/../../fora.md", "/etc/passwd.md", "C:\\Windows\\win.ini.md", "C:/x.md",
                  "\\\\servidor\\share\\x.md", ".cube4notes/devices.md", "nota.md:fluxo.md", "CON.md", "aux.md", "com1.md",
                  "x/./y.md", "a\u0000b.md", "<script>.md", base + "/../../fora.md"]
    s, j = loc.json("POST", V + "/sync", body={"ops": [{"id": i, "type": "put", "path": p, "content": "x", "baseVersion": None} for i, p in enumerate(evil_paths)]}, token=tok)
    bad = [evil_paths[r["id"]] for r in (j or {}).get("results", []) if r["status"] != "error"]
    check(f"{len(evil_paths)} caminhos maliciosos recusados na escrita", s == 200 and not bad, "aceitos: " + ", ".join(bad))
    s, j = loc.json("POST", V + "/fetch", body={"paths": ["../Cube4Notes/README.md", ".cube4notes/devices.json", "../../Windows/win.ini"]}, token=tok)
    check("leitura fora da pasta devolve nada", s == 200 and j["files"] == [], str(j))
    for p in [".cube4notes/devices.json", "../devices.json", "..%2f..%2fwindows%2fwin.ini", "C:\\Windows\\win.ini"]:
        s, _, _ = loc.req("GET", V + "/raw?path=" + urllib.parse.quote(p), token=tok)
        check(f"arquivo bruto '{p}' bloqueado", s == 404, str(s))
    s, j = loc.json("POST", V + "/sync", body={"ops": [{"id": 1, "type": "move", "from": base, "to": "../fora"}, {"id": 2, "type": "rmdir", "path": ""},
                                                       {"id": 3, "type": "move", "from": base, "to": base + "/dentro"}, {"id": 4, "type": "mkdir", "path": ".oculta"}]}, token=tok)
    check("mover/apagar raiz, sair da pasta ou criar oculta recusado", s == 200 and all(r["status"] == "error" for r in j["results"]), str(j))
    s, _, d = loc.req("GET", V + "/manifest", token=tok)
    check("pasta interna .cube4notes não aparece na listagem", b".cube4notes" not in d and b"devices.json" not in d)

    print("\nA03 Injeção / A04 Design: anexos")
    png = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4b40000000049454e44ae426082")
    for name in ["ataque.html", "ataque.svg", "ataque.js", "ataque.exe", "ataque.md"]:
        s, _, _ = loc.req("POST", V + "/attachment?name=" + name, raw=b"<script>alert(1)</script>", token=tok, headers={"Content-Type": "application/octet-stream"})
        check(f"anexo '{name}' recusado", s == 415, str(s))
    s, j = loc.json("POST", V + "/attachment?name=" + urllib.parse.quote("../../fora.png"), raw=png, token=tok, headers={"Content-Type": "application/octet-stream"})
    check("nome de anexo com ../ fica dentro de anexos/", s == 200 and j["path"].startswith("anexos/") and ".." not in j["path"], str(j))
    if s == 200:
        s, h, _ = loc.req("GET", V + "/raw?path=" + urllib.parse.quote(j["path"]), token=tok)
        check("imagem servida em sandbox e nosniff", s == 200 and "sandbox" in h.get("content-security-policy", "") and h.get("x-content-type-options") == "nosniff", str(h))
    s, h, _ = loc.req("GET", V + "/raw?path=" + urllib.parse.quote(base + "/ok.md"), token=tok)
    check("arquivo que não é imagem baixa como anexo (não abre como página)", s == 200 and "attachment" in h.get("content-disposition", "") and "html" not in h.get("content-type", ""), str(h))
    s, _, _ = loc.req("POST", V + "/attachment?name=vazio.png", raw=b"", token=tok, headers={"Content-Type": "application/octet-stream"})
    check("anexo vazio recusado", s == 400, str(s))

    print("\nA04 Limites (negação de serviço)")
    s, _, _ = loc.req("POST", V + "/sync", body={"ops": [{"id": i, "type": "mkdir", "path": base} for i in range(501)]}, token=tok)
    check("mais de 500 operações por lote recusado", s == 400, str(s))
    s, _, _ = loc.req("POST", V + "/fetch", body={"paths": ["a.md"] * 501}, token=tok)
    check("mais de 500 leituras por lote recusado", s == 400, str(s))
    s, j = loc.json("POST", V + "/sync", body={"ops": [{"id": 1, "type": "put", "path": base + "/grande.md", "content": "x" * 10_000_001, "baseVersion": None}]}, token=tok)
    check("nota acima de 10 MB recusada", s in (200, 413) and (s == 413 or j["results"][0]["status"] == "error"), str(s))

    print("\nA09 / A05 Mensagens de erro não vazam detalhes internos")
    s, _, d = loc.req("POST", V + "/sync", raw=b"{nao e json", token=tok, headers={"Content-Type": "application/json"})
    leaks = [w for w in [b"Exception", b"   at ", b"C:\\", b"/home/", b"/Users/"] if w in d]
    check("JSON inválido não mostra stack trace nem caminhos", s == 400 and not leaks, f"{s} {leaks}")

    print("\nA01 / A07 Rede local: pareamento por convite")
    s, j = lan.json("GET", "/api/status")
    check("pelo endereço de rede o servidor não trata como computador local", s == 200 and j["loopback"] is False and j["admin"] is False, str(j))
    s, _, _ = lan.req("POST", "/api/pair", body={"deviceName": "intruso"})
    check("pela rede, parear sem convite recusado", s == 403, str(s))
    s, j = loc.json("POST", "/api/admin/invite", body={"vaults": [vid], "admin": False}, token=tok)
    check("no computador local, convite é gerado", s == 200 and j["addresses"], str(s))
    code = urllib.parse.urlsplit(j["addresses"][0]["url"]).fragment.split("=", 1)[1] if s == 200 and j["addresses"] else ""
    check("convite tem pelo menos 128 bits", len(code) >= 22, code)
    s, j = lan.json("POST", "/api/pair", body={"invite": code, "deviceName": "teste-seguranca-rede"})
    ok = check("pela rede, convite válido conecta", s == 200 and j.get("token"), str(s))
    tok_b, dev_b = (j["token"], j["deviceId"]) if ok else ("", "")
    s, _, _ = lan.req("POST", "/api/pair", body={"invite": code, "deviceName": "segundo"})
    check("o mesmo convite não funciona duas vezes", s == 403, str(s))
    if ok:
        s, _, _ = lan.req("GET", V + "/manifest", token=tok_b)
        check("aparelho de rede acessa o vault liberado", s == 200, str(s))
        s, _, _ = lan.req("POST", "/api/admin/invite", body={}, token=tok_b)
        check("aparelho sem admin não gera convite", s == 403, str(s))
        s, _, _ = lan.req("GET", "/api/admin/devices", token=tok_b)
        check("aparelho sem admin não lista aparelhos", s == 403, str(s))
        s, _, _ = lan.req("PATCH", "/api/admin/devices/" + dev_b, body={"admin": True}, token=tok_b)
        check("aparelho sem admin não se promove a admin", s == 403, str(s))
        s, _, _ = lan.req("DELETE", "/api/admin/devices/" + dev_a, token=tok_b)
        check("aparelho sem admin não remove outro aparelho", s == 403, str(s))
        s, _, _ = lan.req("POST", "/api/admin/vaults", body={"name": "raiz", "path": "C:\\"}, token=tok_b)
        check("aparelho sem admin não cria vault", s == 403, str(s))
        s, _, _ = lan.req("GET", "/api/admin/browse?path=/", token=tok_b)
        check("aparelho sem admin não navega nas pastas do servidor", s == 403, str(s))
        s, _, _ = lan.req("PATCH", "/api/admin/server", body={"mode": "pessoal"}, token=tok_b)
        check("aparelho sem admin não muda o modo do servidor", s == 403, str(s))
        s, _, _ = lan.req("GET", "/api/v/vault-que-nao-existe/manifest", token=tok_b)
        check("vault inexistente -> 404", s == 404, str(s))
        s, _, _ = lan.req("GET", "/api/v/..%2F..%2Fwindows/manifest", token=tok_b)
        check("id de vault com ../ -> 404", s in (400, 404), str(s))
        s, j3 = loc.json("POST", "/api/admin/vaults", body={"name": "teste-seguranca-2", "path": ""}, token=tok)
        check("vault com caminho vazio recusado", s == 400, str(s))
        s, _, _ = loc.req("POST", "/api/setup", body={"code": "", "mode": "pessoal", "vaultPath": "/tmp/x"})
        check("assistente de configuração não roda de novo", s in (409, 403), str(s))
        s, _, _ = loc.req("DELETE", "/api/admin/devices/" + dev_b, token=tok)
        check("remover aparelho no computador local", s == 200, str(s))
        s, _, _ = lan.req("GET", V + "/manifest", token=tok_b)
        check("aparelho removido perde o acesso na hora", s == 401, str(s))

    s, j = loc.json("POST", "/api/admin/invite", body={}, token=tok)
    short = j.get("shortCode", "") if s == 200 else ""
    check("convite tem código curto de 6 caracteres", len(short) == 6, short)
    if short:
        s, j2 = lan.json("POST", "/api/pair", body={"invite": short[:3].lower() + " " + short[3:].lower(), "deviceName": "teste-codigo-curto"})
        ok2 = check("pela rede, código curto digitado (minúsculas e espaço) conecta", s == 200 and j2.get("token"), str(s))
        s, _, _ = lan.req("POST", "/api/pair", body={"invite": short, "deviceName": "segundo"})
        check("código curto não funciona duas vezes", s == 403, str(s))
        if ok2:
            loc.req("DELETE", "/api/admin/devices/" + j2["deviceId"], token=tok)

    if not a.sem_forca_bruta:
        print("\nA07 Força bruta no convite")
        codes = [lan.req("POST", "/api/pair", body={"invite": f"chute{i:017d}", "deviceName": "x"})[0] for i in range(12)]
        check("após 10 erros o endereço é bloqueado (429)", codes[-1] == 429, str(codes))

    print("\nLimpeza")
    loc.json("POST", V + "/sync", body={"ops": [{"id": 1, "type": "rmdir", "path": base}]}, token=tok)
    s, _, _ = loc.req("DELETE", "/api/admin/devices/" + dev_a, token=tok)
    check("aparelho de teste local removido", s == 200, str(s))
    return report()


def report() -> int:
    fails = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(fails)} de {len(RESULTS)} verificações passaram.")
    for n, _, d in fails:
        print(f"  FALHOU: {n} {d}")
    print("Obs.: o anexo de teste 'anexos/fora.png' fica na pasta de notas; pode apagar.")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
