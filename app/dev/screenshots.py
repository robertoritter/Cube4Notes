# Author: Roberto Ritter
# Studio: Cube4Code
# Website: https://cube4code.com
# Copyright (c) 2026 Roberto Ritter
#
# Gera as capturas de tela da documentação (docs/images) com um vault de demonstração em inglês, a interface
# compilada (app/wwwroot) e o servidor de teste em Node, com HTTPS de teste. Precisa de Node, Playwright, openssl e Pillow.
# Uso: python dev/screenshots.py
import asyncio, glob, json, os, shutil, subprocess, sys, tempfile, textwrap, time
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_name_address import certs  # noqa: E402

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGES = os.path.join(os.path.dirname(APP), 'docs', 'images')
KEEP = ['ai-agent', 'connect-device', 'editor-dark', 'editor-light', 'history', 'mobile-editor', 'mobile-relations', 'mobile-tree', 'new-note', 'relations', 'type-list', 'vaults']


def kit_notes():
    """Conjunto Work em inglês, exatamente como o app cria (web/src/kits.ts)."""
    tmp = tempfile.mkdtemp()
    out = os.path.join(tmp, 'kits.mjs')
    subprocess.run(['npx', 'esbuild', 'src/kits.ts', '--bundle', '--format=esm', '--platform=node', '--outfile=' + out, '--log-level=error'], cwd=os.path.join(APP, 'web'), check=True)
    js = "const m = await import(process.argv[1]); const k = m.kits('en').find(x => x.id === 'trabalho'); console.log(JSON.stringify(m.kitNotes(k, 'en', 'templates')));"
    return json.loads(subprocess.run(['node', '--input-type=module', '-e', js, out], capture_output=True, text=True, check=True).stdout)


def make_demo(base):
    shutil.rmtree(base, ignore_errors=True)
    work, personal, cfg = f"{base}/Work", f"{base}/Personal", f"{base}/config"
    for d in (work, personal, cfg): os.makedirs(d)
    def w(root, rel, txt):
        p = os.path.join(root, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
        # o texto das notas está indentado junto com esta função: dedent devolve o Markdown sem recuo
        open(p, 'w', encoding='utf-8').write(textwrap.dedent(txt).lstrip('\n'))
    for n in kit_notes(): w(work, n['path'], n['content'])
    w(work, 'Companies/Acme Analytics.md', '''
    ---
    type: company
    tags: [company, partner]
    industry: Data consulting
    website: https://acme-analytics.example
    ---
    ## What they do

    Data platform consulting: pipelines, dashboards and data quality for mid-size retailers.

    ## Contacts

    - [Ana Souza](../People/Ana%20Souza.md), head of data
    ''')
    w(work, 'Companies/Borealis Foods.md', '''
    ---
    type: company
    tags: [company, client]
    industry: Food distribution
    website: https://borealis-foods.example
    ---
    ## What they do

    Frozen food distributor with 4 warehouses. Wants a single view of stock and deliveries.

    ## Contacts

    ## History
    ''')
    w(work, 'Companies/Zenith Logistics.md', '''
    ---
    type: company
    tags: [company, prospect]
    industry: Logistics
    website: https://zenith-logistics.example
    ---
    ## What they do

    Last-mile delivery for supermarkets. Runs Borealis deliveries in two cities.
    ''')
    for name, comp, role, mail, ctx in [
        ('Ana Souza', 'Acme Analytics', 'Head of data', 'ana@acme-analytics.example', 'Knows the Borealis stack from a previous project.'),
        ('Bruno Lima', 'Borealis Foods', 'CTO', 'bruno@borealis-foods.example', 'Sponsor of the stock visibility project.'),
        ('Carla Mendes', 'Borealis Foods', 'Procurement', 'carla@borealis-foods.example', 'Approves budget. Prefers short written proposals.'),
        ('Diego Ramos', 'Zenith Logistics', 'Operations manager', 'diego@zenith-logistics.example', 'Has the delivery data Borealis needs.')]:
        w(work, f'People/{name}.md', f'''
    ---
    type: person
    tags: [person]
    company: {comp}
    role: {role}
    email: {mail}
    ---
    ## Context

    {ctx}

    ## Conversations
    ''')
    w(work, 'Meetings/2026-10-14 Borealis kickoff.md', '''
    ---
    type: meeting
    tags: [meeting]
    date: 2026-10-14
    attendees: [Bruno Lima, Carla Mendes]
    company: Borealis Foods
    ---
    ## Agenda

    - Scope of the **stock visibility** project
    - Budget and first phase

    ## Notes

    Bruno wants *daily stock per warehouse*. Carla asked for a fixed-price first phase.

    | Warehouse | City | Priority |
    | --- | --- | --- |
    | North | Recife | High |
    | South | Curitiba | High |
    | Central | Brasília | Later |

    > Start small, prove the numbers, then grow.

    ## Next steps

    - [x] Share the data checklist
    - [ ] Send the proposal to [Carla Mendes](../People/Carla%20Mendes.md) by Friday
    - [ ] Ask [Diego Ramos](../People/Diego%20Ramos.md) for a sample of the delivery file
    ''')
    w(work, 'Meetings/2026-10-16 Industry roundtable.md', '''
    ---
    type: meeting
    tags: [meeting]
    date: 2026-10-16
    attendees: [Ana Souza, Bruno Lima, Diego Ramos]
    company: [Acme Analytics, Borealis Foods, Zenith Logistics]
    ---
    ## Notes

    Diego can export delivery events every hour. Ana offered to help with the pipeline.
    ''')
    w(work, 'Meetings/2026-10-20 Zenith data call.md', '''
    ---
    type: meeting
    tags: [meeting]
    date: 2026-10-20
    attendees: [Diego Ramos, Ana Souza]
    company: Zenith Logistics
    ---
    ## Notes

    CSV every hour, one row per delivery event.
    ''')
    w(work, 'Projects/Stock visibility.md', '''
    ---
    type: project
    tags: [project]
    status: Proposal
    company: Borealis Foods
    owner: Bruno Lima
    ---
    ## Goal

    One daily view of stock and deliveries for Borealis.

    ## Progress

    - Kickoff: [2026-10-14 Borealis kickoff](../Meetings/2026-10-14%20Borealis%20kickoff.md)
    ''')
    w(work, 'Decisions/2026-10-20 Hourly delivery CSV.md', '''
    ---
    type: decision
    tags: [decision]
    date: 2026-10-20
    project: Stock visibility
    status: Accepted
    ---
    ## Decision

    Load the hourly CSV from Zenith Logistics.
    ''')
    w(personal, 'Reading list.md', '# Reading list\n\n- [ ] The Pragmatic Programmer\n- [x] Designing Data-Intensive Applications\n')
    w(personal, 'Ideas/Garden.md', '# Garden\n\nTomatoes on the north side this year.\n')
    json.dump({"name": "Home server", "mode": "rede", "vaults": [{"id": "work", "name": "Work", "path": work}, {"id": "personal", "name": "Personal", "path": personal}]}, open(f"{cfg}/config.json", "w"))
    print("ok")


ROOT=APP; PORT=43125; WORK=tempfile.mkdtemp(prefix='c4n-shots-'); OUT=os.path.join(WORK,'shots'); DEMO=os.path.join(WORK,'demo')
URL=f'https://localhost:{PORT}/'
CD=os.path.join(WORK,'certs')
async def main():
    os.makedirs(OUT); os.makedirs(CD); certs(CD); make_demo(DEMO)
    srv=subprocess.Popen(['node',f'{ROOT}/dev/mock-server.mjs','--config',f'{DEMO}/config','--port',str(PORT),'--www',f'{ROOT}/wwwroot','--history-gap-ms','0','--show-lan','192.168.0.10','--cert',f'{CD}/c.pem','--key',f'{CD}/k.pem','--ca',f'{CD}/ca.der'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        async with async_playwright() as p:
            b=await p.chromium.launch()
            async def ctx_for(w,h,scale,theme='light',term='',mobile=False):
                ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' if mobile else 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0'
                c=await b.new_context(viewport={'width':w,'height':h},device_scale_factor=scale,locale='en-US',is_mobile=mobile,has_touch=mobile,ignore_https_errors=True,user_agent=ua)
                await c.add_init_script(f"try{{localStorage.setItem('c4n-lang','en');localStorage.setItem('c4n-theme','{theme}');localStorage.setItem('c4n-term','{term}');localStorage.setItem('c4n-font','sans')}}catch(e){{}}")
                pg=await c.new_page(); await pg.goto(URL); await pg.wait_for_timeout(2500); return c,pg
            async def esc(pg):
                for _ in range(3): await pg.keyboard.press('Escape'); await pg.wait_for_timeout(120)
            async def open_note(pg,name):
                await esc(pg); await pg.keyboard.press('Control+k'); await pg.keyboard.type(name); await pg.wait_for_timeout(400); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(1500)
            async def cmd(pg,label):
                await esc(pg); await pg.keyboard.press('Control+k'); await pg.keyboard.type('>'+label); await pg.wait_for_timeout(400); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(1300)
            async def shot(pg,name): await pg.screenshot(path=f'{OUT}/{name}.png'); print('shot',name,flush=True)
            # desktop light
            c,pg=await ctx_for(1440,900,2)
            await open_note(pg,'Borealis kickoff'); await shot(pg,'editor-light')
            await open_note(pg,'Borealis Foods'); await shot(pg,'relations')
            await esc(pg); await pg.keyboard.press('Control+k'); await pg.keyboard.type('>List'); await pg.wait_for_timeout(500)
            await pg.locator('.pal-item').filter(has_text='ompan').first.click(); await pg.wait_for_timeout(1300); await shot(pg,'type-list')
            await esc(pg); await pg.keyboard.press('Alt+n'); await pg.wait_for_timeout(800)
            await pg.keyboard.type('Northwind Traders'); await pg.wait_for_timeout(200)
            card=pg.locator('.sheet button').filter(has_text='Companies').first
            try: await card.click(timeout=2000)
            except Exception as e: print('card',e)
            await pg.wait_for_timeout(400); await shot(pg,'new-note')
            await esc(pg)
            # history: edit project note a few times
            await open_note(pg,'Stock visibility')
            for t in [' First warehouse data loaded.',' North and South warehouses live.',' Daily report sent to Bruno.']:
                para=pg.locator('.ProseMirror p').last; await para.click(); await pg.keyboard.press('End'); await pg.keyboard.type(t,delay=10)
                await pg.wait_for_timeout(900); await pg.keyboard.press('Control+s'); await pg.wait_for_timeout(1500)
            await cmd(pg,'Version history'); await pg.wait_for_timeout(800)
            v=pg.locator('.modal .hist-item, .modal li, .modal button').nth(1)
            try: await v.click(timeout=1500); await pg.wait_for_timeout(600)
            except Exception as e: print('hist',e)
            await shot(pg,'history'); await esc(pg)
            # vault switch
            sw=pg.locator("[aria-label='Switch vault']").first
            try: await sw.click(timeout=2000); await pg.wait_for_timeout(500); await shot(pg,'vaults'); await esc(pg)
            except Exception as e: print('vault',e)
            # connect device + agent
            await pg.locator("button[aria-label='Preferences']").first.click(); await pg.wait_for_timeout(500)
            await shot(pg,'preferences')
            await pg.locator('.connect-btn').click(); await pg.wait_for_timeout(1500); await shot(pg,'connect-device')
            try:
                await pg.get_by_text('Create agent access').first.click(timeout=3000); await pg.wait_for_timeout(500)
                inp=pg.locator("input[aria-label='Agent name']").first; await inp.fill('Claude Code')
                box=pg.locator('.agent-form label').filter(has_text='Work').locator('input').first
                try: await box.check(timeout=1500)
                except Exception: pass
                await pg.locator('.agent-form button[type=submit]').click(); await pg.wait_for_timeout(1200)
                await pg.locator('.agent-created').scroll_into_view_if_needed(); await shot(pg,'ai-agent')
            except Exception as e: print('agent',e)
            await c.close()
            # dark terminal theme
            c,pg=await ctx_for(1440,900,2,theme='dark',term='tokyo-night')
            await open_note(pg,'Borealis kickoff'); await shot(pg,'editor-dark'); await c.close()
            # mobile
            c,pg=await ctx_for(390,844,3,mobile=True)
            await open_note(pg,'Borealis kickoff'); await shot(pg,'mobile-editor')
            await open_note(pg,'Borealis Foods')
            r=pg.locator('#relations-inline')
            try: await r.scroll_into_view_if_needed(); await pg.wait_for_timeout(400)
            except Exception: pass
            await shot(pg,'mobile-relations')
            m=pg.locator(".sidebar-toggle").first
            try: await m.click(timeout=2000); await pg.wait_for_timeout(600); await shot(pg,'mobile-tree')
            except Exception as e: print('menu',e)
            await c.close(); await b.close()
    finally:
        srv.terminate(); srv.wait()


def shrink():
    """Reduz para 1600 px (computador) ou 780 px (celular) e 256 cores: imagens leves para o GitHub."""
    from PIL import Image
    for name in KEEP:
        src = os.path.join(OUT, name + '.png')
        im = Image.open(src).convert('RGB'); w = 1600 if im.width > 2000 else 780
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        im.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(os.path.join(IMAGES, name + '.png'), optimize=True)
        print('docs/images/' + name + '.png')


if __name__ == '__main__':
    asyncio.run(main())
    shrink()
