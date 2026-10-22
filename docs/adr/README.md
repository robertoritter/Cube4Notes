# Registros de decisão (ADR)

Decisões caras de reverter ou que afetam várias partes do projeto. Cada registro traz contexto, decisão, alternativas e consequências.

| ADR | Decisão |
| --- | --- |
| [0001](0001-arquitetura-base.md) | Servidor central em casa, clientes com cópia offline, sem acesso pela internet |
| [0002](0002-licenca-mit.md) | Licença MIT |
| [0003](0003-links-markdown-padrao.md) | Links entre notas em Markdown padrão, reescritos ao renomear |
| [0004](0004-agentes-somente-leitura-mcp.md) | Agentes de IA só leem, por MCP, com token próprio |
| [0005](0005-tipos-modelos-e-relacoes.md) | Tipos, modelos e relações a partir das propriedades das notas |
| [0006](0006-endereco-pelo-nome-do-computador.md) | Endereço pelo nome do computador (`-notes.local`), com o IP como reserva |
| [0007](0007-executavel-unico-dotnet.md) | Executável único em .NET com a interface embutida |
| [0008](0008-sincronizacao-por-versao-base.md) | Sincronização por versão-base, com cópia de conflito |
| [0009](0009-https-com-autoridade-propria.md) | HTTPS com autoridade certificadora própria |

Para uma decisão nova: próximo número, nome curto (`0010-nome-da-decisao.md`), e as quatro seções. Não crie ADR para preferências triviais.
