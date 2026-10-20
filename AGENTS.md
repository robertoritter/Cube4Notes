# Instruções do projeto

## Contexto

Cube4Notes é um produto independente: servidor pessoal de arquivos Markdown com edição visual web e sincronização local/offline entre dispositivos. Outros editores podem servir apenas como referência para ideias gerais de produto; Cube4Notes não terá plugins, integrações, APIs de compatibilidade ou dependências de Obsidian ou SilverBullet.

Leia `README.md`, `docs/00-visao-e-escopo.md` e `docs/01-arquitetura.md` antes de alterações substanciais.

## Regras permanentes

- Markdown legível por humanos é o formato canônico das notas.
- Preserve a distinção entre fatos, hipóteses, propostas e decisões.
- Não adicione `LICENSE`, cabeçalhos de licença ou identificador SPDX até decisão expressa do proprietário.
- Não invente requisitos, integrações, comandos ou suporte de plataforma inexistentes.
- O Cube4Notes roda no computador que guarda as notas (o do próprio usuário ou um servidor doméstico, por exemplo um Debian sempre ligado); outros computadores (Windows, Linux), celular e tablet são clientes.
- O servidor é acessível somente pela rede local da casa. Não configurar acesso externo, túnel remoto ou serviço de nuvem.
- Celular e iPad devem manter dados e mudanças localmente enquanto offline e sincronizar ao reencontrar o servidor.
- Resolver conflitos preservando alterações; nenhuma versão pode ser descartada silenciosamente.
- Trate segurança e autorização local como requisitos do núcleo; agentes leem por interfaces controladas, sem acesso privilegiado direto ao armazenamento.
- Registre decisões caras de reverter em `docs/adr/` antes da implementação.
- Atualize documentação e testes quando uma mudança alterar escopo ou comportamento.

## Protocolo de entrega

Para cada incremento solicitado:

1. implementar somente o escopo autorizado;
2. executar testes e verificações locais relevantes;
3. criar um commit Git local, pequeno e descritivo;
4. **PARAR** e entregar ao usuário instruções de validação manual;
5. fazer `push` apenas após aprovação explícita do usuário.

Nunca pule direto do commit local para publicação, release ou `push`.

## Ambientes

- Desenvolvimento principal: Windows.
- Servidor doméstico de referência: Debian. Clientes de computador: Windows e Linux (Debian).
- macOS: não há ambiente local macOS neste cenário; builds e testes específicos devem rodar em CI com runner macOS.
- Evite depender de uma ferramenta que só possa ser configurada ou depurada localmente em macOS.

## Mapa de responsabilidades

| Área | Responsabilidade |
| --- | --- |
| `apps/web` | cliente web instalável e interface do editor |
| `apps/desktop` | host opcional para Windows, Linux e macOS; não é o servidor central |
| `packages/editor` | edição visual e conversão Markdown sem acoplamento ao host |
| `packages/contracts` | contratos de notas e sincronização |
| `services/api` | interface local do servidor, versões e armazenamento central |
| `services/mcp` | integração opcional de leitura para agentes locais |
| `tests` | cenários entre componentes e portabilidade |
| `docs/adr` | decisões arquiteturais aceitas |

## Verificação

Execute `python scripts/check_project.py` antes de concluir mudanças estruturais. Comandos adicionais só devem ser documentados depois de existirem e serem verificados.
