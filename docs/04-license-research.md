# Pesquisa sobre licenças

Pesquisa que apoiou a escolha da licença MIT ([ADR 0002](adr/0002-mit-license.md), [03-licensing.md](03-licensing.md)).

Acesso em 19 de outubro de 2026. Fontes jurídicas devem ser confirmadas por profissional qualificado antes de uma decisão comercial.

| Pergunta | Achado | Tipo | Fonte | Confiança | Impacto |
| --- | --- | --- | --- | --- | --- |
| Apache-2.0 oferece concessão de patentes? | O texto concede licença de patentes dos contribuidores e define condições de redistribuição. | fato | [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) | alta; texto oficial | opção permissiva com proteção explícita de patentes |
| MPL-2.0 permite combinar o código com obra maior? | Alterações no código coberto permanecem sob MPL, enquanto uma obra maior pode usar termos diferentes para seus outros arquivos. | fato | [Mozilla Public License 2.0](https://www.mozilla.org/en-US/MPL/2.0/) | alta; texto oficial | sustenta a opção de copyleft por arquivo |
| AGPL trata uso por rede? | A seção 13 exige oferecer o código-fonte correspondente de uma versão modificada a usuários que interagem remotamente com ela. | fato | [GNU AGPL 3.0](https://www.gnu.org/licenses/agpl-3.0.html) | alta; texto oficial | relevante para proteção de um serviço hospedado |
| BSL é open source durante o período restrito? | O modelo impõe uma limitação de uso adicional até a data de mudança; portanto não satisfaz a definição prática de open source nesse período. | inferência a partir dos termos | [Business Source License 1.1](https://mariadb.com/bsl11/) | média-alta; texto do modelo, classificação deve ser comunicada com cuidado | evita rotular source-available como open source |
