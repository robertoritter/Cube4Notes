# Agentes de IA (MCP)

Agentes de IA (Claude Code, LM Studio, outros clientes MCP) podem **ler** as notas do Cube4Notes. O acesso fica dentro do próprio servidor, em `/mcp`, e segue o protocolo MCP (JSON-RPC sobre HTTP). Decisão registrada em [ADR 0004](adr/0004-read-only-ai-agents-mcp.md).

## O que um agente pode fazer

| Ferramenta | O que faz |
| --- | --- |
| `list_vaults` | lista os vaults liberados para o agente |
| `list_notes` | lista os caminhos das notas de um vault, ou de uma pasta dele |
| `read_note` | lê o Markdown completo de uma nota |
| `search_notes` | busca notas com todas as palavras (sem diferenciar acentos e maiúsculas), com caminho e trecho |
| `recent_notes` | notas alteradas mais recentemente |

E o que ele **não** pode:

- alterar, criar, renomear ou apagar notas (o token de agente é recusado em qualquer alteração);
- administrar o servidor, ver aparelhos ou criar convites;
- ler vaults que não foram liberados para ele;
- acessar o disco: ele só vê as notas, pelo servidor.

## Criar o acesso

1. Num aparelho administrador, abra **Preferências > Conectar aparelho > Agentes de IA > Criar acesso para agente**.
2. Dê um nome ao agente e escolha os vaults que ele pode ler.
3. Copie o **token**: ele aparece uma vez só. Se perder, remova o agente e crie outro.

A mesma tela mostra o comando pronto para o Claude Code e a configuração JSON para outros clientes. Para tirar o acesso, remova o agente na mesma lista.

Cada servidor Cube4Notes tem os seus próprios tokens: um token criado num computador não vale em outro.

## Agente no próprio computador do servidor

No próprio computador, o agente pode usar HTTP simples (o token não sai da máquina). Exemplo para o Claude Code, no modo *Rede de casa*:

```bash
claude mcp add --transport http cube4notes http://localhost:43124/mcp --header "Authorization: Bearer <token>"
```

No modo *Só este computador*, a porta é 43125.

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

## Limites

- Não há agentes em iPhone e iPad: o acesso é para programas que rodam em computadores da rede de casa.
- O agente vê o texto das notas como está no disco, inclusive propriedades e links. As ferramentas MCP não entregam anexos, mas o token de agente também vale nas rotas de leitura da API dos mesmos vaults (por exemplo `GET /api/v/{vault}/raw`), então quem tem o token consegue baixar imagens e PDFs desses vaults.
