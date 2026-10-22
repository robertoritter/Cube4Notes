# Use cases

The scenarios Cube4Notes needs to support and how each one works today.

## 1. A computer on the home network

Cube4Notes runs on the computer that stores the notes (the user's own or an always-on server). Another computer in the house opens `https://<server-ip>:43125` in the browser, connects once with the QR code or the 6-character code and edits with the same interface. There is no need to mount the server's disk or install anything other than the certificate.

## 2. Phone or tablet at home

The device scans the QR code, installs the certificate once and, if desired, adds Cube4Notes to the home screen. The interface is designed for touch: formatting toolbar, block menu with `/`, relations below the note and lists as cards. Step by step: [Connecting a phone](../README.md#connecting-a-phone-step-by-step).

## 3. Phone or tablet away from home

The server cannot be reached from outside, by design. The device keeps the full copy of the vaults it is allowed to use: it opens, edits, creates and organizes notes and folders, and pastes images and PDFs. Everything is stored on the device and survives closing and reopening the app.

## 4. Back home

When it reaches the server, each device sends its change queue and receives the others' changes. Changes to different notes simply merge. If the same note changed on the device and on the server, both versions are kept: the server's in place and the device's as a conflict copy, with a warning. Nothing is silently discarded. Details: [architecture, sync](01-architecture.md#sync).

## 5. Server off or always on

With the server off, each device works on its own copy; devices do not sync with each other. With an always-on server (for example a Linux machine running Cube4Notes as a service), it is available all the time inside the house. "Always on" does not mean reachable from the internet.

## 6. The router changes the computer's IP

Devices store the server's address. If the router gives the computer a different IP, they can no longer find it. The recommended fix is to reserve the IP on the router; as an alternative, Cube4Notes answers by the name `<computer>-notes.local` and offers to switch to that address. Full explanation: [How devices find your computer](../README.md#how-devices-find-your-computer).

## 7. An AI agent reading the notes

An agent on a computer in the house reads the notes through MCP, with a token that is read-only and only reaches the chosen vaults. It never gets access to the disk and never changes notes. Setup: [06-ai-agents.md](06-ai-agents.md).

## 8. No server at home

Someone with a single computer uses *This computer only* mode: the same executable, with no network, no certificate and no firewall. It can be switched to *Home network* later, in Preferences, without losing anything.
