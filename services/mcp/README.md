# Servidor MCP

O acesso de agentes de IA já existe e fica dentro do próprio servidor do Cube4Notes (`app/src/Mcp.cs`), em `/mcp`, somente leitura. Decisão registrada em [`docs/adr/0004-agentes-somente-leitura-mcp.md`](../../docs/adr/0004-agentes-somente-leitura-mcp.md).

Como usar: num aparelho administrador, *Preferências > Conectar aparelho > Agentes de IA > Criar acesso para agente*, escolha os vaults e copie o token e o comando mostrados. Exemplo para o Claude Code no próprio computador (modo *Rede de casa*; no modo *Só este computador* a porta é 43125):

```bash
claude mcp add --transport http cube4notes http://localhost:43124/mcp --header "Authorization: Bearer <token>"
```

Não presumir suporte a agentes em iPhone/iPad nem dar acesso direto ao disco.
