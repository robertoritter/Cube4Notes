# ADR 0009: HTTPS with a certificate authority created by Cube4Notes itself

- Status: accepted (recorded after implementation)
- Date: 2026-10-20

## Context

Devices talk to the server over the home network, without internet. Browsers only allow service workers (offline app), the clipboard and persistent storage in a secure context (HTTPS or `localhost`). Certificates from public authorities require a domain on the internet, which goes against the rule of not depending on an external service. Device and agent tokens must not travel in plain text.

## Decision

- In *Home network* mode, Cube4Notes creates its own certificate authority on first run, restricted to local names and private IPs (Name Constraints), and stores it in the configuration folder.
- It signs the server certificate, which covers `localhost`, the computer name, `<computer>-notes.local` and the current private IPs. The certificate is stored and regenerated automatically when the addresses change.
- Each device installs the authority once. It is delivered over plain HTTP (port 43124), as `.cer` and `.pem`, because it has to be downloaded before it can be trusted. Apart from that, port 43124 only redirects to HTTPS; the only exception is `/mcp` for agents on the computer itself (`localhost`), whose token does not leave the machine.
- On the server's own Windows, the authority is added to the user's trust store, with Windows confirmation.
- *This computer only* mode uses HTTP on `localhost`, which browsers already treat as secure.

## Alternatives

- HTTP on the local network: the app would not work offline and tokens would travel in plain text.
- Self-signed certificate per server: would require accepting a warning per address, and the warning would come back on every IP change.
- Public domain with Let's Encrypt and DNS pointing to a private IP: depends on the internet, a domain and an external service.

## Consequences

- Installing the certificate is a required step on each device, documented per system in the README.
- If the authority changes (`tls` folder deleted, another configuration folder, another computer), all devices must reinstall it.
- Node.js and Python programs do not use the system trust store; that is why the authority is also delivered as PEM ([06-ai-agents.md](../06-ai-agents.md)).
