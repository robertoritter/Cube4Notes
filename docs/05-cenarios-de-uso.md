# Cenários de uso confirmados

Este documento registra o que o produto precisa permitir antes de escolher a implementação.

## Cenário 1 — computador cliente na rede de casa

O Cube4Notes Server roda no computador do usuário ou num servidor doméstico (Debian) e mantém o repositório Markdown central. Num computador Windows ou Linux, a pessoa abre um navegador, acessa o servidor pela rede local e edita com a mesma interface visual. Os outros computadores não precisam montar o disco do servidor nem manter um segundo servidor.

## Cenário 2 — agente no computador cliente

Agentes executados nos computadores precisam consultar as notas armazenadas pelo servidor. O caminho preferido a explorar é uma interface controlada do Cube4Notes Server, acessível na LAN. Ainda não foi decidido REST, MCP ou ambos, nem o nível de escopo. Não assumir que o navegador transfere acesso ao sistema de arquivos para o agente.

## Cenário 3 — celular/iPad conectado em casa

Celular e iPad abrem o cliente web do servidor pela rede local e editam o mesmo espaço de notas. A interface deve ser adequada a toque e não exigir memorização de sintaxe Markdown; uma barra oferece itens comuns como títulos, listas e formatação.

## Cenário 4 — celular/iPad fora de casa ou sem rede

O servidor doméstico não é acessível externamente, por decisão explícita. O cliente móvel já usado anteriormente deve manter notas, criação de pastas e mudanças localmente mesmo sem Wi-Fi e sem o servidor. O conteúdo local precisa sobreviver ao fechamento e à reabertura do cliente.

## Cenário 5 — reconexão e sincronização

Quando celular/iPad voltam à rede doméstica, sincronizam cada um com o servidor central. Eles não se comunicam diretamente. Mudanças em arquivos diferentes podem ser conciliadas. Se o mesmo arquivo mudou tanto no cliente offline quanto no servidor, o sistema preserva as duas versões e mostra diff/conflito; nunca descarta uma alteração silenciosamente.

## Cenário 6 — servidor desligado e servidor sempre ligado

Com o servidor desligado, cada dispositivo móvel continua trabalhando com sua própria cópia e fila pendente; os clientes não sincronizam entre si. Se o servidor ficar num computador doméstico sempre ligado, fica disponível continuamente dentro da rede de casa. “Sempre ligado” não implica acesso pela internet.

## Máquinas e papéis atuais

| Máquina/dispositivo | Papel |
| --- | --- |
| Servidor (computador do usuário ou Debian doméstico) | servidor central e armazenamento canônico |
| Computador Windows | cliente web e ambiente para agente de teste |
| Computador Linux (Debian) | cliente web e ambiente para agente de teste |
| Celular | cliente web móvel com dados e alterações offline |
| iPad | cliente web móvel com dados e alterações offline |

Suporte genérico a hosts adicionais dependerá do plano de distribuição. O proprietário não tem ambiente macOS local de desenvolvimento; builds específicos devem poder ser gerados em CI.

## Requisitos de simplicidade

O processo inicial deve se comportar como “iniciar o servidor e usar”. O primeiro teste não deve exigir que o usuário configure manualmente Caddy/proxy reverso, banco separado ou uma pilha Docker. Uma tentativa anterior de configuração de ferramentas de notas foi frustrante; isso informa apenas a necessidade de instalação simples e não cria requisito de plugin, integração ou compatibilidade com outro produto.

## O que ainda não está decidido

- quais pacotes executáveis serão fornecidos para Windows, Linux e, eventualmente, macOS via CI;
- instalação do cliente web para manter uso offline no iOS/iPadOS e limites de execução em segundo plano;
- se a cópia offline contém todo o repositório ou apenas pastas selecionadas;
- mecanismo de diff/merge, histórico e retenção de conflitos;
- protocolo e autorização para agentes locais;
- backups e recuperação do armazenamento central.
