# Plano de entrega

## Fase 0 — cenários e fundação (atual)

Saída: problema, limites de rede, papel do servidor (computador do usuário ou servidor doméstico Debian), clientes, agentes, offline e decisões pendentes documentados. Licença continua sem escolha.

## Fase 1 — servidor simples e edição web

Iniciar o Cube4Notes como servidor local que guarda arquivos Markdown, oferece a interface web e permite edição WYSIWYG com barra visual. Validar num servidor Debian e acessar com navegador nos computadores da mesma LAN. O primeiro uso deve evitar configuração manual de proxy reverso, banco separado ou containers.

Critério de saída: o mesmo arquivo pode ser aberto e editado visualmente por navegador e continua sendo Markdown legível no diretório central.

### Incremento inicial no Windows

Servidor web em .NET 10 com interface web responsiva, seleção da pasta central, navegação/criação de pastas e notas Markdown, comandos visuais básicos, descoberta e anúncio de IPv4 privado dinâmico e código de acesso temporário. Escopo ainda não inclui offline, sync, REST/MCP para agentes, TLS, build Debian validado ou edição WYSIWYG completa. HTTP e código compartilhado são aceitáveis apenas como protótipo em rede privada confiável.

## Fase 2 — cliente móvel offline

Validar celular e iPad pela interface web: abrir uma vez conectado, perder a rede, criar/organizar pastas e notas, fechar/reabrir e preservar mudanças localmente.

Critério de saída: mudanças offline não somem ao fechar o navegador/app; ao retornar à rede de casa, sincronizam com o servidor.

## Fase 3 — sincronização e conflitos

Adicionar versões-base, diff e proteção contra sobrescrita quando servidor e cliente alteraram o mesmo arquivo. Clientes móveis conversam apenas com o servidor central, nunca entre si.

Critério de saída: mudanças em arquivos distintos são combinadas; mudança concorrente no mesmo arquivo preserva ambas as versões e oferece resolução clara.

## Fase 4 — acesso de agentes

Provar leitura de notas por agentes executados nos computadores via uma interface local controlada, inicialmente somente leitura. A integração pode ser REST, MCP ou ambas após validação de necessidade.

Critério de saída: agente lê conteúdo autorizado pela LAN sem precisar acessar diretamente todo o disco e sem expor o servidor à internet.

## Fase 5 — distribuição e robustez

Empacotar o processo servidor e cliente nas plataformas escolhidas; testar builds macOS via CI, sem depender de ambiente local de desenvolvimento Mac. Adicionar backup/recuperação e anexos conforme necessidade validada.

## Protocolo por fase

Cada incremento termina em testes/verificações relevantes e commit **local**. O trabalho para e aguarda validação manual; `push` só ocorre após autorização explícita.
