# ADR 0003: Links between notes in standard Markdown

- Status: accepted
- Date: 2026-10-21

## Context

Notes linked to each other are what turn a folder of files into a knowledge base. Two formats are in use: the standard Markdown link (`[text](folder/note.md)`), which any editor and GitHub understand, and the wiki link (`[[Name]]`), shorter to type, but which outside some apps shows up as raw text and depends on the note name being unique in the vault.

## Decision

Cube4Notes writes links between notes in **standard Markdown, with a path relative to the note** and encoded (`%20` for spaces). For typing, `[[` opens the list of notes and inserts the standard link; `[[Name]]` typed in full also becomes a standard link. Existing `[[Name]]` links (coming from other editors) still show up in backlinks and follow renames, but Cube4Notes does not create them.

When a note, folder or attachment is renamed or moved **on this device**, the links in other notes and the relative links in the note itself are rewritten. Renames coming from another device do not rewrite again (the device that did the rename already rewrote them).

## Alternatives

- `[[Name]]` as the stored format: shorter, but breaks the rule of Markdown readable in any editor and is ambiguous with repeated names.
- Path from the vault root (`/folder/note.md`): does not work in editors that open only the note's folder.

## Consequences

- Notes keep opening with working links in VS Code, on GitHub and in other Markdown editors.
- A note renamed outside Cube4Notes (in Explorer, for example) does not update links: the link points to a note that does not exist and Cube4Notes offers to create it.
- Links inside code blocks are never changed.
