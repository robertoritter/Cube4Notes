# Visão e escopo — Cube4Notes

## Problema

O usuário quer criar e organizar notas e pastas Markdown sem decorar a sintaxe, editando visualmente e mantendo arquivos acessíveis aos agentes locais. Também quer continuar criando e editando notas em celular/iPad quando estiver longe do computador ou sem Wi-Fi, e sincronizar tudo ao voltar para casa.

## Público e contexto inicial

- usuário com computadores Windows e Linux (Debian) e, opcionalmente, um servidor doméstico Debian;
- usuário de celular e iPad que quer usar a mesma interface web e continuar offline;
- agentes executados nos computadores que precisam ler o mesmo repositório de notas por uma interface controlada.

## Resultado desejado

Editar notas visualmente sem perder Markdown portável; usar o mesmo espaço no navegador pela rede de casa; continuar offline no celular/iPad; sincronizar as mudanças com o servidor central doméstico quando reconectar; e permitir leitura dos agentes nos computadores.

## Escopo do produto a explorar

- servidor Cube4Notes iniciado no computador do usuário ou num servidor doméstico (Debian), que centraliza os Markdown e serve o cliente web;
- clientes web nos computadores, celular e iPad pela rede local;
- cliente móvel capaz de manter notas, pastas e alterações offline;
- sincronização posterior com o servidor central, preservando alterações e detectando edições concorrentes;
- acesso de agentes nos computadores por integração controlada do servidor;
- acesso ao servidor restrito à rede doméstica: sem acesso externo pela internet;
- servidor central executando em Debian; distribuição para Windows/Linux e eventuais builds de cliente macOS via CI, pois não há ambiente macOS local;
- produto independente, implementado do zero a partir das necessidades e dos princípios registrados neste projeto;
- referências a outros editores limitadas a ideias gerais de organização e edição, sem adotar seu código ou ecossistema.

## Fora do primeiro marco

- plugins, integrações, APIs de compatibilidade ou dependências de Obsidian/SilverBullet;
- compatibilidade com plugins, formatos proprietários ou ecossistemas desses produtos;
- edição colaborativa simultânea em tempo real;
- marketplace de extensões;
- escrita por agentes;
- sincronização direta entre celulares/tablets; o servidor central é o ponto de sincronização;
- acesso remoto externo ao servidor;
- aplicativo nativo para iPhone/iPad nesta etapa; o cliente móvel inicial é web com capacidade offline.

## Restrições confirmadas

- o computador que roda o Cube4Notes é o servidor central (no cenário de referência, um Debian doméstico); os demais computadores (Windows, Linux) são clientes;
- o servidor não deve ser acessível de fora de casa, nem por túnel ou serviço externo;
- quando o servidor estiver desligado ou inalcançável, cada dispositivo móvel mantém suas próprias mudanças locais;
- celular e iPad não sincronizam entre si diretamente; ambos sincronizam com o servidor quando ele voltar;
- se dois clientes alterarem o mesmo arquivo offline, preservar as versões e sinalizar conflito; nunca descartar uma alteração silenciosamente;
- Markdown é fonte de portabilidade;
- licença MIT, decidida pelo proprietário (ADR 0002).

## Hipóteses a validar

- um subconjunto de Markdown atende às tarefas frequentes com uma barra visual;
- uma aplicação web consegue manter documentos e fila de mudanças offline nos dispositivos móveis desejados;
- a sincronização pode detectar mudanças e oferecer diff/resolução compreensível;
- agentes locais podem ler via interface autorizada do servidor sem acesso direto privilegiado aos arquivos.

## Decisões ainda pendentes

- tecnologias do servidor, cliente web e camada de sincronização;
- autenticação e pareamento de dispositivos dentro da rede doméstica;
- política de conflitos: cópia em conflito, diff visual, resolução manual ou combinações;
- limites e comportamento para anexos e mudanças de pastas;
- integração e escopos para agentes (REST, MCP ou ambos);
- forma de disponibilizar e instalar o cliente web offline em cada sistema móvel.
