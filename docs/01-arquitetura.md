# Arquitetura inicial — cenário doméstico e offline

## Decisões de produto confirmadas

- Um servidor Cube4Notes central guarda o repositório Markdown. Ele pode rodar no próprio computador do usuário ou num servidor doméstico; o cenário de referência é um Debian sempre ligado.
- O servidor fica acessível somente pela rede local de casa. Acesso externo não é requisito e não deve ser configurado.
- Computadores (Windows, Linux), celular e iPad são clientes; acessam a aplicação web do servidor quando ele está alcançável na rede local.
- Celular e iPad mantêm dados e mudanças localmente para continuar trabalhando quando o servidor ou a rede não estão disponíveis.
- Dispositivos móveis não sincronizam diretamente uns com os outros. Cada um sincroniza com o servidor central ao reconectar.
- Agentes nos computadores podem ler notas por uma integração controlada do servidor; acesso direto ao disco não está decidido.
- Markdown é o formato canônico; a edição principal deve ser visual/WYSIWYG com comandos e barra de formatação.

## Visão dos componentes

```text
                 Rede local de casa
┌─────────────┐     ┌──────────────────────┐
│ Computadores│────▶│ Servidor (Debian):   │────▶ arquivos Markdown
│ navegador   │     │ Cube4Notes Server   │
└─────────────┘     └──────────▲───────────┘
                               │ sincronização ao reconectar
                    ┌──────────┴───────────┐
                    │ celular / iPad       │
                    │ web app + cópia local│
                    └──────────────────────┘

Agentes nos computadores ── integração autorizada ──▶ servidor na rede local
```

Fora da rede doméstica, o servidor não é alcançável. Os clientes móveis usam a cópia local e mantêm mudanças pendentes. Ao voltar à rede, reconciliam com o servidor.

## Responsabilidades lógicas

- **Servidor:** processo iniciado no computador servidor (Debian no cenário de referência), guarda os `.md` e serve o cliente web e interfaces locais controladas.
- **Editor web:** oferece barra e comandos visuais; converte Markdown ↔ modelo de edição, preservando conteúdo suportado.
- **Armazenamento central:** arquivos Markdown e anexos em estrutura legível por pessoas e ferramentas locais.
- **Cliente offline móvel:** cache local de notas/pastas e fila durável de alterações enquanto sem conexão.
- **Sincronização:** compara versões e detecta mudanças, transfere alterações e sinaliza conflitos; nunca sobrescreve silenciosamente.
- **Integração de agentes:** REST e/ou MCP sobre casos de uso autorizados; não expõe o disco inteiro por padrão. Protocolo e escopos seguem pendentes.

## Ciclo de sincronização desejado

1. Cliente conecta ao servidor somente quando consegue alcançá-lo pela rede doméstica.
2. Cliente envia mudanças pendentes com a versão-base de cada arquivo.
3. Servidor compara a versão-base com a versão central atual.
4. Se o arquivo central não mudou, aplica a atualização e registra nova versão.
5. Se ambos mudaram, preserva as duas versões e oferece diff/conflito para resolução. Arquivos diferentes podem ser conciliados independentemente.
6. Cliente recebe mudanças feitas por outros clientes desde a última sincronização.

Protocolo, algoritmo de merge e tratamento de renomeações/exclusões não estão decididos; não presumir merge automático seguro para qualquer Markdown.

## Segurança e limite de rede

- Parear e autorizar clientes na rede local.
- O servidor não deve abrir acesso à internet, configurar encaminhamento de portas, túnel, relay ou hospedagem externa.
- Não presumir que todo dispositivo ou agente na LAN seja confiável.
- Segredos fora dos arquivos Markdown; logs sem cópia integral das notas.
- Sanitizar conteúdo renderizado e validar alterações recebidas.

## Plataformas e testes

- Servidor doméstico (Debian): host centralizador de referência; também pode ser o próprio computador do usuário.
- Computadores Windows e Linux (Debian): clientes e ambientes para testar agentes.
- Não há ambiente local macOS; compilações específicas de macOS devem usar CI.
- Celular/iPad: cliente web com uso offline é a direção a prototipar; armazenamento e sincronização em segundo plano precisam ser validados nos aparelhos reais.

## Questões arquiteturais em aberto

- cliente web instalável versus aplicativo nativo/híbrido;
- cópia local móvel completa ou seletiva;
- protocolo para identidade de arquivos, versões, renomeações e exclusões;
- diff e resolução de conflitos;
- descoberta/pareamento do servidor na rede local;
- REST, MCP ou ambos para agentes e escopos mínimos;
- backup do repositório central.
