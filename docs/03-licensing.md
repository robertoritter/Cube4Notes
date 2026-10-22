# Licensing alternatives

Chosen license: MIT (see Decision, below). This document records the alternatives that were compared.

This is a practical analysis, not legal advice.

The current scenario is a personal server running on the home network, with no defined hosted offering. Therefore, the AGPL network clause is not an immediate need for personal use; it remains relevant if third parties offer modified versions as a service. The license should be chosen considering distributed clients and contributions as well, not only the server.

| Option | Practical advantage | Cost/trade-off | When it fits Cube4Notes |
| --- | --- | --- | --- |
| Apache-2.0 | permissive, simple commercial adoption and an explicit patent grant | third parties can create closed versions and competing services | the priority is broad adoption, integrations and ecosystem |
| MPL-2.0 | file-level copyleft; changes to covered files stay open, but composition with proprietary code is allowed | file boundaries require discipline and do not force opening a whole service | balance between community and commercial extensions/editions |
| AGPL-3.0 | strong copyleft that includes software offered over the network, reducing "closed SaaS" built on modified code | may drive away companies, investors and integrations; compatibility must be examined | the priority is ensuring that improvements to the server offered as a service flow back to the community |
| GPL-3.0 | strong copyleft on distribution of applications | lacks the AGPL network obligation; may complicate combination/distribution with incompatible modules | more focus on distributed clients than on protecting the hosted service |
| BSL 1.1 / source-available | visible code with temporary commercial restrictions and a future change to an open license | **not open source** while the restrictions apply; may reduce contributions and trust | commercial protection matters more than the formal definition of open source |
| open core + commercial modules | separates an open editor/contracts from closed hosting or enterprise features | increases governance, contribution boundaries and maintenance | there is a clear plan for a hosted product and premium features |

## Deciding questions

1. Should a third party be able to offer hosted Cube4Notes without publishing its changes?
2. Should companies be able to embed the editor in closed products?
3. Will revenue come from hosting, support, enterprise features or commercial licensing?
4. Will there be a CLA or DCO for contributions and possible future relicensing?
5. Which editor/desktop dependencies are compatible with the chosen option?

## Decision

On 2026-10-20 the owner chose **MIT** (see [ADR 0002](adr/0002-mit-license.md)). The analysis below is kept as a record.

## Provisional recommendation (before the decision)

Not licensing yet is correct during the foundation phase. Before publishing, compare mainly **MPL-2.0** (balance and limited copyleft), **AGPL-3.0** (protection against SaaS appropriation) and **Apache-2.0** (maximum adoption). If the intention is to call the project open source, do not use BSL as if it were equivalent.
