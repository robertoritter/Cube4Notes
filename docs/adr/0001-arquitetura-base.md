# ADR 0001 — Servidor doméstico central e clientes offline

- Status: aceita como direção do produto; mecanismos e tecnologias pendentes
- Data: 2026-10-19

## Contexto

O usuário quer editar Markdown visualmente, abrir o mesmo espaço no navegador em vários dispositivos e continuar trabalhando no celular/iPad quando offline. Um servidor doméstico Debian fica como centralizador de referência; há computadores Windows e Linux (Debian) com agentes locais. O servidor não pode ser acessado de fora de casa. Não há ambiente local macOS.

## Decisão

Adotar um processo Cube4Notes Server que centraliza arquivos Markdown e serve uma interface web na rede local doméstica. Computadores, celular e iPad são clientes. Dispositivos móveis mantêm alterações locais offline e sincronizam diretamente com o servidor central ao reconectar; não fazem sincronização entre si. Conflitos devem preservar alterações e nunca sobrescrever silenciosamente. Agentes nos computadores podem ler por uma integração controlada a definir. Não oferecer acesso externo à internet.

## Consequências

- centraliza arquivos legíveis e mantém o servidor como ponto único de sincronização;
- exige clientes móveis com armazenamento persistente e fila offline;
- conflitos no mesmo arquivo precisam de histórico/diff e resolução sem perda;
- disponibilidade fora de casa não existe por decisão do usuário;
- instalação inicial precisa ser simples, sem exigir montagem manual de proxy, banco externo ou containers;
- o servidor de referência roda Debian; compilações macOS usam CI e ainda precisam de validação em hardware real quando houver acesso.

## Alternativas consideradas

- serviço acessível pela internet: explicitamente fora do escopo;
- sincronização direta entre celulares/tablets: fora do escopo; servidor central é o intermediário;
- exigir que o usuário configure infraestrutura separada para iniciar: contraria a expectativa de iniciar o servidor e usar;
- agentes acessando todo o disco ou banco diretamente: não decidido e não deve ser pressuposto.
