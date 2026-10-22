# ADR 0006: Address by computer name, with the IP as a fallback

- Status: accepted
- Date: 2026-10-21

## Context

Devices store the app, offline notes and the token per address (browser origin). The QR code carried the computer's IP. When the router gave the computer a different IP, the phone kept looking for the old IP and stayed at "No server"; to the browser, the new IP is a different site, with no notes and no pairing.

## Decision

- The QR code still uses the IP, which works on any device.
- The server reports in `/api/status` the address by name (`https://<computer-name>-notes.local:<port>/`), covered by the local certificate. The `-notes` suffix avoids competing for the name with the system itself: in the first real test, Windows answered for `<computer>.local` with the address of a VPN, which the phone cannot reach.
- On a device that uses the IP, the app tests whether it can reach the name (by loading the server icon from the named address; only that file can be loaded from another origin). If it can, it offers the switch. The switch first sends pending changes and uses a **transfer invite**: single use, valid for 5 minutes, created by the authenticated device itself and bound to it, which gives one more token to the same device at the new address. Nothing is duplicated and access stays the same.
- The server itself answers for the name on the local network (mDNS), because Windows often does not answer for `<name>.local` or answers with the wrong address. It answers only for its own name, only to local network addresses and only with local IPs.
- The Windows firewall now also accepts name queries (mDNS, UDP 5353), only from the local subnet.
- The documentation explains the two kinds of address and the limits of the name, and recommends reserving the IP on the router.

## Alternatives

- QR code with the name: would fail on devices that do not resolve `.local` (many Android devices, guest networks).
- Searching for the server by scanning the network when the IP changes: slow, and the app at the old address would have no way to use the server at the new address (different origin, no data).
- Name server or external service: goes against the rule of never depending on the internet.

## Consequences

- Devices that resolve `.local` (iPhone, iPad, macOS, Windows, Linux) no longer depend on the IP.
- On iPhone and iPad, the Home Screen shortcut must be recreated after the switch.
- Android and networks that block mDNS keep using the IP; for those, the recommendation is to reserve the IP on the router.
- Removing a device invalidates all of its tokens, for every address.
- The name only works if the device trusts the Cube4Notes certificate. If the authority changes (`tls` folder deleted, another configuration, another computer), each device must remove the old certificate and install the new one; the README explains the steps for each system.
