# Author: Roberto Ritter
# Studio: Cube4Code
# Website: https://cube4code.com
# Copyright (c) 2026 Roberto Ritter
#
# Gera web/src/themes.ts com as paletas dos temas de terminal listados em terminalcolors.com.
"""Gera src/themes.ts a partir das paletas públicas dos temas listados em terminalcolors.com (tags dark e light).

Fontes: mbadolato/iTerm2-Color-Schemes (pasta ghostty), Gogh-Co/Gogh (themes/*.yml),
raphamorim/lucario (alacritty) e ajmwagar/vim-deus (deus.json). Rode com os repositórios clonados em /tmp/themes.
"""
import json, re, yaml, sys
from pathlib import Path

B = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/themes')

def ghostty(n):
    s = (B / 'repo/ghostty' / n).read_text()
    p = [''] * 16
    for i, c in re.findall(r'palette = (\d+)=(#[0-9a-fA-F]{6})', s): p[int(i)] = c.lower()
    sel = re.search(r'^selection-background = (#\w{6})', s, re.M)
    return dict(bg=re.search(r'^background = (#\w{6})', s, re.M)[1].lower(), fg=re.search(r'^foreground = (#\w{6})', s, re.M)[1].lower(), sel=sel[1].lower() if sel else None, p=p)

def gogh(n):
    y = yaml.safe_load((B / 'gogh/themes' / (n + '.yml')).read_text())
    return dict(bg=y['background'].lower(), fg=y['foreground'].lower(), sel=None, p=[y[f'color_{i:02d}'].lower() for i in range(1, 17)])

def lucario():
    c = yaml.safe_load((B / 'lucario/alacritty/alacritty.yml').read_text())['colors']
    order = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white']
    return dict(bg=c['primary']['background'].lower(), fg=c['primary']['foreground'].lower(), sel=None,
                p=[c['normal'][k].lower() for k in order] + [c['bright'][k].lower() for k in order])

def deus():
    j = json.loads((B / 'deus/deus.json').read_text())
    return dict(bg=j['background'].lower(), fg=j['foreground'].lower(), sel=None, p=[x.lower() for x in j['color']])

# (id, nome exibido, função de origem, argumento)
DARK = [
    ('apprentice', 'Apprentice', gogh, 'Apprentice'), ('ayu-dark', 'Ayu', ghostty, 'Ayu'),
    ('catppuccin-mocha', 'Catppuccin Mocha', ghostty, 'Catppuccin Mocha'), ('cobalt2', 'Cobalt2', ghostty, 'Cobalt2'),
    ('deus', 'Deus', deus, None), ('dracula', 'Dracula', ghostty, 'Dracula'),
    ('everforest-dark', 'Everforest', ghostty, 'Everforest Dark Med'), ('github-dark', 'GitHub', ghostty, 'GitHub Dark'),
    ('gotham', 'Gotham', gogh, 'Gotham'), ('gruvbox-dark', 'Gruvbox', ghostty, 'Gruvbox Dark'),
    ('iceberg-dark', 'Iceberg', ghostty, 'Iceberg Dark'), ('jellybeans', 'Jellybeans', ghostty, 'Jellybeans'),
    ('kanagawa-wave', 'Kanagawa', ghostty, 'Kanagawa Wave'), ('lucario', 'Lucario', lucario, None),
    ('miasma', 'Miasma', ghostty, 'Miasma'), ('moonfly', 'Moonfly', ghostty, 'Moonfly'),
    ('night-owl', 'Night Owl', ghostty, 'Night Owl'), ('nightfly', 'Nightfly', gogh, 'Nightfly'),
    ('nightfox', 'Nightfox', ghostty, 'Nightfox'), ('noctis', 'Noctis', ghostty, 'Noctis'),
    ('nord', 'Nord', ghostty, 'Nord'), ('nordic', 'Nordic', gogh, 'Nordic'),
    ('one-dark', 'One', ghostty, 'Atom One Dark'), ('one-half-dark', 'One Half', ghostty, 'One Half Dark'),
    ('panda', 'Panda', gogh, 'Panda'), ('rose-pine', 'Rosé Pine', ghostty, 'Rose Pine'),
    ('seoul256', 'Seoul256', gogh, 'Seoul256'), ('shades-of-purple', 'Shades of Purple', ghostty, 'Shades Of Purple'),
    ('solarized-dark', 'Solarized', ghostty, 'iTerm2 Solarized Dark'), ('sonokai', 'Sonokai', ghostty, 'Sonokai'),
    ('srcery', 'Srcery', ghostty, 'Srcery'), ('tender', 'Tender', gogh, 'Tender'),
    ('tokyo-night', 'Tokyo Night', ghostty, 'TokyoNight'), ('tomorrow-night', 'Tomorrow Night', ghostty, 'Tomorrow Night'),
    ('zenwritten-dark', 'Zenwritten', ghostty, 'Zenwritten Dark'),
]
LIGHT = [
    ('ayu-light', 'Ayu', ghostty, 'Ayu Light'), ('catppuccin-latte', 'Catppuccin Latte', ghostty, 'Catppuccin Latte'),
    ('everforest-light', 'Everforest', ghostty, 'Everforest Light Med'), ('github-light', 'GitHub', ghostty, 'GitHub Light Default'),
    ('gruvbox-light', 'Gruvbox', ghostty, 'Gruvbox Light'), ('iceberg-light', 'Iceberg', ghostty, 'Iceberg Light'),
    ('kanagawa-lotus', 'Kanagawa Lotus', ghostty, 'Kanagawa Lotus'), ('night-owl-light', 'Night Owl', ghostty, 'Night Owlish Light'),
    ('dayfox', 'Nightfox Dayfox', ghostty, 'Dayfox'), ('noctis-lux', 'Noctis Lux', ghostty, 'Noctis Lux'),
    ('one-light', 'One', ghostty, 'Atom One Light'), ('one-half-light', 'One Half', ghostty, 'One Half Light'),
    ('rose-pine-dawn', 'Rosé Pine Dawn', ghostty, 'Rose Pine Dawn'), ('seoul256-light', 'Seoul256', gogh, 'Seoul256 Light'),
    ('solarized-light', 'Solarized', ghostty, 'iTerm2 Solarized Light'), ('tokyo-night-day', 'Tokyo Night Day', ghostty, 'TokyoNight Day'),
    ('tomorrow', 'Tomorrow', ghostty, 'Tomorrow'), ('zenwritten-light', 'Zenwritten', ghostty, 'Zenwritten Light'),
]
out = []
for kind, items in (('dark', DARK), ('light', LIGHT)):
    for tid, name, fn, arg in items:
        t = fn(arg) if arg else fn()
        assert all(re.fullmatch(r'#[0-9a-f]{6}', c) for c in t['p'] + [t['bg'], t['fg']]), tid
        out.append(dict(id=tid, name=name, kind=kind, bg=t['bg'], fg=t['fg'], sel=t['sel'], p=t['p']))
ts = ('/*\n * Author: Roberto Ritter\n * Studio: Cube4Code\n * Website: https://cube4code.com\n * Copyright (c) 2026 Roberto Ritter\n *\n'
      ' * Paletas dos temas de terminal (terminalcolors.com, tags dark e light). Arquivo gerado por\n'
      ' * web/scripts/gerar-temas.py; não edite à mão.\n */\n')
ts += 'export interface TermTheme { id: string; name: string; kind: "dark" | "light"; bg: string; fg: string; sel: string | null; p: string[] }\n'
ts += 'export const termThemes: TermTheme[] = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
Path(__file__).resolve().parent.parent.joinpath('src/themes.ts').write_text(ts)
print(len(out), 'temas')
