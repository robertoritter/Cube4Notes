# ADR 0007: Single .NET executable with the interface embedded

- Status: accepted (recorded after implementation)
- Date: 2026-10-20

## Context

Cube4Notes must be easy to install in any environment: people without a home server use it on their own computer, and people with a headless Linux server leave it running as a service. Earlier experiences with note tools showed that requiring a reverse proxy, database, containers or manual per-machine configuration drives users away. The server also has to build and run on Windows, Linux and macOS.

## Decision

- Server in .NET 10 (ASP.NET Core, Kestrel), targeting `net10.0` and never `net10.0-windows`. Anything specific to one system (tray icon, firewall and certificate trust on Windows) sits behind a runtime check.
- Web interface (TypeScript, Vite, Milkdown) built into `app/wwwroot` and embedded in the executable as a resource.
- Single-file, self-contained publishing (does not need .NET installed), with invariant globalization (does not depend on the ICU library).
- Native app window with Photino (system WebView), in a second process, so the window can close without taking the server down.
- File-only storage: notes in the vault folders and configuration in JSON in a dedicated folder. No database.

## Alternatives

- Electron or Tauri: better integrated window, but a larger package (Electron) or another build toolchain (Rust); the server would still be needed.
- Node.js on the server: same language as the interface, but would require bundling the runtime; the Node test server (`app/dev/mock-server.mjs`) exists only for development.
- SQLite database for the index and versions: faster in very large vaults, but creates a second format to keep consistent with the files.

## Consequences

- Installing means copying one file and opening it. On Linux, `build.sh` and `install-service.sh` cover the headless server.
- CI must build and test the executable on all three systems, because platform errors (such as missing ICU on a minimal Debian) only show up in the real executable.
- The built interface is kept under version control in `app/wwwroot`, so that anyone who only builds the .NET part gets the right interface.
