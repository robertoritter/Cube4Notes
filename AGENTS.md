# Project instructions

## Context

Cube4Notes is an independent product: a personal server for Markdown files with visual web editing and local/offline sync between devices. Other editors may serve only as a reference for general product ideas; Cube4Notes will have no plugins, integrations, compatibility APIs or dependencies on Obsidian or SilverBullet.

Read `README.md`, `docs/00-vision-and-scope.md`, `docs/01-architecture.md` and `app/README.md` before substantial changes.

## Standing rules

- Human-readable Markdown is the canonical format for notes.
- Keep the distinction between facts, hypotheses, proposals and decisions.
- License decided: MIT (`LICENSE`, ADR 0002). Do not change the license or add others without an explicit decision by the owner.
- Do not invent requirements, integrations, commands or platform support that do not exist.
- Cube4Notes runs on the computer that holds the notes (the user's own computer or an always-on home server); other computers, phones and tablets are clients.
- The server is reachable only from the home's local network. Do not set up external access, remote tunnels or cloud services.
- Phones and iPads must keep data and changes locally while offline and sync when they reach the server again.
- Resolve conflicts by preserving changes; no version may be silently discarded.
- Treat security and local authorization as core requirements; agents read through controlled interfaces, with no direct privileged access to storage.
- Record decisions that are expensive to reverse in `docs/adr/` before implementation.
- Update documentation and tests when a change alters scope or behavior.

## Delivery protocol

For each requested increment:

1. implement only the authorized scope;
2. run the relevant local tests and checks;
3. create a small, descriptive local Git commit;
4. **STOP** and give the user manual validation instructions;
5. `push` only after explicit approval from the user.

Never jump straight from the local commit to publishing, a release or a `push`.

## Environments

- The code builds and runs on Windows, Linux (x64 and ARM64) and macOS. Never use `net10.0-windows` or dependencies that exist on only one system; anything system-specific sits behind a runtime check.
- Reference home server: headless Linux (Debian), running as a systemd service. Clients: browsers on Windows, Linux, macOS, iPhone, iPad and Android.
- macOS is checked in CI (macOS runner); do not assume access to a Mac for debugging.

## Repository map

| Area | Responsibility |
| --- | --- |
| `app/` | Cube4Notes itself: .NET server, embedded interface, build and service scripts ([technical reference](app/README.md)) |
| `app/web/` | interface source code (TypeScript, Vite, Milkdown); builds to `app/wwwroot/`, which is under version control |
| `app/dev/` | Node test server with the same API, and the tests (Playwright and the executable test) |
| `app/security/`, `app/SECURITY.md` | security test suite; OWASP review and known risks |
| `docs/` | vision, architecture, status, scenarios, AI agents, license |
| `docs/adr/` | accepted decisions |
| `.github/workflows/ci.yml` | checks on every push to `main` and on pull requests |
| `scripts/check_project.py` | minimum structure and documentation links |

## Verification

- Before finishing a change, run the tests that cover the area ([list in app/README.md](app/README.md#tests)) and `python scripts/check_project.py`.
- Changed the interface: run `npm run build` in `app/web` and commit `app/wwwroot` along with it.
- Changed the server or the scripts: confirm that CI still covers the path a new user follows (`app/dev/test_executable.py`, systemd service, minimal Debian).
- Document only commands that exist and have been verified. Interface text always in both languages (`app/web/src/i18n.ts`), and `app/dev/test_language.py` must keep passing.
- Public files carry no personal names, machine names or personal e-mails. Product names: always "Cube4" + name, no hyphen.
