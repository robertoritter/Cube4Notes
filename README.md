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
- **Links between notes.** Type `[[` to pick a note and Cube4Notes writes a standard Markdown link (`[Note](folder/Note.md)`), so it keeps working in any editor. Rename or move a note, folder or attachment and every link follows. `Ctrl`+click (or a tap on touch screens) opens it; a link to a note that does not exist yet offers to create it.
- **Images and PDFs, offline too.** Paste or drop them into a note. They are stored on the device right away, upload when the server is reachable, and images used in notes are kept on every device so they show up away from home.
- **Version history.** Before a note is overwritten, the previous text is kept on the server (at most one version every 5 minutes of editing, up to 100 per note). Compare any version with the current text and restore it; restoring never loses the current text.
- **Tags and properties.** `#tags` in the text or a `tags:` property, a tag panel, and search filters like `#project` or `status:open`. Properties (YAML front matter) are edited as fields; hand-written complex YAML is left untouched.
- **Templates, types and relations.** Templates are ordinary notes in a `templates/` folder (`modelos/` also works), with a type, fields, tags and the folder new notes go to; ready-made sets (Work, Personal, Reading, Studies, Software projects, Board games) get you started. A field that names another note (`company: Company Y`) is a relation: open a company and see its people and meetings grouped by type, or open a list of all companies with fields as columns, relation counts and last contact. A daily note is one click away (`Alt+D`). On a phone, relations appear below the note and lists become cards. All computed on the device, offline too.
- **Read-only access for AI agents (MCP).** Give an agent such as Claude Code its own read-only token for the vaults you choose. It can list, search and read notes over MCP, never write, and only from inside your network.
- **Fast navigation.** Tabs, folder tree with drag and drop, `Ctrl+K` quick open and command palette, full-text search, outline and backlinks panel.
- **53 terminal color themes** (Dracula, Nord, Gruvbox, Solarized, Catppuccin, Tokyo Night...) plus light, dark and sepia, from [Cube4Themes](https://github.com/robertoritter/Cube4Themes). Portuguese and English interface (chosen per device in Preferences); the tray icon, Windows notices and console follow the system language, and template sets are created in the interface language.

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
3. On the first run Windows asks once to trust the Cube4Notes certificate: accept it (it is only valid for local addresses). In *Home network* mode Cube4Notes then asks Windows once (administrator confirmation) to open its two ports, and name lookups, to the local network only. If a phone ever stops connecting, right-click the tray icon and choose *Liberar no firewall*.

To connect a phone, tablet or another computer, follow [Connecting a phone, step by step](#connecting-a-phone-step-by-step).

Everything can be changed later in **Preferences > Vaults and server**: add, rename or remove vaults, and switch between *This computer only* and *Home network* at any time.

Setting up a machine without a screen: start Cube4Notes there, open `https://<its-ip>:43125` from another device on the same network and enter the setup code printed in the console.

### Standalone executable

`app/gerar-executavel.cmd` produces a self-contained `Cube4Notes.exe` in `app/dist/win-x64` that runs on any Windows PC without .NET. It is a single file with the interface built in: copy it anywhere and double-click.

### Headless Linux server (systemd service)

To keep your notes on an always-on Linux server (Debian, Ubuntu, Raspberry Pi OS; x64 or ARM64, including an Apple Silicon Mac running Linux):

1. Install the .NET 10 SDK for your user only (no root needed):
   ```bash
   curl -sSL https://dot.net/v1/dotnet-install.sh | bash -s -- --channel 10.0
   export PATH="$HOME/.dotnet:$PATH"
   ```
2. Get the code and build the executable (the machine's platform is detected automatically):
   ```bash
   git clone https://github.com/robertoritter/cube4notes.git
   cd cube4notes/app
   ./gerar-executavel.sh
   ```
3. Install it as a service (asks for `sudo`; the service runs as your user, not as root, and starts with the machine):
   ```bash
   ./instalar-servico.sh
   ```
   The script shows Cube4Notes' first messages, with its addresses and the **setup code**.
4. On another device on the same network, open `https://<server-ip>:43125`, accept the browser warning (the certificate is not installed on that device yet), type the code and choose the folder of the first vault, which lives on the server.
5. Then connect devices as usual: [Connecting a phone, step by step](#connecting-a-phone-step-by-step). Also reserve the server's IP in the router.

Settings live in `~/.local/share/Cube4Notes` of the service user. Useful commands: `journalctl -u cube4notes -f` (messages), `sudo systemctl restart cube4notes`. To update: `git pull`, `./gerar-executavel.sh` and `./instalar-servico.sh` again (settings, devices and notes are kept). If the machine has a firewall (for example `ufw`), allow ports 43124 and 43125 (TCP) and 5353 (UDP) from the local network.

### Command-line options

| Option | Effect |
| --- | --- |
| `--config <folder>` | Configuration folder (default `%LOCALAPPDATA%\Cube4Notes` on Windows, `~/.local/share/Cube4Notes` on Linux) |
| `--port <number>` | Port (default 43125; in *Home network* mode the port below it redirects HTTP to HTTPS) |
| `--notes <folder>` | Import a single notes folder as the vault "Notas" (upgrade from the first prototype) |
| `--sem-janela` | Console server, no app window (for machines without a screen) |
| `--sem-navegador` | In console mode, do not open the browser on start |
| `--sem-https` | Plain HTTP on the network (testing only) |
| `--sem-instalar-certificado` | Do not add the certificate to the Windows trust store |
| `--sem-nome-na-rede` | Do not answer for `<computer-name>-notes.local` on the local network |

## Connecting a phone, step by step

Do it in this order. Steps 1 and 2 are done once and prevent almost every problem.

1. **Reserve the computer's IP in the router.** In the router settings, look for *DHCP reservation* (also called *static IP* or *static lease*) and reserve the current IP of the computer running Cube4Notes. Without it, the router may give the computer another IP one day, and devices show "No server" (see [why](#how-devices-find-your-computer)).
2. **Install the certificate on the device.** In the device's browser, open `http://<computer-ip>:43124/cube4notes-ca.cer` and follow [Installing the certificate](#installing-the-certificate-on-phones-tablets-and-other-computers). On an iPhone, do not skip the last step (Certificate Trust Settings). Without the certificate, the browser shows "Not Secure" and the app does not open away from home.
3. **Scan the QR code.** On the computer, open **Preferences > Connect device**, choose which vaults the device may access and point the device's camera at the QR code.
4. **Add to the Home Screen** (optional). On an iPhone, in Safari: Share > Add to Home Screen. Cube4Notes then opens like an app, also with no connection.

That is it: the device syncs by itself on the home network and works offline away from it.

### Common problems

| What happens | Likely cause | What to do |
|---|---|---|
| Safari's address bar flickers between the address and search, and nothing opens | Safari got stuck on an earlier attempt | Fully close Safari (swipe it away in the app switcher) and scan the QR code again |
| The browser shows "Not Secure" | The device does not trust the Cube4Notes certificate | Step 2. If it was installed before, remove the old profile and install again |
| "No server" all of a sudden, with nothing changed | The router gave the computer another IP | Step 1, reserving the old IP; the app comes back with everything |
| "No server" only on the phone, with the computer on | Phone not on the home Wi-Fi, or the Windows firewall | Check the Wi-Fi. On the computer, right-click the icon next to the clock > *Allow through firewall* |
| "This device cannot find the computer by name" | Certificate not installed, or a network that blocks `.local` names | Install the certificate. With a reserved IP (step 1), the name is optional |
| The interface is in another language | Each device follows its own system language | Preferences > Language |

## How devices find your computer

Cube4Notes never goes through the internet. A phone or tablet talks directly to the computer that keeps the notes, over your home Wi-Fi. That makes the **address** of the computer important, and it helps to know how it works.

**Two kinds of address**

- **By IP**, for example `https://192.168.0.10:43125`. Always works on the home network, on any device. The catch: most routers hand out IPs automatically and may give the computer a different one later (`192.168.0.11`). A device still pointing to the old IP can no longer reach the server, and the app stays in "No server".
- **By name**, for example `https://my-pc-notes.local:43125` (the computer name followed by `-notes.local`). The device asks the local network "who is my-pc-notes.local?" and Cube4Notes answers with the computer's current IP. This is the same mechanism (mDNS, also called Bonjour) that phones use to find printers and AirPlay speakers. When the IP changes, the name keeps working.

  Why `-notes` and not just `my-pc.local`? The operating system may also answer for `my-pc.local`, and sometimes with the address of a VPN or virtual network adapter that the phone cannot reach. A name of its own means only Cube4Notes answers, always with the address of the home network.

**What Cube4Notes does**

1. The QR code uses the IP, because it works on every device.
2. Right after connecting, the app checks whether this device can also reach the computer by name. If it can, it offers to switch to the name. The switch keeps the same device access (no new QR code), sends any pending changes first and downloads the notes again at the new address, so nothing is lost. You can also do it later in **Preferences > Use the computer name as the address**.
3. On iPhone and iPad, a site added to the Home Screen belongs to one address. After switching, add Cube4Notes to the Home Screen again and remove the old icon.

**Is `my-pc-notes.local` always my computer, on any network?** No, and that is fine. The name is answered by whoever is on the network you are on at that moment:

- at home, your computer answers;
- on another network (street, office, mobile data) nobody answers, and the app simply works offline, as it always does away from home;
- if another network happens to have a computer with the same name, the app still refuses to connect: the connection uses HTTPS with a certificate created by your own computer, which no other machine can present. Your device token is also only valid on your server.

**Where the name may not work**

- Guest Wi-Fi and networks that isolate devices block these name lookups. A normal home network allows them.
- Android resolves `.local` names inconsistently, depending on the version and the browser. iPhone, iPad, macOS, Windows and Linux handle them well.
- Cube4Notes answers for the name itself, so it does not depend on the operating system doing it (Windows often does not). On Windows it also adds a firewall rule for name lookups (UDP 5353, local network only) together with the rule for its own ports. On Linux it shares the port with `avahi-daemon`, if it is running. To turn the name off, start Cube4Notes with `--sem-nome-na-rede`.
- Two computers with the same name on the same network confuse the answer. Give them different names.

**The simplest and most robust option: a fixed IP** (step 1 of [Connecting a phone](#connecting-a-phone-step-by-step)). In your router settings, look for *DHCP reservation* (also called *static lease* or *fixed IP*) and reserve the current IP for the computer that runs Cube4Notes. Then both the IP and the name keep working forever, on every device, including Android. With a fixed IP, using the name is optional.

**If a device lost the server after the IP changed:** reserve the old IP in the router (the app comes back with everything, including changes made on the device that had not been sent yet), or scan the QR code again (the device downloads the notes again; changes made on it that were not sent stay in the old app until the old IP comes back).

## Installing the certificate on phones, tablets and other computers

In *Home network* mode Cube4Notes uses HTTPS with a **certificate authority created on your own computer**, valid only for local names and private IP ranges. The server computer trusts it automatically. Every other device must install it **once**; without it the browser shows warnings, the app cannot be kept on the device for use away from home, and the switch to the name address (see above) fails silently.

The certificate is always available, over plain HTTP so it can be downloaded before it is trusted, at `http://<computer-ip>:43124/cube4notes-ca.cer` (the port is one below the app port). The same instructions are in **Preferences > Connect device**.

- **iPhone / iPad** (use Safari; other iOS browsers cannot install certificates):
  1. open the address above and allow the download;
  2. **Settings > General > VPN & Device Management**: install the profile "Cube4Notes CA (<computer name>)";
  3. **Settings > General > About > Certificate Trust Settings**: turn on full trust for "Cube4Notes CA". This last step is easy to miss and without it nothing changes.
- **Android**: download the file, then **Settings > Security > Encryption & credentials > Install a certificate > CA certificate**, pick the file and reopen the browser. Menu names vary by manufacturer.
- **Another Windows computer**: open the file and install it under *Trusted Root Certification Authorities*. **macOS**: open it in Keychain Access and set it to *Always Trust*. **Linux**: copy it to the system store (`/usr/local/share/ca-certificates/` and `update-ca-certificates` on Debian/Ubuntu); Firefox may need it imported in its own settings.

**Signs the device does not trust the current certificate**

- Safari or Chrome shows *Not Secure* (or a certificate warning) next to the address.
- The address bar flickers or keeps going back to the search page after scanning the QR code.
- The app does not open away from home, or Cube4Notes never offers the name address.

**When the certificate authority changes, every device must install it again.** It is created once and kept in the configuration folder (`%LOCALAPPDATA%\Cube4Notes\tls` on Windows). It is created again if that folder is deleted, if Cube4Notes runs with a different `--config` folder, or on another computer. In that case, on each device remove the old profile/certificate first and install the new one. The certificate name shows which computer it belongs to: "Cube4Notes CA (<computer name>)".

Only the certificate *authority* needs installing. The server's own certificate is renewed automatically when the computer's addresses change, and devices that trust the authority accept it without any action.

## Platforms

| Platform | Status |
| --- | --- |
| Windows | Working, in daily validation |
| iPhone / iPad (Safari, home screen app) | Working, in daily validation |
| Android, other desktop browsers | Expected to work, not yet validated |
| Linux (headless server, x64 and ARM64) | Build script and systemd service ready, being validated |
| macOS (windowed app) | Planned; `gerar-executavel.sh` already builds the executable, the `.app` bundle is missing |

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
- Install as a service (Windows service, systemd, launchd) and find the server by name on the network
- Optional automatic history of each vault with Git

## License

Cube4Notes is open source under the [MIT License](LICENSE). The names Cube4Notes and Cube4Code and their logos are not covered by the license.

---

Developed by **Roberto Ritter** at [Cube4Code](https://cube4code.com).
