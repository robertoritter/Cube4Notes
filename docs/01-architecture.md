# Arquitetura

Como o Cube4Notes funciona por dentro. Para instalar e usar, veja o [README](../README.pt-BR.md); para mexer no código, a [referência técnica do app](../app/README.md). As decisões caras de reverter estão em [`docs/adr`](adr/README.md).

## Visão geral

```text
                         rede de casa (nada passa pela internet)
 ┌──────────────────────────────┐
 │ computador que guarda as notas│      HTTPS 43125 (HTTP 43124 redireciona
 │ (Windows, Linux ou servidor)  │      e entrega o certificado)
 │                               │◀──────────────── celular / tablet / outro computador
 │  Cube4Notes (um executável)   │                  navegador ou app na tela inicial
 │  ├─ servidor web (.NET 10)    │                  cópia local completa (IndexedDB)
 │  ├─ interface embutida        │                  fila de alterações offline
 │  ├─ responde pelo nome (mDNS) │
 │  └─ MCP somente leitura       │◀──────────────── agentes de IA (token próprio)
 │                               │
 │  vaults = pastas com .md      │
 └──────────────────────────────┘
```

- **Um processo, um executável.** O servidor web, a interface (compilada e embutida como recurso) e o acesso para agentes estão no mesmo programa. Não há banco de dados, proxy, container nem serviço externo.
- **Os arquivos são a verdade.** Cada vault é uma pasta comum com arquivos Markdown e anexos. Tudo o que o Cube4Notes guarda além disso fica em `<vault>/.cube4notes/` e `<vault>/.lixeira/`, e a configuração fica numa pasta separada.
- **Cada aparelho tem uma cópia completa** dos vaults liberados para ele e trabalha nela. O servidor é o ponto de encontro: os aparelhos nunca conversam entre si.
- **Só rede local.** O servidor recusa qualquer cliente que não esteja numa rede privada ativa do computador. Não há túnel, relay, nuvem nem abertura de portas no roteador.

## Processos e janela

| Situação | O que roda |
| --- | --- |
| Computador com tela | o processo principal é o servidor; a janela do app (Photino: WebView2 no Windows, WebKitGTK no Linux, WebKit no macOS) roda num segundo processo (`--janela <endereço>`) |
| Abrir o Cube4Notes de novo | só abre outra janela do servidor que já está rodando |
| *Só este computador* | fechar a janela encerra tudo |
| *Rede de casa* | fechar a janela deixa o servidor atendendo os outros aparelhos; no Windows fica um ícone perto do relógio (abrir, liberar no firewall, encerrar) |
| Sem tela (servidor Linux) ou `--sem-janela` | só o servidor, no console ou como serviço do systemd (`instalar-servico.sh`) |

Mudar o modo (em Preferências) grava a configuração e reinicia o servidor dentro do mesmo processo. A porta é escolhida na primeira execução ou com `--port`.

## Armazenamento

```text
<pasta de configuração>            %LOCALAPPDATA%\Cube4Notes no Windows, ~/.local/share/Cube4Notes no Linux
  config.json                      nome do servidor, modo, porta, lista de vaults
  devices.json                     aparelhos e agentes (só o hash dos tokens), administradores, vaults liberados
  tls/                             autoridade certificadora local, certificado do servidor e os endereços que ele cobre

<vault>/                           pasta escolhida pelo usuário
  *.md, subpastas                  as notas
  anexos/                          imagens e PDFs colados
  modelos/ ou templates/           modelos de nota (notas comuns)
  .cube4notes/historico/<nota>/    versões anteriores de cada nota
  .cube4notes/renames.json         renomeações recentes (30 dias)
  .lixeira/<data>/                 o que foi excluído
```

## Sincronização

Cada aparelho guarda num IndexedDB por vault: as notas, as pastas, os anexos e uma **fila de operações** (`put`, `delete`, `mkdir`, `rmdir`, `move`, e `upload` para anexos). Editar, criar, renomear ou apagar sempre altera a cópia local e entra na fila; o envio acontece quando o servidor responde.

1. O aparelho envia a fila de notas e pastas (`POST /api/v/{vault}/sync`); anexos sobem um a um (`POST /api/v/{vault}/attachment`). Gravar e apagar uma nota levam a **versão-base**: o SHA-256 do conteúdo que o aparelho tinha quando começou a editar.
2. O servidor compara com a versão atual do arquivo:
   - igual: aplica a alteração;
   - diferente (alguém mudou a nota nesse meio tempo): **mantém a versão do servidor** e grava a do aparelho como cópia, `Nota (conflito <aparelho> <data>).md`. O aparelho mostra o aviso e as duas versões ficam lado a lado.
3. Exclusão vai para `.lixeira`. Se a nota mudou depois que o aparelho a viu, a exclusão é recusada e a nota continua.
4. Renomeação fica registrada por 30 dias: uma edição que chega pelo nome antigo é aplicada no nome novo, em vez de recriar a nota.
5. O aparelho baixa a lista do servidor (`manifest`, com a versão de cada nota) e busca só o que mudou (`fetch`).

O princípio que vale em todos os casos: **nenhuma alteração é descartada em silêncio.** O pior caso é uma cópia de conflito para o usuário juntar.

**Histórico.** Antes de mudar uma nota, o servidor guarda a versão anterior em `.cube4notes/historico`, no máximo uma a cada 5 minutos por nota (edições contínuas viram uma versão só). Ficam até 100 versões e até 180 dias, mas as 10 mais recentes nunca saem. O histórico acompanha a nota quando ela é renomeada ou movida. Restaurar uma versão grava uma versão nova; nada é apagado.

**Anexos.** Imagens e PDFs (até 25 MB) colados offline ficam no aparelho e sobem depois, com o caminho escolhido pelo aparelho. Se já existir um arquivo diferente com o mesmo nome, o servidor acrescenta um sufixo; se for o mesmo arquivo, aproveita o existente. Cada aparelho pré-carrega as imagens citadas nas notas (até 10 MB cada), num total de até 150 MB por vault contando o que já está guardado, para abrirem offline.

## Interface

- TypeScript, Vite e Milkdown (Crepe) para a edição visual. O Markdown gravado segue o padrão (listas com `-`, links relativos comuns), legível por qualquer outro editor.
- Um **service worker** guarda a interface no aparelho: o app abre sem servidor e sem internet, com os dados do IndexedDB.
- A interface consulta `/api/status` e recarrega sozinha quando o servidor passa a entregar uma versão nova.
- **Links** entre notas são links Markdown padrão com caminho relativo. Renomear ou mover uma nota reescreve os links que apontam para ela, nas outras notas ([ADR 0003](adr/0003-standard-markdown-links.md)).
- **Tipos, modelos e relações** saem do próprio Markdown: `tipo:` nas propriedades, modelos são notas comuns na pasta de modelos, e um campo cujo valor é o nome de outra nota é uma relação. Tudo é calculado no aparelho, também offline ([ADR 0005](adr/0005-types-templates-and-relations.md)).
- Língua da interface por aparelho (português ou inglês). O próprio programa (ícone, avisos do sistema, console) segue a língua do sistema operacional.

## Rede e segurança

- **Portas:** 43125 (HTTPS, o app) e 43124 (HTTP: redireciona para HTTPS, entrega o certificado da autoridade em `.cer` e `.pem` e atende `/mcp` só para agentes no próprio computador). No modo *Só este computador*, só HTTP em `localhost:43125`.
- **Certificado:** na primeira execução em *Rede de casa* o Cube4Notes cria uma **autoridade certificadora própria**, restrita a nomes locais e IPs privados. Ela assina o certificado do servidor, que cobre os IPs atuais do computador e o nome `<computador>-notes.local` e é refeito sozinho quando os endereços mudam. Cada aparelho instala a autoridade uma vez. No Windows do próprio servidor ela é instalada com a confirmação do usuário.
- **Endereço pelo nome:** o próprio Cube4Notes responde por `<computador>-notes.local` na rede local (mDNS, UDP 5353), só para clientes da rede local e só com endereços locais. O QR code usa o IP; um aparelho que alcança o nome pode trocar para ele sem novo pareamento ([ADR 0006](adr/0006-address-by-computer-name.md)).
- **Aparelhos:** cada aparelho tem um token próprio (o servidor guarda só o hash). Entrar exige um convite de uso único, válido por 5 minutos, por QR code ou código de 6 caracteres. O convite define os vaults e se o aparelho administra. No próprio computador do servidor (localhost) o pareamento é automático.
- **Verificações em toda requisição:** cliente da rede local, cabeçalho `Host` conhecido (IP, `localhost`, nome do computador), mesma origem nas alterações, token nas rotas da API, caminhos sempre dentro do vault, limite de tamanho e de tentativas de pareamento.
- **Firewall do Windows:** uma regra por porta (43124-43125 TCP) e uma para o mDNS (UDP 5353), só para a sub-rede local, criadas uma vez com a confirmação do Windows.
- Revisão completa e riscos conhecidos: [app/SECURITY.md](../app/SECURITY.md).

## Agentes de IA

Agentes leem as notas pelo protocolo MCP em `/mcp`, com um token de agente que só lê e só alcança os vaults escolhidos. Ferramentas: listar vaults, listar notas, ler nota, buscar e notas recentes. Agentes nunca alteram notas e nunca recebem acesso ao disco ([ADR 0004](adr/0004-read-only-ai-agents-mcp.md)). Como configurar: [docs/06-ai-agents.md](06-ai-agents.md).

## Compilação e verificação

- O projeto mira `net10.0` (nunca `net10.0-windows`): compila e roda no Windows, no Linux e no macOS. O que é de um sistema só (bandeja, firewall, confiar no certificado) fica atrás de verificação em tempo de execução.
- `gerar-executavel.cmd` (Windows) e `gerar-executavel.sh` (Linux e macOS) geram um arquivo único com a interface embutida, que roda sem o .NET instalado. O programa roda com globalização invariante: não depende da biblioteca ICU.
- A cada push na `main` e em cada pull request, o GitHub Actions ([ci.yml](../.github/workflows/ci.yml)):
  - gera e testa o executável no Windows, no Linux e no macOS como um usuário novo faria ([teste_executavel.py](../app/dev/teste_executavel.py));
  - gera e testa num Debian mínimo, sem bibliotecas extras;
  - instala e atualiza o serviço do systemd;
  - roda os testes da interface (sincronização, offline, recursos, endereço pelo nome e língua) contra o servidor de teste em Node.
