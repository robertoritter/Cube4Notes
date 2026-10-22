# Estado e próximos passos

Situação em outubro de 2026: **protótipo funcional, em uso diário.** Formatos e APIs ainda podem mudar sem aviso.

## Entregue

| Fase | O que entrega | Estado |
| --- | --- | --- |
| Servidor e edição web | servidor .NET 10 em executável único, edição visual de Markdown (Milkdown), vários vaults, janela própria de app, assistente de primeira execução | pronto |
| Cliente móvel offline | interface guardada no aparelho (service worker), cópia completa em IndexedDB, fila de alterações que sobrevive a fechar o app | pronto, validado no iPhone |
| Sincronização e conflitos | versão-base por nota, cópia de conflito, lixeira, renomeações que seguem a nota, histórico de versões com restauração | pronto, coberto por testes adversariais |
| Rede e segurança | HTTPS com autoridade própria, token por aparelho, convites de uso único, só rede local, firewall do Windows, revisão OWASP | pronto ([SECURITY.md](../app/SECURITY.md)) |
| Endereço estável | resposta pelo nome `<computador>-notes.local` (mDNS), troca de endereço sem novo pareamento, guia de reserva de IP | pronto ([ADR 0006](adr/0006-address-by-computer-name.md)) |
| Organização | links entre notas que acompanham renomeações, tags e propriedades, tipos, modelos e relações, nota do dia, conjuntos de modelos em português e inglês | pronto |
| Agentes de IA | MCP somente leitura com token por agente e vaults escolhidos | pronto ([06-ai-agents.md](06-ai-agents.md)) |
| Servidor Linux | executável para x64 e ARM64, serviço do systemd com instalador | pronto, em uso num Debian 13 |
| Verificação contínua | executável testado no Windows, Linux e macOS, Debian mínimo, serviço do systemd e testes da interface, a cada push na `main` | pronto ([ci.yml](../.github/workflows/ci.yml)) |

## Em validação

- **Android** e navegadores além do Edge (janela do Windows) e do Safari (iPhone): devem funcionar, ainda sem validação em aparelho real. O Android resolve nomes `.local` de forma irregular; com o IP reservado no roteador isso não importa.
- **Janela no Linux com tela** (Photino com WebKitGTK): compila, ainda não validada num desktop Linux.

## Próximos passos

1. **Versões publicadas no GitHub**: executáveis prontos (Windows, Linux x64 e ARM64) gerados pelo CI a cada versão, para quem não quer compilar.
2. **macOS como app**: pacote `.app` com janela e ícone. O executável já é gerado e testado no CI; falta o pacote e a confiança no certificado pelo Keychain.
3. **Destaque de `#tags` no editor**: hoje as tags funcionam (painel, filtros, sugestão ao digitar `#`), mas não aparecem destacadas no texto.

Ideias registradas, ainda **não decididas**: listas por tipo em quadro (kanban) e calendário, aproveitando tipos e campos que já existem.

## Como cada mudança é entregue

Cada incremento termina com testes relevantes, documentação atualizada e um commit pequeno e descritivo. Publicar (push, versão) só acontece depois de aprovação explícita.
