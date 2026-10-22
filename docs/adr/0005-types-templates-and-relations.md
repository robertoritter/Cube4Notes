# ADR 0005: Types, templates and relations between notes

- Status: accepted
- Date: 2026-10-21

## Context

The owner wants to record linked entries (companies, people, meetings, but also books, games, classes) and see those links in an organized way, on the computer and on the phone, also without a server. A spatial graph shows that a link exists, but not what kind.

## Decision

- **Type** is the note's `tipo:` (or `type:`) property (one per note). **Tags** remain as many as the person wants.
- **Templates** are regular notes in the vault's `templates/` or `modelos/` folder (both work; a vault without templates gets the folder in the interface language), with `tipo`, `tags`, empty fields and `destino:` (or `folder:`, the folder where the new note is created; it is not copied into the note). `{{titulo}}`, `{{data}}` and `{{hora}}` (or `{{title}}`, `{{date}}` and `{{time}}`) are filled in on creation.
- **Relation** is a field whose value is the name of another note (`company: Company Y`, also `[[Company Y]]` or a Markdown link) or a link in the text. Renaming the note updates those fields.
- The relations panel groups by type the notes that point to the note; the list by type shows fields as columns, relation counts and the last contact (the most recent date among the linked notes).
- Ready-made **sets** (Work, Personal, Reading, Studies, Software projects, Board games) only create templates in the template folder the vault already uses; after that they belong to the user.
- Everything is computed on the device from the notes. The server does not change.

## Alternatives

- Database or custom schema for types: would break the rule of readable Markdown and offline use without a server.
- Type as a tag: a note with two type tags would not know which group to appear in.
- Templates stored in the server configuration: would not sync or work offline.

## Consequences

- Any editor still opens the notes; the fields are plain YAML.
- Field values that match the name of a note become a relation, even unintentionally (for example `status: Done` if a note "Done" exists). The fields `tipo`/`type`, `tags`, `aliases`, `destino`/`folder` and `data`/`date` never count.
- Very large vaults compute relations every time a note is opened; there is a cache by content.
