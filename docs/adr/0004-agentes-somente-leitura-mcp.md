# ADR 0004: Acesso somente leitura para agentes de IA (MCP)

- Status: aceita
- Data: 2026-10-21

## Contexto

O proprietário roda agentes de IA em computadores da casa (por exemplo no servidor doméstico) e quer que eles consultem as notas. As regras do projeto exigem que agentes leiam por interfaces controladas, sem acesso privilegiado ao armazenamento, e que nada fique exposto fora da rede local. O README de `services/mcp` deixava em aberto se seria MCP ou REST e quais escopos.

## Decisão

- O próprio servidor do Cube4Notes atende o **MCP** (Model Context Protocol, transporte HTTP, só pedido e resposta, sem SSE) em `/mcp`. Não há processo separado: o agente fala com o mesmo servidor, com as mesmas regras de rede.
- Cada agente recebe um **token próprio, somente leitura**, criado por um administrador em *Conectar aparelho > Agentes de IA*, com a lista de vaults que pode ler. O token é mostrado uma vez e guardado só como hash, como o dos aparelhos.
- Ferramentas: `list_vaults`, `list_notes`, `read_note`, `search_notes`, `recent_notes`. Nenhuma escreve.
- Um token de agente nunca é administrador (nem no próprio computador), não escreve pela API de sincronização (qualquer método que não seja leitura recebe 403) e não pode trocar o próprio acesso por convite.
- Da rede, `/mcp` só em HTTPS (o agente confia no certificado local do Cube4Notes). No próprio computador, também em HTTP (o token não sai da máquina).

## Alternativas

- API REST própria: mais simples, mas cada agente precisaria de um adaptador; MCP já é suportado pelos clientes de agentes.
- Servidor MCP separado lendo a pasta de notas: daria ao agente acesso direto ao disco, contra as regras do projeto.
- Reaproveitar o token de um aparelho: daria escrita e, para aparelhos administradores, administração.

## Consequências

- Qualquer cliente MCP com transporte HTTP (Claude Code, por exemplo) lê as notas liberadas sem instalar nada no servidor.
- Acesso continua restrito à rede local; o agente precisa estar em casa (ou no próprio computador).
- Escrita por agentes, se um dia for desejada, exige nova decisão (tokens com escopo de escrita, registro de autoria).
