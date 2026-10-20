# Pesquisa e evidências

Acesso em 19 de outubro de 2026. Fontes jurídicas devem ser confirmadas por profissional qualificado antes de uma decisão comercial.

| Pergunta | Achado | Tipo | Fonte | Confiança | Impacto |
| --- | --- | --- | --- | --- | --- |
| Apache-2.0 oferece concessão de patentes? | O texto concede licença de patentes dos contribuidores e define condições de redistribuição. | fato | [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) | alta; texto oficial | opção permissiva com proteção explícita de patentes |
| MPL-2.0 permite combinar o código com obra maior? | Alterações no código coberto permanecem sob MPL, enquanto uma obra maior pode usar termos diferentes para seus outros arquivos. | fato | [Mozilla Public License 2.0](https://www.mozilla.org/en-US/MPL/2.0/) | alta; texto oficial | sustenta a opção de copyleft por arquivo |
| AGPL trata uso por rede? | A seção 13 exige oferecer o código-fonte correspondente de uma versão modificada a usuários que interagem remotamente com ela. | fato | [GNU AGPL 3.0](https://www.gnu.org/licenses/agpl-3.0.html) | alta; texto oficial | relevante para proteção de um serviço hospedado |
| BSL é open source durante o período restrito? | O modelo impõe uma limitação de uso adicional até a data de mudança; portanto não satisfaz a definição prática de open source nesse período. | inferência a partir dos termos | [Business Source License 1.1](https://mariadb.com/bsl11/) | média-alta; texto do modelo, classificação deve ser comunicada com cuidado | evita rotular source-available como open source |

## Evidência interna

O chat chamado “Projeto Obsidian Web” confirmou o problema de não querer memorizar Markdown, a preferência por uma barra visual (títulos e listas), interesse em criar o Cube4Notes e licença ainda não decidida. O nome da conversa é apenas contexto histórico; não implica plugin, integração, compatibilidade ou dependência. O servidor doméstico de referência roda Debian; não há ambiente macOS local para desenvolvimento/build.

Na exploração atual, o usuário definiu um servidor doméstico Debian como servidor central, o acesso dos computadores pela interface web na rede local, o trabalho offline no celular/iPad, a sincronização posterior com o servidor e a proibição de acesso externo ao servidor. Os agentes referidos estão nos computadores; suporte de agentes locais em iOS/iPadOS não foi assumido.

O chat próximo “Obsidian e múltiplos repositórios” registra frustração com uma tentativa anterior de instalação/configuração por iPad e com componentes de infraestrutura. Isso é evidência para priorizar início simples, sem impor configuração manual de Caddy, banco e Docker no primeiro teste.
