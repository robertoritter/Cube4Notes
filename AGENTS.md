# Instruções do projeto

## Contexto

Cube4Notes é um produto independente: servidor pessoal de arquivos Markdown com edição visual web e sincronização local/offline entre dispositivos. Outros editores podem servir apenas como referência para ideias gerais de produto; Cube4Notes não terá plugins, integrações, APIs de compatibilidade ou dependências de Obsidian ou SilverBullet.

Leia `README.md`, `docs/00-visao-e-escopo.md`, `docs/01-arquitetura.md` e `app/README.md` antes de alterações substanciais.

## Regras permanentes

- Markdown legível por humanos é o formato canônico das notas.
- Preserve a distinção entre fatos, hipóteses, propostas e decisões.
- Licença decidida: MIT (`LICENSE`, ADR 0002). Não mude a licença nem acrescente outras sem decisão expressa do proprietário.
- Não invente requisitos, integrações, comandos ou suporte de plataforma inexistentes.
- O Cube4Notes roda no computador que guarda as notas (o do próprio usuário ou um servidor doméstico sempre ligado); outros computadores, celular e tablet são clientes.
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

- O código compila e roda no Windows, no Linux (x64 e ARM64) e no macOS. Nunca use `net10.0-windows` nem dependências que só existam num sistema; o que é específico de um sistema fica atrás de verificação em tempo de execução.
- Servidor doméstico de referência: Linux (Debian) sem tela, rodando como serviço do systemd. Clientes: navegadores em Windows, Linux, macOS, iPhone, iPad e Android.
- O macOS é verificado no CI (runner macOS); não presuma acesso a um Mac para depurar.

## Mapa do repositório

| Área | Responsabilidade |
| --- | --- |
| `app/` | o Cube4Notes: servidor .NET, interface embutida, scripts de compilação e de serviço ([referência técnica](app/README.md)) |
| `app/web/` | código-fonte da interface (TypeScript, Vite, Milkdown); compila para `app/wwwroot/`, que é versionado |
| `app/dev/` | servidor de teste em Node com a mesma API e os testes (Playwright e o teste do executável) |
| `app/seguranca/`, `app/SEGURANCA.md` | bateria de segurança; revisão OWASP e riscos conhecidos |
| `docs/` | visão, arquitetura, estado, cenários, agentes de IA, licença |
| `docs/adr/` | decisões aceitas |
| `.github/workflows/ci.yml` | verificação a cada push na `main` e em pull requests |
| `scripts/check_project.py` | estrutura mínima e links da documentação |

## Verificação

- Antes de concluir uma mudança, rode os testes que cobrem a área ([lista em app/README.md](app/README.md#testes)) e `python scripts/check_project.py`.
- Mudou a interface: `npm run build` em `app/web` e commite `app/wwwroot` junto.
- Mudou o servidor ou os scripts: confirme que o CI continua cobrindo o caminho que um usuário novo segue (`app/dev/teste_executavel.py`, serviço do systemd, Debian mínimo).
- Documente só comandos que existem e foram verificados. Textos da interface sempre nas duas línguas (`app/web/src/i18n.ts`), e `app/dev/teste_idioma.py` precisa continuar passando.
- Arquivos públicos não levam nomes pessoais, nomes de máquinas nem e-mails pessoais. Nomes de produto: sempre "Cube4" + nome, sem hífen.
