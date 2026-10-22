# License research

Research that supported the choice of the MIT license ([ADR 0002](adr/0002-mit-license.md), [03-licensing.md](03-licensing.md)).

Accessed on October 19, 2026. Legal sources should be confirmed by a qualified professional before a commercial decision.

| Question | Finding | Type | Source | Confidence | Impact |
| --- | --- | --- | --- | --- | --- |
| Does Apache-2.0 offer a patent grant? | The text grants a patent license from contributors and defines redistribution conditions. | fact | [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) | high; official text | permissive option with explicit patent protection |
| Does MPL-2.0 allow combining the code with a larger work? | Changes to covered code stay under the MPL, while a larger work can use different terms for its other files. | fact | [Mozilla Public License 2.0](https://www.mozilla.org/en-US/MPL/2.0/) | high; official text | supports the file-level copyleft option |
| Does the AGPL address network use? | Section 13 requires offering the corresponding source code of a modified version to users who interact with it remotely. | fact | [GNU AGPL 3.0](https://www.gnu.org/licenses/agpl-3.0.html) | high; official text | relevant to protecting a hosted service |
| Is BSL open source during the restricted period? | The model imposes an additional use limitation until the change date; therefore it does not meet the practical definition of open source during that period. | inference from the terms | [Business Source License 1.1](https://mariadb.com/bsl11/) | medium-high; model text, the classification should be communicated carefully | avoids labeling source-available as open source |
