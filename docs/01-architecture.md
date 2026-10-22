# Architecture

How Cube4Notes works on the inside. To install and use it, see the [README](../README.md); to work on the code, see the [app technical reference](../app/README.md). Decisions that are costly to reverse are in [`docs/adr`](adr/README.md).

## Overview

```text
                         home network (nothing goes through the internet)
 ┌──────────────────────────────┐
 │ computer that stores the notes│      HTTPS 43125 (HTTP 43124 redirects
 │ (Windows, Linux or server)    │      and serves the certificate)
 │                               │◀──────────────── phone / tablet / other computer
 │  Cube4Notes (one executable)  │                  browser or home-screen app
 │  ├─ web server (.NET 10)      │                  full local copy (IndexedDB)
 │  ├─ embedded interface        │                  offline change queue
 │  ├─ answers by name (mDNS)    │
 │  └─ read-only MCP             │◀──────────────── AI agents (their own token)
 │                               │
 │  vaults = folders with .md    │
 └──────────────────────────────┘
```

- **One process, one executable.** The web server, the interface (built and embedded as a resource) and agent access are in the same program. There is no database, proxy, container or external service.
- **The files are the source of truth.** Each vault is a plain folder with Markdown files and attachments. Everything else Cube4Notes stores lives in `<vault>/.cube4notes/` and `<vault>/.trash/`, and the configuration lives in a separate folder.
- **Each device has a full copy** of the vaults it is allowed to use and works on it. The server is the meeting point: devices never talk to each other.
- **Local network only.** The server refuses any client that is not on one of the computer's active private networks. There is no tunnel, relay, cloud or port forwarding on the router.

## Processes and window

| Situation | What runs |
| --- | --- |
| Computer with a screen | the main process is the server; the app window (Photino: WebView2 on Windows, WebKitGTK on Linux, WebKit on macOS) runs in a second process (`--window <address>`) |
| Opening Cube4Notes again | only opens another window for the server that is already running |
| *This computer only* | closing the window shuts everything down |
| *Home network* | closing the window leaves the server serving the other devices; on Windows an icon stays near the clock (open, allow through the firewall, quit) |
| No screen (Linux server) or `--no-window` | only the server, in the console or as a systemd service (`install-service.sh`) |

Changing the mode (in Preferences) saves the configuration and restarts the server inside the same process. The port is chosen on the first run or with `--port`.

## Storage

```text
<configuration folder>             %LOCALAPPDATA%\Cube4Notes on Windows, ~/.local/share/Cube4Notes on Linux
  config.json                      server name, mode, port, list of vaults
  devices.json                     devices and agents (only the token hashes), administrators, allowed vaults
  tls/                             local certificate authority, server certificate and the addresses it covers

<vault>/                           folder chosen by the user
  *.md, subfolders                 the notes
  attachments/                     pasted images and PDFs (vaults created by older versions keep anexos/)
  templates/ or modelos/           note templates (regular notes)
  .cube4notes/history/<note>/    previous versions of each note
  .cube4notes/renames.json         recent renames (30 days)
  .trash/<date>/                 what was deleted
```

## Sync

Each device keeps, in one IndexedDB per vault: the notes, the folders, the attachments and an **operation queue** (`put`, `delete`, `mkdir`, `rmdir`, `move`, and `upload` for attachments). Editing, creating, renaming or deleting always changes the local copy and enters the queue; sending happens when the server responds.

1. The device sends the queue of notes and folders (`POST /api/v/{vault}/sync`); attachments are uploaded one by one (`POST /api/v/{vault}/attachment`). Saving and deleting a note carry the **base version**: the SHA-256 of the content the device had when it started editing.
2. The server compares it with the current version of the file:
   - same: it applies the change;
   - different (someone changed the note in the meantime): it **keeps the server version** and saves the device's version as a copy, `Note (conflict <device> <date>).md`. The device shows a warning and the two versions sit side by side.
3. Deletion goes to `.trash`. If the note changed after the device saw it, the deletion is refused and the note stays.
4. A rename is recorded for 30 days: an edit that arrives under the old name is applied to the new name instead of recreating the note.
5. The device downloads the server's list (`manifest`, with the version of each note) and fetches only what changed (`fetch`).

The principle that holds in every case: **no change is ever silently discarded.** The worst case is a conflict copy for the user to merge.

**History.** Before changing a note, the server saves the previous version in `.cube4notes/history`, at most one every 5 minutes per note (continuous edits become a single version). Up to 100 versions and up to 180 days are kept, but the 10 most recent are never removed. The history follows the note when it is renamed or moved. Restoring a version saves a new version; nothing is deleted.

**Attachments.** Images and PDFs (up to 25 MB) pasted offline stay on the device and are uploaded later, with the path chosen by the device. If a different file with the same name already exists, the server adds a suffix; if it is the same file, it reuses the existing one. Each device preloads the images referenced in the notes (up to 10 MB each), up to a total of 150 MB per vault counting what is already stored, so they open offline.

## Interface

- TypeScript, Vite and Milkdown (Crepe) for visual editing. The saved Markdown follows the standard (lists with `-`, plain relative links), readable by any other editor.
- A **service worker** stores the interface on the device: the app opens without a server and without internet, using the data in IndexedDB.
- The interface queries `/api/status` and reloads by itself when the server starts serving a new version.
- **Links** between notes are standard Markdown links with a relative path. Renaming or moving a note rewrites the links that point to it in the other notes ([ADR 0003](adr/0003-standard-markdown-links.md)).
- **Types, templates and relations** come from the Markdown itself: `tipo:` (or `type:`) in the properties, templates are regular notes in the templates folder, and a field whose value is the name of another note is a relation. Everything is computed on the device, also offline ([ADR 0005](adr/0005-types-templates-and-relations.md)).
- Interface language per device (Portuguese or English). The program itself (icon, system notifications, console) follows the operating system language.

## Network and security

- **Ports:** 43125 (HTTPS, the app) and 43124 (HTTP: redirects to HTTPS, serves the authority certificate as `.cer` and `.pem`, and serves `/mcp` only for agents on the same computer). In *This computer only* mode, only HTTP on `localhost:43125`.
- **Certificate:** on the first run in *Home network* mode, Cube4Notes creates **its own certificate authority**, restricted to local names and private IPs. It signs the server certificate, which covers the computer's current IPs and the name `<computer>-notes.local`, and is regenerated automatically when the addresses change. Each device installs the authority once. On the server's own Windows machine it is installed with the user's confirmation.
- **Address by name:** Cube4Notes itself answers for `<computer>-notes.local` on the local network (mDNS, UDP 5353), only to local network clients and only with local addresses. The QR code uses the IP; a device that can reach the name can switch to it without pairing again ([ADR 0006](adr/0006-address-by-computer-name.md)).
- **Devices:** each device has its own token (the server stores only the hash). Joining requires a single-use invitation, valid for 5 minutes, by QR code or 6-character code. The invitation defines the vaults and whether the device is an administrator. On the server's own computer (localhost), pairing is automatic.
- **Checks on every request:** local network client, known `Host` header (IP, `localhost`, computer name), same origin on changes, token on API routes, paths always inside the vault, size limit and pairing attempt limit.
- **Windows firewall:** one rule for the ports (43124-43125 TCP) and one for mDNS (UDP 5353), local subnet only, created once with Windows confirmation.
- Full review and known risks: [app/SECURITY.md](../app/SECURITY.md).

## AI agents

Agents read the notes through the MCP protocol at `/mcp`, with an agent token that is read-only and only reaches the chosen vaults. Tools: list vaults, list notes, read note, search and recent notes. Agents never change notes and never get access to the disk ([ADR 0004](adr/0004-read-only-ai-agents-mcp.md)). How to set it up: [docs/06-ai-agents.md](06-ai-agents.md).

## Builds and checks

- The project targets `net10.0` (never `net10.0-windows`): it builds and runs on Windows, Linux and macOS. What belongs to a single system (tray, firewall, trusting the certificate) sits behind a runtime check.
- `build.cmd` (Windows) and `build.sh` (Linux and macOS) produce a single file with the interface embedded, which runs without .NET installed. The program runs with invariant globalization: it does not depend on the ICU library.
- On every push to `main` and on every pull request, GitHub Actions ([ci.yml](../.github/workflows/ci.yml)):
  - builds and tests the executable on Windows, Linux and macOS the way a new user would ([test_executable.py](../app/dev/test_executable.py));
  - builds and tests on a minimal Debian, without extra libraries;
  - installs and updates the systemd service;
  - runs the interface tests (sync, offline, features, address by name and language) against the Node test server.
