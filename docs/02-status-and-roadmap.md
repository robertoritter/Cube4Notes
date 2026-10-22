# Status and next steps

Status as of October 2026: **ready to use, in daily use** on Windows, a headless Linux server and iPhone. Every change is built and tested on Windows, Linux and macOS before it reaches anyone.

## Delivered

| Phase | What it delivers | Status |
| --- | --- | --- |
| Server and web editing | .NET 10 server as a single executable, visual Markdown editing (Milkdown), multiple vaults, its own app window, first-run wizard | done |
| Offline mobile client | interface stored on the device (service worker), full copy in IndexedDB, change queue that survives closing the app | done, validated on iPhone |
| Sync and conflicts | per-note base version, conflict copy, trash, renames that follow the note, version history with restore | done, covered by adversarial tests |
| Network and security | HTTPS with its own authority, a token per device, single-use invitations, local network only, Windows firewall, OWASP review | done ([SECURITY.md](../app/SECURITY.md)) |
| Stable address | answers by the name `<computer>-notes.local` (mDNS), address switch without pairing again, IP reservation guide | done ([ADR 0006](adr/0006-address-by-computer-name.md)) |
| Organization | links between notes that follow renames, tags and properties, types, templates and relations, today's note, template sets in Portuguese and English | done |
| AI agents | read-only MCP with a token per agent and chosen vaults | done ([06-ai-agents.md](06-ai-agents.md)) |
| Linux server | executable for x64 and ARM64, systemd service with installer | done, in use on Debian 13 |
| Continuous verification | executable tested on Windows, Linux and macOS, minimal Debian, systemd service and interface tests, on every push to `main` | done ([ci.yml](../.github/workflows/ci.yml)) |

## Being validated

- **Android** and browsers other than Edge (Windows window) and Safari (iPhone): they should work, but have not been validated on a real device yet. Android resolves `.local` names inconsistently; with the IP reserved on the router this does not matter.
- **Window on Linux with a screen** (Photino with WebKitGTK): it builds, but has not been validated on a Linux desktop yet.

## Next steps

1. **Releases published on GitHub**: ready-to-use executables (Windows, Linux x64 and ARM64) produced by CI for each release, for people who do not want to build.
2. **macOS as an app**: `.app` package with window and icon. The executable is already built and tested in CI; the package and certificate trust through the Keychain are still missing.
3. **Highlighting `#tags` in the editor**: tags work today (panel, filters, suggestions when typing `#`), but they are not highlighted in the text.

Recorded ideas, **not yet decided**: per-type lists as a board (kanban) and calendar, building on the types and fields that already exist.

## How each change is delivered

Each increment ends with relevant tests, updated documentation and a small, descriptive commit. Publishing (push, release) only happens after explicit approval.
