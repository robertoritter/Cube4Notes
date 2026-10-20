# Cube4Notes

**Your Markdown notes on your own computer, and on every device you own. Even offline.**

Cube4Notes is a notes app that keeps your notes as plain Markdown files on a computer you own, gives you a modern visual editor, and lets you carry the same notes on your phone, tablet and other computers, with no cloud service in the middle.

![Cube4Notes editor](docs/images/editor-light.png)

> **Status: working prototype.** Daily use on Windows and iPhone is being validated now. Expect breaking changes. Versão em português: [README.pt-BR.md](README.pt-BR.md).

## You do not need a server

Cube4Notes runs **locally on the computer you already use**. Run it, and your notes live in a folder on that computer. There is no server to buy, no network to configure and no account to create.

- **Just this computer.** Choose *This computer only* in the first-run wizard. Cube4Notes listens only on that computer, with nothing exposed to the network. It works like any desktop notes app.
- **Any other device you want.** Choose *Home network* instead, and the same computer also serves your notes to your phone, tablet or laptop over your Wi-Fi. Scan a QR code on each device and that is it. Nothing else to install.
- **A dedicated machine, only if you want one.** If you prefer, run Cube4Notes on an always-on machine (an old PC, a mini PC, a Linux box). The notes are ordinary files, so moving from one setup to another means pointing Cube4Notes at the same folder.

Devices sync with your computer when they are on the same network as it. Away from it, every device keeps working with its full local copy and syncs back when it returns. Cube4Notes never exposes your notes to the internet.

## Highlights

- **Plain Markdown on disk.** Notes are ordinary `.md` files in ordinary folders. No database, no proprietary format, nothing to export.
- **Visual editor.** Markdown turns into formatting as you type: headings, task lists, tables, code blocks with syntax highlighting, images. Switch to raw Markdown with `Ctrl+/`. Edits produce small, clean diffs.
- **Offline first.** Each device stores every note it has access to. Read, create, edit, rename, move and delete with no connection; changes queue up and sync later.
- **No silent data loss.** If the same note changed in two places, one version stays and the other is saved as `Note (conflito Device date).md`, with a side-by-side compare view. Deletions go to a `.lixeira` (trash) folder. Edits made to a note that was renamed on another device follow it to the new name.
- **Multiple vaults.** Any folder can be a vault. Each device gets access only to the vaults you choose.
- **Pair a device with a QR code**, or a 6-character code. Invites are single-use and expire in 5 minutes. Scanning a new invite on a device that is already connected updates its access. Devices can be revoked instantly.
- **Local HTTPS that just works.** In *Home network* mode Cube4Notes creates its own certificate authority, restricted to `localhost`, `*.local`, the computer name and private IP ranges, so it cannot be abused to impersonate internet sites.
- **A real desktop app.** Cube4Notes opens in its own window, using the system web engine (WebView2 on Windows, WebKit on Linux and macOS). In *Home network* mode, closing the window keeps it running next to the clock so other devices keep syncing; the icon reopens or quits it. Machines without a screen run it as a console server.
- **Fast navigation.** Tabs, folder tree with drag and drop, `Ctrl+K` quick open and command palette, full-text search, outline and backlinks panel.
- **53 terminal color themes** (Dracula, Nord, Gruvbox, Solarized, Catppuccin, Tokyo Night...) plus light, dark and sepia. Portuguese and English interface.

| Phone | Vaults | Terminal theme |
| --- | --- | --- |
| ![Phone](docs/images/mobile-editor.png) | ![Vault switcher](docs/images/vaults.png) ![Phone sidebar](docs/images/mobile-tree.png) | ![Tokyo Night theme](docs/images/editor-dark.png) |

## Getting started (Windows)

Requirements: [.NET 10 SDK](https://dotnet.microsoft.com/download), or the standalone `Cube4Notes.exe` (see below), which needs nothing installed.

1. Double-click `Cube4Notes.exe` (or, from source, `app/iniciar.cmd`).
2. Cube4Notes opens in its own app window (no browser, no console). On the first run a setup wizard asks three things:
   - where you will use it: *This computer only* or *Home network*;
   - the folder for your first vault (any folder; it is created if missing, and existing `.md` files show up as notes);
   - a name for this device.
3. On the first run Windows asks once to trust the Cube4Notes certificate: accept it (it is only valid for local addresses). In *Home network* mode Windows Firewall may also ask for access: allow it on **private networks**.

To connect a phone or tablet: open **Preferences > Connect device**, choose which vaults it may access, and scan the QR code. To stop the browser warning and let the app open with no connection, install the certificate on the device once (instructions are on the same screen).

Everything can be changed later in **Preferences > Vaults and server**: add, rename or remove vaults, and switch between *This computer only* and *Home network* at any time.

Setting up a machine without a screen: start Cube4Notes there, open `https://<its-ip>:43125` from another device on the same network and enter the setup code printed in the console.

### Standalone executable

`app/gerar-executavel.cmd` produces a self-contained `Cube4Notes.exe` in `app/dist/win-x64` that runs on any Windows PC without .NET. It is a single file with the interface built in: copy it anywhere and double-click.

### Command-line options

| Option | Effect |
| --- | --- |
| `--config <folder>` | Configuration folder (default `%LOCALAPPDATA%\Cube4Notes`) |
| `--port <number>` | Port (default 43125; in *Home network* mode the port below it redirects HTTP to HTTPS) |
| `--notes <folder>` | Import a single notes folder as the vault "Notas" (upgrade from the first prototype) |
| `--sem-janela` | Console server, no app window (for machines without a screen) |
| `--sem-navegador` | In console mode, do not open the browser on start |
| `--sem-https` | Plain HTTP on the network (testing only) |
| `--sem-instalar-certificado` | Do not add the certificate to the Windows trust store |

## Platforms

| Platform | Status |
| --- | --- |
| Windows | Working, in daily validation |
| iPhone / iPad (Safari, home screen app) | Working, in daily validation |
| Android, other desktop browsers | Expected to work, not yet validated |
| Linux | Cross-platform by design (`net10.0`); build script, CI and service setup in progress |
| macOS | Planned; built and tested in CI only |

## Design principles

- The notes belong to you, in a format any editor can open.
- Local only: Cube4Notes is reachable from the computer it runs on and, if you enable it, from your own network. No external access, no tunnel, no cloud service.
- Security is part of the core: per-device tokens (stored hashed), host and origin checks, strict upload rules, OWASP Top 10 review ([app/SEGURANCA.md](app/SEGURANCA.md), in Portuguese).
- Simple to set up anywhere: a first-run wizard in the browser, no configuration files to edit by hand.

## Repository layout

```text
app/                        Cube4Notes (server, web interface, tests)
  Program.cs, src/          server: .NET 10 minimal API
  web/                      web interface source: TypeScript, Vite, Milkdown
  wwwroot/                  compiled web interface served by the server
  dev/mock-server.mjs       Node server with the same API, for interface development and tests
  dev/teste_sync.py         adversarial sync tests (two simulated devices)
  seguranca/                security test suite (OWASP Top 10)
services/api/               first server prototype
apps/, packages/, services/mcp/   planned components (web client, editor, contracts, agent integration)
docs/                       vision, architecture, delivery plan, research and decisions (Portuguese)
```

## Development

```bash
cd app/web
npm install
npm run build        # compiles the interface into app/wwwroot
npm run dev          # dev server; run Cube4Notes on port 43125 alongside
```

Tests (Python 3; the sync tests also need Playwright):

```bash
python app/dev/teste_sync.py                                   # adversarial sync scenarios
python app/seguranca/teste_seguranca.py --lan https://<ip>:43125   # security suite against a running server
python scripts/check_project.py                                # repository structure checks
```

## Roadmap

- Linux build script and CI (every build must also compile on Linux)
- Native app window (Photino.NET) for *This computer only* mode
- Install as a service (Windows service, systemd, launchd) and find the server by name on the network
- Scoped, read-only tokens per vault for local AI agents, with an MCP integration
- Optional automatic history of each vault with Git

## License

No license has been chosen yet. Until one is published, this repository is **not open source**: all rights reserved.

---

Developed by **Roberto Ritter** at [Cube4Code](https://cube4code.com).
