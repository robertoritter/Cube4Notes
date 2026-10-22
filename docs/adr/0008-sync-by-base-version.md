# ADR 0008: Sync by base version, with a conflict copy

- Status: accepted (recorded after implementation)
- Date: 2026-10-20

## Context

Phone, tablet and other computers edit offline and reconnect to the server later. The same file can change in two places. The project rule is that no change is ever silently discarded, and the result must remain plain Markdown, with no conflict markers inside the text.

## Decision

- Each device keeps a full copy of the vaults it is allowed to access (IndexedDB) and a queue of operations (`put`, `delete`, `mkdir`, `rmdir`, `move`, `upload`).
- Writing and deleting a note carry the base version: the SHA-256 of the content the device had. Attachments are uploaded separately and never overwrite a different file.
- The server applies the operation if the current version equals the base version. If it differs, it keeps the server version and saves the device's version as `Note (conflict <device> <date>).md` (`Nota (conflito <aparelho> <data>).md` on a Portuguese system).
- Deletions go to `.trash`; deleting a note that changed afterwards is refused.
- Renames are recorded for 30 days, so that edits made under the old name follow the note.
- The server keeps previous versions (`.cube4notes/history`), so any change can be undone.
- Devices only sync with the server, never with each other.

## Alternatives

- Automatic text merge (diff3) or CRDT: fewer conflict copies, but can produce text nobody wrote, and CRDT requires storing a custom format in addition to Markdown.
- Last write wins: simple, but loses text without warning, which the project rule forbids.
- Sync between devices (peer-to-peer): would not need the server to be on, but multiplies conflict cases and would require discovery between devices.

## Consequences

- The worst case is a conflict copy, visible and marked in the app, for the user to merge.
- Covered by adversarial tests (`app/dev/test_sync.py`, `test_offline.py`), which run in CI.
- Real-time simultaneous editing is out of scope.
