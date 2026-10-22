# Security review (OWASP Top 10)

Date: October 19, 2026, revised on October 21, 2026 (links, offline attachments, history, AI agents) and October 22, 2026 (Linux server as a service, authority in PEM, error messages). Scope: the `Program.cs` server, the `web/` interface and the API contract. Method: code review item by item against the OWASP Top 10, fixes, and an automated attack suite (`security/test_security.py`, currently 101 checks over HTTPS, including vaults, per-device permissions and agent tokens) plus browser tests for script injection.

**How the tests were run:** the suite passed 66/66 (over HTTPS), then 73/73 after vaults and, with agents, attachments, history and address switching, 101/101 over HTTPS against the test server `dev/mock-server.mjs`, which implements the same rules as the .NET server. The full suite still needs to run against the .NET server on a computer on the network (instructions at the end). Some of the rules are already checked on the real .NET executable on every push, on Windows, Linux and macOS (`dev/test_executable.py`): wrong setup code refused over the network, API without a token refused, HTTP redirecting to HTTPS and an HTTPS connection verified with the Cube4Notes authority.

## Findings and fixes

| OWASP | Problem found | Fix |
| --- | --- | --- |
| A01 Access control | **DNS rebinding**: a malicious site opened on the server computer could pose as `localhost`, pair on its own (localhost requires no code) and read all notes. | The server only accepts the names `localhost`, `127.0.0.1`, the computer name and its local IPs; any other `Host` gets 421. |
| A01 | **CSRF**: another page could trigger writes. | Every request that is not a read must come from the same origin (`Origin`/`Sec-Fetch-Site`); otherwise 403. |
| A01 | 6-digit code valid for the whole run, for any number of devices, shown in the console. | Replaced by a **single-use invite** (QR code with 144 random bits, or a short 6-character code to type), valid for 5 minutes, generated only on the server computer. The short code has about 1 billion combinations and each address can only fail 10 times every 10 minutes. |
| A01 | There was no way to revoke a device's access. | Device list with **Remove**; the token stops working immediately. Generating invites and managing devices and vaults only from an **administrator** device (the one from the first-run setup wizard, the server computer itself, or one that received an administrator invite). |
| A01 | Paths: reserved Windows names (`CON`, `AUX`, `COM1`...), network paths `\\server\...` and invalid characters on Linux were not blocked. | Single validation: nothing absolute, nothing outside the folder, nothing hidden, no `..`, no shortcuts/junctions, no reserved names, length limits. |
| A02 Cryptography | **Plain HTTP traffic** on the local network: notes and token visible to anyone capturing the Wi-Fi. Also, recent Chrome forces `https://` and could not connect. | **HTTPS** on the main port, TLS 1.2 or higher (1.0/1.1 refused), with its own certificate authority created on the computer. The authority has **name constraints** (only `localhost`, `*.local`, the computer name and private IPs): verified that a forged certificate for `www.google.com` or `8.8.8.8`, even signed by it, is refused. Encoding checked byte by byte against a reference library. |
| A02 | The token went in the image URL (`?t=`), showing up in history and logs. | Token only in the `Authorization` header; images are downloaded with `fetch` and shown as a local blob. |
| A03 Injection (XSS) | An `.html` or `.svg` attachment uploaded by a device would be served on the same origin and could steal the other devices' tokens. | Attachments only `png jpg gif webp avif bmp pdf`, up to 25 MB; files served with `Content-Security-Policy: sandbox`; anything that is not an image/PDF is sent as a download. |
| A03 | Ctrl+click opened any link scheme, including `javascript:`. | Only opens `http`, `https` and `mailto`. |
| A03 | (verified, no flaw) HTML inside a note. | The editor shows HTML as text; no script, `onerror` or `iframe` is created. Tested in the browser. |
| A04 Insecure design | No batch limits. | At most 500 operations per sync, 500 reads per request, notes up to 10 MB, body up to 32 MB, headers up to 32 KB. |
| A05 Configuration | Protective headers were missing. | `Content-Security-Policy` with no external or inline scripts, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, `COOP`/`CORP`, `Permissions-Policy`; API with `no-store`. |
| A05 / A09 | Errors returned the exception message (with full disk paths). | Generic `server error` response; the detail only appears in the server console. |
| A06 Components | 4 low-severity alerts in the KaTeX library (formulas), which ships with the editor. | Formula feature turned off and version pinned to the fixed one: `npm audit` reports no vulnerabilities. The server uses no external packages, only .NET. |
| A07 Authentication | No brute-force protection for pairing over the network. | 10 wrong invites block that address for 10 minutes (429). 256-bit tokens, stored only as SHA-256, compared in constant time. |
| A08 Integrity | (verified) | Atomic writes of notes and of the device list; no change is discarded (a conflict becomes a copy, a deletion goes to `.trash`). |
| A09 Logging | Suspicious attempts did not show up. | The console logs refused Host/Origin, invalid invites, blocks, connected and removed devices, with a limit to avoid flooding. |
| A10 SSRF | (not applicable) | The server makes no outbound requests. |
| A01 | (new, October 21) AI agents needed to read notes without getting the power of a device. | Dedicated agent token, **read-only** and with a mandatory vault list: never an administrator (not even on the computer itself), any non-read method on the API gets 403, it cannot swap its access through an invite, and it only reads the allowed vaults through `/mcp`. From the network, `/mcp` only over HTTPS (HTTP redirects); over HTTP only on the computer itself. `/mcp` goes through the same Host, Origin and local network rules. |
| A01 | (new, October 21) Attachment uploaded with a path chosen by the device (attachments pasted offline). | Same path validator as for notes; only image and PDF types (never `.md`); an existing file is never overwritten (it gets a suffix); hidden temporary file until finished. |
| A01 | (new, October 21) A device that switches to the address by computer name needed access at the new address without a new QR code. | Transfer invite created only by the authenticated device itself, single use, valid for 5 minutes and bound to that device: it gives the same device an extra token (at most 5 extra), with the same access. It does not work as a regular invite, and a regular invite does not work as a transfer. Removing the device invalidates all of its tokens. |
| A01 | (new, October 21) Version history read by path and id. | Path validated as a note; id only in date format (`yyyyMMdd-HHmmss-fff`), with no way to build a path outside `.cube4notes/history`. |
| A05 / A09 | (new, October 22) Error messages from vault configuration came as server text. | The server returns only stable codes (`pick-folder`, `is-file`...) and the interface translates them; no system message or internal path reaches the device. |
| A02 | (new, October 22) Agents in Node.js and Python do not use the system trust store, which led people to turn off certificate verification in order to connect. | The authority is also served in PEM (`/cube4notes-ca.pem`), with instructions for `NODE_EXTRA_CA_CERTS` and `REQUESTS_CA_BUNDLE`; the documentation recommends never turning off verification. |
| A05 | (new, October 22) Service on Linux. | Runs as the user who installed it, never as root; the executable lives in `/opt/cube4notes`, with no write permission for the service, and the program writes nothing to its own folder (checked in CI). |

## Remaining risks (accepted)

- **Local authority key without a password** in `tls/` inside the configuration folder (`%LOCALAPPDATA%\Cube4Notes` on Windows, `~/.local/share/Cube4Notes` on Linux), within the user's folder. Anyone with access to it could impersonate the server **only on local addresses**, thanks to the name constraints. Devices that have not installed the certificate accept the connection after the browser warning, with no protection against someone impersonating the server on the network; install the certificate.
- **Whoever uses the server computer itself is an administrator.** `localhost` pairs without an invite and manages devices. Any program running on that computer would already have access to the files, so this does not widen the risk.
- **Administrator status comes from the token, not the address.** An administrator device stays an administrator from anywhere on the local network (needed to set up a headless machine). Give administrator invites only to your own devices; the others get only the chosen vaults.
- **The administrator can choose any folder on the server computer as a vault.** The disk root, system folders, the configuration folder and folders inside another vault are refused; the rest is the administrator's decision.
- **Paired devices are trusted to write.** A compromised device can change notes (always with a conflict copy and the trash, never deleting for good). To revoke access: Remove.
- **Token stored in the device's browser** (IndexedDB). The CSP reduces the risk of a script stealing it; if the device is lost, remove it from the list.
- **Port-based firewall rule.** In Home network mode, Windows opens ports 43124 and 43125 only to the local subnet (`remoteip=localsubnet`), on any network profile, so the phone can connect even if Windows classifies the Wi-Fi as public. The server still refuses any address outside the local network. Old rules tied to the `.exe` path are deleted, because a block rule for the program would win over the allow rule.
- **An agent token gives read access to everything allowed.** Anyone who copies the token can read those vaults from inside the home network. Allow only what is needed and remove the agent when it is no longer used. The console logs each tool used by each agent.
- **Attachments and history stored with no total space limit.** History is limited to 100 versions per note and 180 days; attachments stored on the device, to 150 MB of preloading per vault (whatever is opened stays stored).
- **Computer name on the network (`<computer>-notes.local`).** Any machine on the network can answer to that name, but the connection requires the certificate from this computer's Cube4Notes authority, which no other machine has; the token is not valid on another server either. The Windows firewall accepts name queries (UDP 5353) only from the local subnet. The server itself answers to the name (mDNS): only to queries about its own name, only from local network addresses and only with its own local IPs; mDNS does not cross routers.
- **Notes not encrypted on disk** on the server and on devices; this relies on the system's own protection (BitLocker, phone lock).

## Running the suite on the server computer

With the server running, in a terminal in the `app` folder:

```bash
python security/test_security.py --lan https://<computer-ip>:43125
```

`--lan` is the network address of the server computer itself: the server sees these requests as coming from another device. The brute-force test blocks that address for 10 minutes (`localhost` keeps working); to skip it, add `--no-brute-force`. The test creates and removes two test devices, sends the `_security_test` folder to `.trash` and leaves a `fora.png` in the vault's attachments folder (`attachments/`, or `anexos/` in older vaults) that can be deleted.

The test downloads the certificate over port 43124 and verifies the chain for real. For an additional external scan, you can point OWASP ZAP (baseline mode) at `https://localhost:43125`.
