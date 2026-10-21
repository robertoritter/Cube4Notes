# Servidor MCP

O acesso de agentes de IA já existe e fica dentro do próprio servidor do Cube4Notes (`app/src/Mcp.cs`), em `/mcp`, somente leitura. Decisão registrada em [`docs/adr/0004-agentes-somente-leitura-mcp.md`](../../docs/adr/0004-agentes-somente-leitura-mcp.md).

Como usar: num aparelho administrador, *Preferências > Conectar aparelho > Agentes de IA > Criar acesso para agente*, escolha os vaults e copie o token e o comando mostrados. Exemplo para o Claude Code no próprio computador (modo *Rede de casa*; no modo *Só este computador* a porta é 43125):

```bash
claude mcp add --transport http cube4notes http://localhost:43124/mcp --header "Authorization: Bearer <token>"
```

Não presumir suporte a agentes em iPhone/iPad nem dar acesso direto ao disco.

## Agente em outra máquina da rede (LM Studio, Claude Code, scripts)

Pela rede o acesso é sempre HTTPS: `https://<ip-do-servidor>:43125/mcp`, com o mesmo cabeçalho `Authorization: Bearer <token>`. O certificado do servidor é assinado pela autoridade criada pelo próprio Cube4Notes, então o programa do agente precisa confiar nela. Sem isso aparece um erro como `unable to verify the first certificate` ou `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.

Instalar o certificado no Windows ou no macOS **não basta** para programas feitos em Node.js (LM Studio, Claude Code e muitos clientes MCP), nem para Python: eles usam a própria lista de autoridades. Por isso o servidor também entrega a autoridade em PEM, o formato que eles aceitam:

```
http://<ip-do-servidor>:43124/cube4notes-ca.pem
```

1. Baixe o arquivo para a máquina do agente, por exemplo `C:\Users\<usuário>\cube4notes-ca.pem` ou `~/cube4notes-ca.pem`.
2. Diga ao programa para confiar nele:
   - **Node.js (LM Studio, Claude Code, clientes MCP em Node)**: variável de ambiente `NODE_EXTRA_CA_CERTS` apontando para o arquivo. No Windows: `setx NODE_EXTRA_CA_CERTS "C:\Users\<usuário>\cube4notes-ca.pem"`; no Linux/macOS, `export NODE_EXTRA_CA_CERTS=~/cube4notes-ca.pem` no perfil do shell. Depois **feche o programa de vez** (no LM Studio, também pelo ícone perto do relógio) e abra de novo, porque a variável só vale para programas abertos depois dela.
   - **Python** (`requests`, `httpx`): `REQUESTS_CA_BUNDLE` ou `SSL_CERT_FILE` apontando para o arquivo.
   - **curl**: `curl --cacert cube4notes-ca.pem https://<ip-do-servidor>:43125/api/status`.
3. Configure o servidor MCP no programa. No LM Studio (`mcp.json`):

```json
{
  "mcpServers": {
    "cube4notes": {
      "url": "https://<ip-do-servidor>:43125/mcp",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

Cada servidor Cube4Notes tem a sua autoridade. Se o agente usa dois servidores, junte os dois PEM num arquivo só (um depois do outro). Se a autoridade do servidor mudar (pasta `tls` apagada ou outro computador), baixe o PEM de novo.

Não desligue a verificação de certificado (`NODE_TLS_REJECT_UNAUTHORIZED=0`, `verify=False`): o token do agente iria para qualquer máquina que respondesse naquele endereço.
