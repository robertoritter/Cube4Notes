# ADR 0001 — Servidor doméstico central e clientes offline

- Status: aceita; os mecanismos foram decididos depois (ADRs 0003 a 0009) e estão descritos em [01-arquitetura.md](../01-arquitetura.md)
- Data: 2026-10-19

## Contexto

O usuário quer editar Markdown visualmente, abrir o mesmo espaço no navegador em vários dispositivos e continuar trabalhando no celular/iPad quando offline. O servidor pode ser o computador do próprio usuário ou um servidor doméstico sempre ligado (Linux); outros computadores (Windows, Linux) rodam agentes de IA. O servidor não pode ser acessado de fora de casa.

## Decisão

Adotar um processo Cube4Notes Server que centraliza arquivos Markdown e serve uma interface web na rede local doméstica. Computadores, celular e iPad são clientes. Dispositivos móveis mantêm alterações locais offline e sincronizam diretamente com o servidor central ao reconectar; não fazem sincronização entre si. Conflitos devem preservar alterações e nunca sobrescrever silenciosamente. Agentes nos computadores podem ler por uma integração controlada a definir. Não oferecer acesso externo à internet.

## Consequências

- centraliza arquivos legíveis e mantém o servidor como ponto único de sincronização;
- exige clientes móveis com armazenamento persistente e fila offline;
- conflitos no mesmo arquivo precisam de histórico/diff e resolução sem perda;
- disponibilidade fora de casa não existe por decisão do usuário;
- instalação inicial precisa ser simples, sem exigir montagem manual de proxy, banco externo ou containers;
- o servidor precisa rodar em Windows e Linux; o macOS é verificado em CI.

## Alternativas consideradas

- serviço acessível pela internet: explicitamente fora do escopo;
- sincronização direta entre celulares/tablets: fora do escopo; servidor central é o intermediário;
- exigir que o usuário configure infraestrutura separada para iniciar: contraria a expectativa de iniciar o servidor e usar;
- agentes acessando todo o disco ou banco diretamente: não decidido e não deve ser pressuposto.
