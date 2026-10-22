# Author: Roberto Ritter
# Studio: Cube4Code
# Website: https://cube4code.com
# Copyright (c) 2026 Roberto Ritter
#
# Confere a língua da interface: abre as telas principais em inglês e em português e procura textos da outra
# língua (texto visível, placeholders, títulos, aria-labels). O conteúdo das notas de teste está na mesma língua
# da interface, então qualquer palavra da outra língua é texto da interface esquecido.
# Uso: python dev/test_language.py  (precisa de Node e Playwright; rode depois de compilar a interface)
import asyncio, os, re, shutil, subprocess, sys, time
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from testport import free_port  # noqa: E402
PORT = free_port()
URL = f"http://localhost:{PORT}/"

SEED = {
    "en": {
        "templates/Company.md": "---\ntype: company\nfolder: Companies\ntags: [company]\nindustry:\nwebsite:\n---\n## What they do\n\n## Contacts\n",
        "templates/Person.md": "---\ntype: person\nfolder: People\ntags: [person]\ncompany:\nrole:\n---\n## Context\n",
        "Companies/Acme.md": "---\ntype: company\ntags: [company]\nindustry: Consulting\n---\n## What they do\n\nData work.\n",
        "People/Ana.md": "---\ntype: person\ntags: [person]\ncompany: Acme\nrole: Lead\n---\n## Context\n\nMet at the fair.\n",
        "Ideas.md": "# Ideas\n\nSome text to select here.\n\n",
    },
    "pt-BR": {
        "modelos/Empresa.md": "---\ntipo: empresa\ndestino: Empresas\ntags: [empresa]\nramo:\nsite:\n---\n## O que faz\n\n## Contatos\n",
        "modelos/Pessoa.md": "---\ntipo: pessoa\ndestino: Pessoas\ntags: [pessoa]\nempresa:\ncargo:\n---\n## Contexto\n",
        "Empresas/Acme.md": "---\ntipo: empresa\ntags: [empresa]\nramo: Consultoria\n---\n## O que faz\n\nDados.\n",
        "Pessoas/Ana.md": "---\ntipo: pessoa\ntags: [pessoa]\nempresa: Acme\ncargo: Líder\n---\n## Contexto\n\nConheci na feira.\n",
        "Ideias.md": "# Ideias\n\nUm texto para selecionar aqui.\n\n",
    },
}

# Palavras que denunciam a outra língua (sem ambiguidade entre as duas).
PT_WORDS = r"não|nota|notas|pasta|pastas|aparelho|aparelhos|para|com|uma|sem|você|este|esta|isso|aqui|pelo|pela|abrir|criar|salvar|buscar|modelo|modelos|conjunto|liberar|título|vazia|vazio|nova|novo|cancelar|excluir|renomear|mover|versões|versão|histórico|relações|estrutura|sincronizado|propriedades|enviar|legenda|tabela|imagem|código|lista|listas|hoje|agora|carregando|desfazer|copiar|colar|linha|coluna|apagar|configurar|servidor|computador|celular|preferências|tema|fonte|largura|idioma"
EN_WORDS = r"the|and|with|your|you|this|note|notes|open|close|save|search|folder|device|devices|settings|create|cancel|delete|rename|move|history|version|versions|template|templates|upload|paste|copy|edit|heading|paragraph|quote|divider|table|image|code|bullet|ordered|task|list|row|column|align|left|right|center|confirm|untitled|loading|empty|sync|synced|offline|server|computer|phone|theme|width|language|caption|link|text|fold|unfold|line|lines|drag|insert|add|remove|new|more|less|show|hide|preview|language|languages|find|replace|next|previous|done|back"
ALLOWED = {"en": set(), "pt-BR": {"link", "links", "markdown", "visual", "tags", "tag", "vault", "vaults", "token", "admin", "wi-fi", "ok", "enter", "esc", "status", "site", "email", "designer", "online", "offline", "sync", "designer"}}


# Textos que são nomes próprios ou citações de propósito (nome de tema, nome da língua, item do menu do Windows).
IGNORE = re.compile(r"Rosé Pine|^Português$|Liberar no firewall|QR code|Claude Code")


def bad_words(lang, texts):
    rx = re.compile(r"\b(" + (PT_WORDS if lang == "en" else EN_WORDS) + r")\b", re.I)
    found = {}
    for tx in texts:
        if not tx or len(tx) > 400 or IGNORE.search(tx): continue
        for m in rx.finditer(tx):
            w = m.group(1).lower()
            if w in ALLOWED[lang]: continue
            found.setdefault(tx.strip()[:140], set()).add(w)
        if lang == "en" and re.search(r"[ãõçáéíóúâêô]", tx): found.setdefault(tx.strip()[:140], set()).add("acento")
    return found


COLLECT = """() => {
  const out = new Set();
  for (const line of document.body.innerText.split('\\n')) if (line.trim()) out.add(line.trim());
  for (const e of document.querySelectorAll('[placeholder],[title],[aria-label],[alt],[data-placeholder],option,optgroup')) {
    for (const a of ['placeholder', 'title', 'aria-label', 'alt', 'data-placeholder', 'label']) { const v = e.getAttribute(a); if (v) out.add(v); }
    if (e.tagName === 'OPTION') out.add(e.textContent);
  }
  return [...out];
}"""


async def run(p, lang):
    vault = f"/tmp/c4n-lang-{lang}-{int(time.time()*1000)}"
    shutil.rmtree(vault, ignore_errors=True)
    for rel, txt in SEED[lang].items():
        os.makedirs(os.path.dirname(os.path.join(vault, rel)) or vault, exist_ok=True)
        open(os.path.join(vault, rel), "w", encoding="utf-8").write(txt)
    srv = subprocess.Popen(["node", os.path.join(ROOT, "dev/mock-server.mjs"), "--notes", vault, "--port", str(PORT), "--www", os.path.join(ROOT, "wwwroot")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env={**os.environ, "LANG": "pt_BR.UTF-8" if lang == "pt-BR" else "en_US.UTF-8"})
    time.sleep(0.8)
    b = await p.chromium.launch()
    problems = {}
    try:
        ctx = await b.new_context(viewport={"width": 1280, "height": 860}, locale="en-US" if lang == "en" else "pt-BR")
        await ctx.add_init_script(f"try {{ localStorage.setItem('c4n-lang', '{lang}') }} catch {{}}")
        pg = await ctx.new_page()
        pg.on("pageerror", lambda e: print(f"     erro JS: {e}"))
        await pg.goto(URL); await pg.wait_for_timeout(1800)
        en = lang == "en"

        async def grab(scene):
            for tx, ws in bad_words(lang, await pg.evaluate(COLLECT)).items():
                problems.setdefault(tx, (scene, ws))

        async def esc(n=2):
            for _ in range(n): await pg.keyboard.press("Escape"); await pg.wait_for_timeout(120)

        async def open_note(name):
            await esc(); await pg.keyboard.press("Control+k"); await pg.keyboard.type(name); await pg.wait_for_timeout(250)
            await pg.keyboard.press("Enter"); await pg.wait_for_timeout(1000)

        async def command(label):
            await esc(); await pg.keyboard.press("Control+k"); await pg.keyboard.type(">" + label); await pg.wait_for_timeout(300)
            await pg.keyboard.press("Enter"); await pg.wait_for_timeout(900)

        await grab("início")
        await open_note("Ideas" if en else "Ideias"); await grab("nota aberta")
        await pg.keyboard.press("Control+k"); await pg.keyboard.type("zzz"); await pg.wait_for_timeout(300); await grab("busca rápida sem resultado")
        await esc(); await pg.keyboard.press("Control+k"); await pg.keyboard.type(">"); await pg.wait_for_timeout(300); await grab("comandos")
        await esc(); await pg.keyboard.press("Alt+n"); await pg.wait_for_timeout(700); await grab("nova nota (escolha do modelo)")
        await command("Add a template set" if en else "Adicionar conjunto"); await grab("conjuntos de modelos")
        await open_note("Acme"); await grab("nota com relações e propriedades")
        await command("List" if en else "Lista"); await grab("lista por tipo")
        await open_note("Company" if en else "Empresa"); await grab("modelo travado")
        await open_note("Ideas" if en else "Ideias")
        await command("Version history" if en else "Histórico"); await grab("histórico")
        await esc()
        # editor: menu de blocos, barra de seleção, [[ e #
        para = pg.locator(".ProseMirror p").last
        await para.click(); await pg.keyboard.press("End"); await pg.keyboard.press("Enter"); await pg.wait_for_timeout(200); await grab("parágrafo vazio")
        await pg.keyboard.type("/"); await pg.wait_for_timeout(500); await grab("menu de blocos")
        await pg.keyboard.press("Escape"); await pg.keyboard.press("Backspace")
        await pg.keyboard.type("[["); await pg.wait_for_timeout(500); await grab("escolher nota [[")
        await pg.keyboard.press("Escape"); await pg.keyboard.press("Backspace"); await pg.keyboard.press("Backspace")
        await pg.keyboard.type("#"); await pg.wait_for_timeout(500); await grab("sugestão de #tag")
        await pg.keyboard.press("Escape"); await pg.keyboard.press("Backspace")
        await pg.locator(".ProseMirror p").nth(0).dblclick(); await pg.wait_for_timeout(500); await grab("barra de formatação")
        # tabela e bloco de código pelo menu de blocos
        await para.click(); await pg.keyboard.press("End"); await pg.keyboard.press("Enter")
        await pg.keyboard.type("/"); await pg.wait_for_timeout(400)
        tb = pg.locator(f".milkdown-slash-menu li:has-text('{'Table' if en else 'Tabela'}')")
        if await tb.count(): await tb.first.click(); await pg.wait_for_timeout(500)
        cell = pg.locator(".ProseMirror td, .ProseMirror th").first
        if await cell.count(): await cell.click(); await pg.wait_for_timeout(400); await grab("tabela")
        await pg.keyboard.press("Control+End"); await pg.keyboard.press("Enter")
        await pg.keyboard.type("/" + ("Code" if en else "Bloco de código")); await pg.wait_for_timeout(400); await pg.keyboard.press("Enter"); await pg.wait_for_timeout(600); await grab("bloco de código")
        await pg.keyboard.press("Control+End"); await pg.keyboard.press("Enter")
        await pg.keyboard.type("/"); await pg.wait_for_timeout(400)
        img = pg.locator(f".milkdown-slash-menu li:has-text('{'Image' if en else 'Imagem'}')")
        if await img.count(): await img.first.click(); await pg.wait_for_timeout(600); await grab("bloco de imagem")
        await command("Add properties" if en else "Adicionar propriedades"); await grab("propriedades")
        # menu do botão direito numa nota da lista
        await esc(); await pg.locator(".row").first.click(button="right"); await pg.wait_for_timeout(300); await grab("menu de contexto")
        await esc()
        # barra lateral: tags e busca
        await command("Tags"); await grab("tags")
        await esc(); await pg.keyboard.press("Control+Shift+f"); await pg.wait_for_timeout(300); await pg.keyboard.type("zzz"); await pg.wait_for_timeout(600); await grab("busca no texto")
        # preferências, aparelhos, vaults, agentes
        await esc(); await pg.locator(f"button[aria-label='{'Preferences' if en else 'Preferências'}']").first.click(); await pg.wait_for_timeout(400); await grab("preferências")
        btn = pg.locator(".connect-btn")
        if await btn.count(): await btn.click(); await pg.wait_for_timeout(1200); await grab("conectar aparelho")
        await esc(3); await pg.locator(f"button[aria-label='{'Preferences' if en else 'Preferências'}']").first.click(); await pg.wait_for_timeout(300)
        btn = pg.locator(".admin-btns .btn").nth(1)
        if await btn.count(): await btn.click(); await pg.wait_for_timeout(1000); await grab("vaults")
        await esc(3)
        # sem servidor
        await ctx.set_offline(True); await pg.keyboard.press("Control+s"); await pg.wait_for_timeout(1500); await grab("sem servidor")
        await pg.locator(f"button[aria-label='{'Preferences' if en else 'Preferências'}']").first.click(); await pg.wait_for_timeout(300); await grab("preferências sem servidor")
        await ctx.set_offline(False); await esc(3)
        # celular
        await pg.set_viewport_size({"width": 390, "height": 844}); await pg.wait_for_timeout(500); await grab("celular")
        await open_note("Acme"); await grab("celular: nota com relações")
        await command("List" if en else "Lista"); await grab("celular: lista por tipo")
    finally:
        await b.close(); srv.terminate(); srv.wait()
    return problems


async def main():
    total = 0
    async with async_playwright() as p:
        for lang in ("en", "pt-BR"):
            probs = await run(p, lang)
            print(f"\nInterface em {lang}: {len(probs)} texto(s) suspeito(s)")
            for tx, (scene, ws) in probs.items():
                print(f"  [{scene}] {tx}   <- {', '.join(sorted(ws))}")
            total += len(probs)
    sys.exit(1 if total else 0)


if __name__ == "__main__":
    asyncio.run(main())
