# Cube4Notes: app technical reference

Product overview, installation and use: [README.md](../README.md). How it works inside: [docs/01-architecture.md](../docs/01-architecture.md). This file is the reference for people working on the code.

## Build and run

| What | Windows | Linux and macOS |
| --- | --- | --- |
| Run from source | `run.cmd` (same as `dotnet run -c Release`) | `dotnet run -c Release` |
| Only check that it builds | `check-build.cmd` (output in `check-build.log`) | `dotnet build -c Release` |
| Standalone executable | `build.cmd` → `dist\win-x64\Cube4Notes.exe` | `./build.sh` → `dist/<platform>/Cube4Notes` |
| Headless server as a service | not applicable | `./install-service.sh` (systemd) |

- Requires the .NET 10 SDK. The generated executable needs nothing installed: it is a single, self-contained file, with the interface (`wwwroot`) embedded as a resource.
- The project targets `net10.0`, never `net10.0-windows`. Anything Windows-specific (tray icon, firewall, trusting the certificate) sits behind `OperatingSystem.IsWindows()`.
- Invariant globalization (`InvariantGlobalization`): the program does not depend on the ICU library. `build.sh` also runs the SDK this way, so it can build on a minimal Linux.
- `build.sh` detects the platform (`linux-x64`, `linux-arm64`, `osx-arm64`, `osx-x64`) or takes one as an argument.

## Window, tray and service

- When a display is available, the main process is the server and it opens the window in a second process (`Cube4Notes --window <address>`), built with Photino.NET (WebView2 on Windows, WebKitGTK on Linux, WebKit on macOS). Without a display, or with `--no-window`, only the server runs, in the console.
- Opening Cube4Notes again while it is already running just opens another window.
- *This computer only*: closing the window shuts everything down. *Home network*: the server keeps running; on Windows an icon stays near the clock (Open Cube4Notes, Allow through firewall, Quit Cube4Notes), built directly on the Windows API so it does not depend on WinForms. On any system, Preferences > Vaults and server > Quit Cube4Notes also shuts it down (only on the computer itself).
- First run in a window: the setup wizard runs over HTTP on this computer only; the certificate is created only if the user chooses *Home network*.
- As a systemd service (`install-service.sh`): the executable goes to `/opt/cube4notes`, the service runs as the user who installed it (never root) and with `--no-window --no-browser`. Running the script again updates the executable and restarts the service; configuration, devices and notes are kept.
- Program messages (icon, Windows notices, console, name of conflict copies) follow the system language: Windows through the API, macOS through its preferences, Linux through `LANG`/`LC_*`. `CUBE4NOTES_LANG=pt` or `en` forces a language.

## Configuration

Everything lives in a configuration folder: `%LOCALAPPDATA%\Cube4Notes` on Windows, `~/.local/share/Cube4Notes` on Linux, `~/Library/Application Support/Cube4Notes` on macOS, or `--config <folder>`.

```text
config.json     server name, mode, port and list of vaults
devices.json    devices and agents (token hashes only), administrators and allowed vaults
tls/            local certificate authority, server certificate and the addresses it covers (Home network mode)
```

- Without `config.json`, the server starts in the **first-run setup wizard**. On the computer itself it asks for no code; from another device, it asks for the 6-character code shown in the console.
- **Modes:** `pessoal` (*This computer only*: listens only on localhost, HTTP, no certificate) and `rede` (*Home network*: HTTPS on port 43125 and HTTP on 43124, which redirects to HTTPS, serves the certificate authority as `.cer` and `.pem`, and serves `/mcp` only to agents on the computer itself). Changing the mode saves the configuration and restarts the server within the same process.
- **Vaults:** any folder, except the disk root, system folders, the configuration folder and folders inside another vault. Each vault has a stable id used in routes (e.g. "Trabalho 2026" becomes `trabalho-2026`). Removing a vault from the list does not delete the folder.
- **Migration:** the configuration from the single-folder version (`pasta-de-notas.txt` or `--notes`) becomes the vault `notas`, and old devices keep working.
- Internal files of each vault: `<vault>/.cube4notes/` (history and renames) and `<vault>/.trash/`.

### Command-line options

| Option | Effect |
| --- | --- |
| `--config <folder>` | configuration folder |
| `--port <number>` | app port (default 43125; in *Home network* mode the port below it redirects to HTTPS) |
| `--notes <folder>` | with no existing configuration, uses this folder as the first vault (id `notas`; migration from the first prototype) |
| `--no-window` | server only, no window |
| `--no-browser` | does not open the window or the browser at startup |
| `--no-https` | plain HTTP on the network (testing only) |
| `--no-cert-install` | does not add the authority to Windows trust |
| `--no-firewall` | does not create the Windows Firewall rule |
| `--no-network-name` | does not answer to `<computer>-notes.local` |

## Devices, agents and permissions

- The device that completes the setup wizard is an administrator. On the server computer itself (localhost), pairing is automatic and it is also an administrator.
- Other devices join by invite: QR code (144 bits) or a short 6-character code, single use, valid for 5 minutes. The invite sets the allowed vaults and whether the device is an administrator.
- An already connected device that reads a new invite has its access replaced by the invite's, without becoming a different device.
- **Transfer invite:** a connected device requests (`POST /api/transfer`) an invite bound to itself, to open Cube4Notes at another address (the computer name) without a new QR code. It gets an extra token; removing the device invalidates all of them.
- **Agents:** read-only token, with the chosen vaults; refused on any change and never an administrator.
- Each device keeps all of its allowed vaults offline (one IndexedDB per vault). A vault that stops being allowed disappears from the screen; pending changes in it stay stored on the device.

## Sync

- Local copy in IndexedDB and an operation queue (`put`, `delete`, `mkdir`, `rmdir`, `move` through the `sync` route; `upload` through the `attachment` route). Writes and deletes carry the base version (SHA-256 of the content). Decision: [ADR 0008](../docs/adr/0008-sync-by-base-version.md).
- Conflict: the server keeps its own version and saves the device's as `Note (conflict <device> <date>).md` on an English system (`Nota (conflito ...)` on a Portuguese one), with the date as `yyyy-mm-dd HHmm`.
- A deletion goes to `.trash`; if the note changed before the deletion arrived, it is kept.
- Renames are recorded for 30 days: an edit sent to the old name is applied to the new name (response with `movedTo`).
- History: at most one version every 5 minutes per note, up to 100 versions and 180 days, always keeping the 10 most recent. It follows renames.
- Attachments: images and PDFs up to 25 MB. Ones pasted offline stay on the device and are uploaded with the path the device chose; an identical existing file is reused, a different one gets a suffix. Images referenced in notes are preloaded (up to 10 MB each, 150 MB per vault).
- The interface polls `/api/status` and reloads itself when the server starts serving a new interface.

## API

All routes require `Authorization: Bearer <token>`, except `status`, `pair` and `setup`. The token never goes in the URL. Changes require the same origin (`Origin` or `Sec-Fetch-Site` header). Server errors come as stable codes (`{"error": "pick-folder"}`), translated by the interface.

| Route | Purpose |
| --- | --- |
| `GET /api/status` | name, mode, setup wizard, whether the token is valid, administrator, interface version, address by name (`hostUrl`) |
| `POST /api/pair` `{invite, deviceName, transfer}` | pairs with an invite (no invite on localhost); a connected device gets its access updated; `transfer` uses a transfer invite |
| `POST /api/transfer` | transfer invite for the device itself |
| `GET /api/setup/browse?path=&code=`, `POST /api/setup` | first-run setup wizard |
| `GET /api/vaults` | vaults allowed for the device |
| `GET /api/v/{vault}/manifest` | folders, notes (with version) and attachments |
| `POST /api/v/{vault}/fetch` `{paths}` | content of several notes |
| `POST /api/v/{vault}/sync` `{ops}` | applies the queued operations |
| `GET /api/v/{vault}/raw?path=` | image or PDF from the vault |
| `POST /api/v/{vault}/attachment?name=` or `?path=` | saves an image or PDF (up to 25 MB), in `attachments/` (`anexos/` in vaults created by older versions) or at the given path |
| `GET /api/v/{vault}/history?path=`, `GET .../history/version?path=&id=` | versions of a note and the text of one version |
| `GET /api/admin/browse?path=` | subfolders on the server computer, to pick a vault's folder |
| `POST`, `PATCH`, `DELETE /api/admin/vaults[/{id}]` | creates, renames and removes vaults from the list |
| `POST /api/admin/invite` `{vaults, admin}` | generates an invite |
| `GET`, `PATCH`, `DELETE /api/admin/devices[/{id}]` | lists devices and agents, changes access, removes |
| `POST /api/admin/agents` `{name, vaults}` | creates an agent token (read-only) |
| `GET`, `PATCH /api/admin/server` `{name, mode}` | server name and mode (changing the mode restarts) |
| `POST /api/admin/quit` | quits Cube4Notes (only on the computer itself) |
| `GET`, `POST`, `DELETE /mcp` | MCP for agents ([docs/06-ai-agents.md](../docs/06-ai-agents.md)); over HTTP only from localhost |
| `GET /cube4notes-ca.cer`, `/cube4notes-ca.pem` | certificate authority (also over HTTP, port 43124) |

## Layout

```text
Program.cs            startup, network, routes
src/Config.cs         config.json, migration, vault folder validation
src/Vaults.cs         file operations for each vault (version, conflict, trash, renames, attachments)
src/History.cs        version history of each note (.cube4notes/history)
src/Devices.cs        devices, agents, invites, attempt limits
src/Network.cs        Host/Origin security, paths, local network addresses
src/Tls.cs            local certificate authority and server certificate
src/Mdns.cs           answers to <computer>-notes.local on the local network (mDNS)
src/Firewall.cs       Windows Firewall rules (ports and mDNS), local network only
src/Mcp.cs            read-only access for AI agents (MCP)
src/Interface.cs      serves the interface embedded in the executable
src/AppWindow.cs      app window (Photino) in a separate process
src/Tray.cs           icon near the clock on Windows (Windows API)
src/Lang.cs           language of program messages (the system's)
Cube4Notes.csproj     project
run.cmd               runs from source on Windows
check-build.cmd       only checks that it builds on Windows (check-build.log)
build.cmd/.sh         standalone executable (Windows / Linux and macOS)
install-service.sh    systemd service on a headless Linux
icon/                 app icon (cube4notes.ico)
wwwroot/              compiled interface (under version control)
web/                  interface source code (TypeScript + Vite + Milkdown)
dev/                  Node test server and tests (below)
security/             security test suite (Python, no dependencies)
SECURITY.md           OWASP review and known risks
```

### Interface (`web/src`)

```text
main.ts        screens, editor, sidebar, panel, preferences, devices
store.ts       IndexedDB, offline queue, sync, attachments, API
editor.ts      Milkdown (Crepe), Portuguese text, attachment upload
links.ts       relative Markdown links and rewriting on rename
props.ts       properties (simple YAML) and tags
types.ts       types, templates, relations and lists by type
kits.ts        ready-made template sets (Portuguese and English)
i18n.ts        interface text (Portuguese and English)
termtheme.ts   color themes (Cube4Themes)
icons.ts       interface icons (Lucide)
styles.css     interface styles
fonts.css      interface fonts
image/         interface images (logo)
```

To change the interface: `cd web`, `npm ci`, `npm run build` (builds to `wwwroot/`, which must be committed along with it). During development, `npm run dev` with the server running on port 43125 over HTTP (*This computer only* mode or `--no-https`), or `node dev/mock-server.mjs --config <folder> --port 43125` without building the .NET code.

## Tests

```bash
python dev/test_executable.py dist/<platform>/Cube4Notes    # the real executable, as a new user
python dev/test_sync.py                                     # adversarial sync (two devices, offline, conflicts)
python dev/test_offline.py                                  # app opened and edited without a server
python dev/test_features.py                                 # links, attachments, history, tags, templates, relations, agents
python dev/test_name_address.py                             # switch to the address by name
python dev/test_language.py                                 # no text from the other language in the interface
python dev/test_mdns.py <computer>                          # answer by name on the network (run on the home network)
python security/test_security.py --lan https://<ip>:43125   # security suite against a running server
python ../scripts/check_project.py ..                       # structure and documentation links
```

Documentation screenshots (`docs/images`) are generated with `python dev/screenshots.py`: an English demo vault, the compiled interface and the test server (needs Node, Playwright, openssl and Pillow). Run it again when a screen changes.

The interface tests use Playwright and the Node test server (`dev/mock-server.mjs`), which implements the same API. All of them, except `test_mdns.py` and `test_security.py`, run on GitHub on every push to `main` and on every pull request ([ci.yml](../.github/workflows/ci.yml)).
