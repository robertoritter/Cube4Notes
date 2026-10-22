# Author: Roberto Ritter
# Studio: Cube4Code
# Website: https://cube4code.com
# Copyright (c) 2026 Roberto Ritter
#
# Testa o executável gerado (Windows, Linux ou macOS) do jeito que um usuário novo usaria: primeira execução
# numa pasta só de leitura, configuração pela rede com o código, configuração no próprio computador, interface,
# certificado, criação de nota no disco e uma segunda partida com a configuração já existente.
# Só usa a biblioteca padrão do Python. Uso: python dev/test_executable.py <caminho do Cube4Notes>
import json, os, re, shutil, socket, ssl, stat, subprocess, sys, tempfile, time, urllib.error, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from testport import free_port  # noqa: E402
PORT = free_port()
CTX = ssl.create_default_context(); CTX.check_hostname = False; CTX.verify_mode = ssl.CERT_NONE
RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append(ok)
    print(f"  [{'OK ' if ok else 'FALHOU'}] {name}" + (f"\n         {detail}" if detail and not ok else ""), flush=True)
    return ok


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None


def call(url, body=None, token=None, follow=True):
    headers = {"Content-Type": "application/json"} if body is not None else {}
    if token: headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, headers=headers, method="POST" if body is not None else "GET")
    handlers = [urllib.request.HTTPSHandler(context=CTX)] + ([] if follow else [NoRedirect()])
    try:
        with urllib.request.build_opener(*handlers).open(req, timeout=10) as r:
            return r.status, r.read(), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read(), dict(e.headers)


def wait_status(base, want_setup, proc, seconds=90):
    end = time.time() + seconds
    while time.time() < end:
        if proc.poll() is not None: return None
        try:
            code, data, _ = call(base + "/api/status")
            if code == 200:
                st = json.loads(data)
                if want_setup is None or st.get("setup") == want_setup: return st
        except Exception:
            pass
        time.sleep(0.5)
    return None


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(("10.255.255.255", 1)); ip = s.getsockname()[0]; s.close()
        return ip if re.match(r"^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)", ip) else None
    except OSError:
        return None


def start(exe, cfg, log):
    args = [exe, "--config", cfg, "--no-window", "--no-browser", "--no-firewall", "--no-cert-install", "--port", str(PORT)]
    env = {**os.environ, "CUBE4NOTES_LANG": "en"}
    return subprocess.Popen(args, stdout=log, stderr=subprocess.STDOUT, env=env, cwd=tempfile.gettempdir())


def stop(proc):
    if proc.poll() is None:
        proc.terminate()
        try: proc.wait(15)
        except subprocess.TimeoutExpired: proc.kill(); proc.wait(5)


def main():
    if len(sys.argv) < 2: print(__doc__ or "uso: test_executable.py <executável>"); return 2
    src = os.path.abspath(sys.argv[1])
    work = tempfile.mkdtemp(prefix="c4n-exe-")
    bindir, cfg, vault = os.path.join(work, "programa"), os.path.join(work, "config"), os.path.join(work, "notas")
    os.makedirs(bindir)
    exe = os.path.join(bindir, os.path.basename(src))
    shutil.copy2(src, exe)
    posix = os.name == "posix"
    if posix:  # como em /opt: o programa não pode escrever na própria pasta
        os.chmod(exe, 0o755); os.chmod(bindir, 0o555)
    before = sorted(os.listdir(bindir))
    logpath = os.path.join(work, "saida.txt")
    log = open(logpath, "w")
    base, http = f"https://127.0.0.1:{PORT}", f"http://127.0.0.1:{PORT - 1}"
    proc = start(exe, cfg, log)
    try:
        print("Primeira execução (assistente de configuração)")
        st = wait_status(base, True, proc)
        out = open(logpath, encoding="utf-8", errors="replace").read()
        if not check("inicia e responde em HTTPS no modo de configuração", st is not None, out[-3000:]): return 1
        m = re.search(r"setup code: ([A-Z0-9]{4,8})", out)
        check("mostra o código de configuração", m is not None, out[-1500:])
        ip = lan_ip()
        if ip and m:
            lan = f"https://{ip}:{PORT}"
            code, _, _ = call(lan + "/api/setup/browse?code=ERRADO")
            check(f"pela rede ({ip}), código errado é recusado", code == 403, str(code))
            code, data, _ = call(lan + "/api/setup/browse?code=" + m.group(1))
            check("pela rede, o código certo lista as pastas do servidor", code == 200 and b"entries" in data, f"{code} {data[:200]!r}")
        else:
            print("  (sem IP de rede local: teste pela rede pulado)")
        code, data, _ = call(base + "/api/setup", {"mode": "rede", "serverName": "Teste", "vaultName": "Notes", "vaultPath": vault, "deviceName": "Teste"})
        ok = check("configura pelo próprio computador", code == 200 and b"token" in data, f"{code} {data[:300]!r}")
        token = json.loads(data)["token"] if ok else ""
        st = wait_status(base, False, proc)
        out = open(logpath, encoding="utf-8", errors="replace").read()
        check("reinicia já configurado", st is not None, out[-3000:])
        code, data, headers = call(base + "/")
        check("entrega a interface embutida", code == 200 and b"<html" in data.lower() and "text/html" in headers.get("Content-Type", ""), f"{code} {data[:120]!r}")
        code, data, _ = call(http + "/cube4notes-ca.cer")
        check("certificado para os aparelhos em HTTP", code == 200 and data[:1] == b"\x30", f"{code} {data[:20]!r}")
        code, pem, _ = call(http + "/cube4notes-ca.pem")
        ok = check("certificado em PEM para agentes (Node, Python, curl)", code == 200 and pem.startswith(b"-----BEGIN CERTIFICATE-----"), f"{code} {pem[:40]!r}")
        if ok:
            # como um agente de IA faria: verificação completa do certificado, confiando só na autoridade do Cube4Notes
            strict = ssl.create_default_context(cadata=pem.decode())
            try:
                with urllib.request.build_opener(urllib.request.HTTPSHandler(context=strict)).open(base + "/api/status", timeout=10) as r:
                    check("conexão HTTPS verificada com a autoridade do Cube4Notes", r.status == 200)
            except Exception as e:
                check("conexão HTTPS verificada com a autoridade do Cube4Notes", False, repr(e))
        code, _, headers = call(http + "/", follow=False)
        check("HTTP redireciona para HTTPS", code in (301, 302, 307, 308) and headers.get("Location", "").startswith("https://"), f"{code} {headers.get('Location')}")
        code, data, _ = call(base + "/api/vaults", token=token)
        vaults = json.loads(data) if code == 200 else []
        vaults = vaults.get("vaults", vaults) if isinstance(vaults, dict) else vaults
        check("lista o vault criado", code == 200 and len(vaults) == 1, f"{code} {data[:200]!r}")
        if vaults:
            vid = vaults[0]["id"]
            code, data, _ = call(f"{base}/api/v/{vid}/sync", {"ops": [{"id": 1, "type": "put", "path": "Teste do executável.md", "content": "# Funciona\n\nOlá, ação.\n"}]}, token=token)
            path = os.path.join(vault, "Teste do executável.md")
            check("cria a nota no disco (nome e texto com acentos)", code == 200 and os.path.exists(path) and "Olá, ação." in open(path, encoding="utf-8").read(), f"{code} {data[:300]!r}")
            code, data, _ = call(f"{base}/api/v/{vid}/manifest", token=token)
            check("a nota aparece na lista do servidor", code == 200 and "Teste do executável.md" in data.decode("utf-8"), f"{code}")
        code, _, _ = call(base + "/api/vaults")
        check("sem token, a API recusa", code == 401, str(code))
        check("não escreve nada na pasta do programa", sorted(os.listdir(bindir)) == before, str(os.listdir(bindir)))
        stop(proc)
        print("Segunda execução (configuração e certificado já existentes)")
        proc = start(exe, cfg, log)
        st = wait_status(base, False, proc)
        out = open(logpath, encoding="utf-8", errors="replace").read()
        check("inicia de novo com a configuração existente", st is not None, out[-3000:])
        code, _, _ = call(base + "/api/vaults", token=token)
        check("o aparelho continua conectado", code == 200, str(code))
    finally:
        stop(proc); log.close()
        if posix: os.chmod(bindir, 0o755)
        if not all(RESULTS):
            print("\n--- saída do Cube4Notes ---\n" + open(logpath, encoding="utf-8", errors="replace").read()[-6000:])
        shutil.rmtree(work, ignore_errors=True)
    print(f"\n{sum(RESULTS)} de {len(RESULTS)} verificações passaram.")
    return 0 if all(RESULTS) else 1


if __name__ == "__main__":
    sys.exit(main())
