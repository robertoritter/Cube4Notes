# Alternativas de licenciamento

Nenhuma licença foi escolhida. Até essa decisão, o repositório fica sem `LICENSE`; disponibilizar código publicamente sem licença não concede automaticamente permissões de uso, modificação ou redistribuição.

Isto é uma análise prática, não aconselhamento jurídico.

O cenário atual é um servidor pessoal executado na rede doméstica, sem oferta hospedada definida. Portanto, a cláusula de rede da AGPL não é uma necessidade imediata do uso pessoal; ela continua relevante se terceiros oferecerem versões modificadas como serviço. A licença deve ser escolhida considerando também clientes distribuídos e contribuições, não apenas o servidor.

| Opção | Vantagem prática | Custo/trade-off | Quando combina com Cube4Notes |
| --- | --- | --- | --- |
| Apache-2.0 | permissiva, adoção comercial simples e concessão explícita de patentes | terceiros podem criar versões fechadas e serviços concorrentes | prioridade é adoção ampla, integrações e ecossistema |
| MPL-2.0 | copyleft por arquivo; alterações nos arquivos cobertos permanecem abertas, mas permite composição com código proprietário | fronteiras por arquivo exigem disciplina e não obrigam abrir um serviço inteiro | equilíbrio entre comunidade e extensões/edições comerciais |
| AGPL-3.0 | copyleft forte inclui software oferecido pela rede, reduzindo o “SaaS fechado” do código modificado | pode afastar empresas, investidores e integrações; compatibilidade deve ser examinada | prioridade é garantir que melhorias do servidor oferecido como serviço retornem à comunidade |
| GPL-3.0 | copyleft forte na distribuição de aplicações | não possui a obrigação de rede da AGPL; pode complicar combinação/distribuição com módulos incompatíveis | foco maior em clientes distribuídos do que em proteger o serviço hospedado |
| BSL 1.1 / source-available | código visível com restrições comerciais temporárias e mudança futura para licença aberta | **não é open source** enquanto as restrições vigoram; pode reduzir contribuições e confiança | proteção comercial é mais importante que a definição formal de open source |
| núcleo aberto + módulos comerciais | separa editor/contratos abertos de hospedagem ou recursos empresariais fechados | aumenta governança, fronteiras de contribuição e manutenção | há plano claro de produto hospedado e recursos premium |

## Perguntas que decidem

1. Um terceiro deve poder oferecer Cube4Notes hospedado sem publicar suas mudanças?
2. Empresas devem poder incorporar o editor em produtos fechados?
3. A receita virá de hospedagem, suporte, recursos empresariais ou licenciamento comercial?
4. Haverá CLA ou DCO para contribuições e possível relicenciamento futuro?
5. Quais dependências do editor/desktop são compatíveis com a opção escolhida?

## Recomendação provisória

Não licenciar ainda é correto durante a fundação. Antes de publicar, compare principalmente **MPL-2.0** (equilíbrio e copyleft limitado), **AGPL-3.0** (proteção contra apropriação SaaS) e **Apache-2.0** (adoção máxima). Se a intenção for chamar o projeto de open source, não use BSL como se fosse equivalente.
