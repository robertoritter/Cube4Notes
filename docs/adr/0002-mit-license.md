# ADR 0002: MIT license

- Status: accepted
- Date: 2026-10-20

## Context

The repository started without a license (all rights reserved) until the owner decided. The alternatives compared are in [`docs/03-licensing.md`](../03-licensing.md): MIT, Apache-2.0, MPL-2.0, AGPL-3.0 and BSL. Among note apps, the large commercial ones are closed, most open ones use AGPL, and the most similar project (self-hosted server, Markdown, offline) uses MIT.

## Decision

Distribute the Cube4Notes code under the MIT license. The owner prefers that open source code be as permissive as possible: anyone can use, modify and sell versions, including closed ones, as long as they keep the copyright notice.

## Consequences

- Easier adoption and contributions; the project serves as a showcase for Cube4Code.
- Third parties can build closed commercial products from the code, with no obligation to publish improvements or to show the credit in the interface.
- The license does not cover the names Cube4Notes and Cube4Code or the logos: derived products need their own name and identity.
- The owner can license future versions differently; whatever is published as MIT stays MIT.
