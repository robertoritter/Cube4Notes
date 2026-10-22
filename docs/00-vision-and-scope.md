# Vision and scope

## The problem

Note-taking tools usually force a bad choice. One option is to keep everything in a company's cloud. The other is to set up sync, servers and plugins, and hope the phone does not lose what was written offline. On top of that, writing Markdown "by hand" pushes away people who just want to write.

Cube4Notes starts from three ideas:

1. **The notes are your files.** Plain Markdown, in a plain folder, readable by any editor and any program.
2. **The home computer is the server.** Nothing goes through the internet: devices talk directly to the computer that stores the notes, over the local network.
3. **Each device works on its own.** Phones, tablets and other computers keep a full copy and keep working away from home; when they come back, they sync without losing anything.

## Who it is for

- People who want notes on several devices without an account, a subscription or a cloud.
- People who want visual editing (headings, lists, tables, images) without memorizing syntax, while the files stay in portable Markdown.
- People who use AI agents and want them to read the notes without giving them access to the disk.
- People who have no server at home: the same executable runs on their own computer, in *This computer only* mode.

## What Cube4Notes is

- A single executable that stores the notes, serves the web interface and syncs the devices on the home network.
- A visual Markdown editor that works in the browser on the computer, the phone and the tablet, and also offline.
- Multiple vaults (any folder can be one), with access chosen per device.
- Links between notes, types, templates and relations, tags and properties, version history, offline attachments.
- Read-only access for AI agents, through MCP.

## What Cube4Notes is not (by design)

- **It is not a cloud service** and does not open access from the internet: no tunnel, relay, port forwarding or account.
- **It is not real-time collaborative.** Each device edits its own copy; simultaneous edits to the same note become a conflict copy to merge, never a loss.
- **It does not sync devices with each other.** The server is the meeting point.
- **It has no plugins and no compatibility with other editors' ecosystems.** The files are standard Markdown; any editor opens them.
- **Agents do not write.** AI access is read-only.
- **There is no native app for iPhone, iPad or Android.** The mobile client is the web interface, installable on the home screen and usable offline.

## Principles that guide decisions

- No change is ever silently discarded. A conflict becomes a copy, a deletion goes to the trash, an edit to a renamed note follows the note.
- Easy to install in any environment: one executable, no database, proxy or containers. No manual per-machine configuration.
- Security is a core requirement: HTTPS with its own authority, a token per device, single-use invitations, local network only.
- Always builds and runs on Windows, Linux and macOS (`net10.0`), verified in CI.
- Explicit documentation about what can go wrong (network, IP, certificate), without hiding limits.

Detailed decisions: [`docs/adr`](adr/README.md). Current status and next steps: [02-status-and-roadmap.md](02-status-and-roadmap.md).
