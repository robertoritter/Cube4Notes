# Architecture decision records (ADR)

Decisions that are expensive to reverse or that affect several parts of the project. Each record covers context, decision, alternatives and consequences.

| ADR | Decision |
| --- | --- |
| [0001](0001-base-architecture.md) | Central server at home, clients with an offline copy, no access from the internet |
| [0002](0002-mit-license.md) | MIT license |
| [0003](0003-standard-markdown-links.md) | Links between notes in standard Markdown, rewritten on rename |
| [0004](0004-read-only-ai-agents-mcp.md) | AI agents only read, over MCP, with their own token |
| [0005](0005-types-templates-and-relations.md) | Types, templates and relations derived from note properties |
| [0006](0006-address-by-computer-name.md) | Address by computer name (`-notes.local`), with the IP as a fallback |
| [0007](0007-single-dotnet-executable.md) | Single .NET executable with the interface embedded |
| [0008](0008-sync-by-base-version.md) | Sync by base version, with a conflict copy |
| [0009](0009-https-with-own-certificate-authority.md) | HTTPS with its own certificate authority |

For a new decision: next number, short name (`0010-decision-name.md`), and the four sections. Do not create an ADR for trivial preferences.
