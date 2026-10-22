# Registros de decisão (ADR)

Decisões caras de reverter ou que afetam várias partes do projeto. Cada registro traz contexto, decisão, alternativas e consequências.

| ADR | Decisão |
| --- | --- |
| [0001](0001-base-architecture.md) | Servidor central em casa, clientes com cópia offline, sem acesso pela internet |
| [0002](0002-mit-license.md) | Licença MIT |
| [0003](0003-standard-markdown-links.md) | Links entre notas em Markdown padrão, reescritos ao renomear |
| [0004](0004-read-only-ai-agents-mcp.md) | Agentes de IA só leem, por MCP, com token próprio |
| [0005](0005-types-templates-and-relations.md) | Tipos, modelos e relações a partir das propriedades das notas |
| [0006](0006-address-by-computer-name.md) | Endereço pelo nome do computador (`-notes.local`), com o IP como reserva |
| [0007](0007-single-dotnet-executable.md) | Executável único em .NET com a interface embutida |
| [0008](0008-sync-by-base-version.md) | Sincronização por versão-base, com cópia de conflito |
| [0009](0009-https-with-own-certificate-authority.md) | HTTPS com autoridade certificadora própria |

Para uma decisão nova: próximo número, nome curto (`0010-nome-da-decisao.md`), e as quatro seções. Não crie ADR para preferências triviais.
