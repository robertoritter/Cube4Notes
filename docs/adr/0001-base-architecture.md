# ADR 0001: Central home server and offline clients

- Status: accepted; the mechanisms were decided later (ADRs 0003 to 0009) and are described in [01-architecture.md](../01-architecture.md)
- Date: 2026-10-19

## Context

The user wants to edit Markdown visually, open the same space in the browser on several devices, and keep working on the phone/iPad while offline. The server can be the user's own computer or an always-on home server (Linux); other computers (Windows, Linux) run AI agents. The server must not be reachable from outside the home.

## Decision

Adopt a Cube4Notes Server process that centralizes Markdown files and serves a web interface on the home local network. Computers, phone and iPad are clients. Mobile devices keep local changes offline and sync directly with the central server when they reconnect; they do not sync with each other. Conflicts must preserve changes and never overwrite silently. Agents on the computers can read through a controlled integration, to be defined. Do not offer external access from the internet.

## Consequences

- centralizes readable files and keeps the server as the single sync point;
- requires mobile clients with persistent storage and an offline queue;
- conflicts on the same file need history/diff and resolution without loss;
- availability outside the home does not exist, by the user's decision;
- initial setup must be simple, without requiring manual setup of a proxy, external database or containers;
- the server must run on Windows and Linux; macOS is checked in CI.

## Alternatives considered

- service reachable from the internet: explicitly out of scope;
- direct sync between phones/tablets: out of scope; the central server is the intermediary;
- requiring the user to set up separate infrastructure to get started: goes against the expectation of starting the server and using it;
- agents accessing the whole disk or database directly: not decided and must not be assumed.
