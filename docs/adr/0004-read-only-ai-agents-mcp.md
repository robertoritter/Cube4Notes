# ADR 0004: Read-only access for AI agents (MCP)

- Status: accepted
- Date: 2026-10-21

## Context

The owner runs AI agents on computers at home (for example on the home server) and wants them to look up notes. The project rules require agents to read through controlled interfaces, without privileged access to storage, and that nothing be exposed outside the local network. Until now, the documentation left open whether it would be MCP or REST and which scopes. How to set it up: [06-ai-agents.md](../06-ai-agents.md).

## Decision

- The Cube4Notes server itself serves **MCP** (Model Context Protocol, HTTP transport, request and response only, no SSE) at `/mcp`. There is no separate process: the agent talks to the same server, with the same network rules.
- Each agent gets its **own read-only token**, created by an administrator in *Connect device > AI agents*, with the list of vaults it can read. The token is shown once and stored only as a hash, like device tokens.
- Tools: `list_vaults`, `list_notes`, `read_note`, `search_notes`, `recent_notes`. None of them writes.
- An agent token is never an administrator (not even on the computer itself), does not write through the sync API (any non-read method gets 403) and cannot exchange its own access through an invite.
- From the network, `/mcp` is HTTPS only (the agent trusts the local Cube4Notes certificate). On the computer itself, HTTP too (the token does not leave the machine).

## Alternatives

- Custom REST API: simpler, but each agent would need an adapter; MCP is already supported by agent clients.
- Separate MCP server reading the notes folder: would give the agent direct disk access, against the project rules.
- Reusing a device token: would grant writing and, for administrator devices, administration.

## Consequences

- Any MCP client with HTTP transport (Claude Code, for example) reads the allowed notes without installing anything on the server.
- Access stays restricted to the local network; the agent must be at home (or on the computer itself).
- Writing by agents, if ever wanted, requires a new decision (tokens with write scope, authorship records).
