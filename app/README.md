# Cube4Notes: referência técnica do app

Visão geral do produto, instalação e uso: [README.pt-BR.md](../README.pt-BR.md) (em inglês: [README.md](../README.md)). Como funciona por dentro: [docs/01-arquitetura.md](../docs/01-arquitetura.md). Este arquivo é a referência para quem mexe no código.

## Compilar e rodar

| O quê | Windows | Linux e macOS |
| --- | --- | --- |
| Rodar a partir do código | `iniciar.cmd` (equivale a `dotnet run -c Release`) | `dotnet run -c Release` |
| Só verificar se compila | `compilar.cmd` (resultado em `compilar.log`) | `dotnet build -c Release` |
| Executável independente | `gerar-executavel.cmd` → `dist\win-x64\Cube4Notes.exe` | `./gerar-executavel.sh` → `dist/<plataforma>/Cube4Notes` |
| Servidor sem tela como serviço | não se aplica | `./instalar-servico.sh` (systemd) |

- Precisa do .NET 10 SDK. O executável gerado não precisa de nada instalado: é um arquivo único, autocontido, com a interface (`wwwroot`) embutida como recurso.
- O projeto mira `net10.0`, nunca `net10.0-windows`. O que é específico do Windows (ícone na bandeja, firewall, confiar no certificado) fica atrás de `OperatingSystem.IsWindows()`.
- Globalização invariante (`InvariantGlobalization`): o programa não depende da biblioteca ICU. `gerar-executavel.sh` também roda o SDK assim, para compilar num Linux mínimo.
- `gerar-executavel.sh` detecta a plataforma (`linux-x64`, `linux-arm64`, `osx-arm64`, `osx-x64`) ou recebe uma como argumento.

## Janela, bandeja e serviço

- Com tela disponível, o processo principal é o servidor e abre a janela num segundo processo (`Cube4Notes --janela <endereço>`), feita com Photino.NET (WebView2 no Windows, WebKitGTK no Linux, WebKit no macOS). Sem tela, ou com `--sem-janela`, roda só o servidor, no console.
- Abrir o Cube4Notes de novo com ele já rodando só abre outra janela.
- *Só este computador*: fechar a janela encerra tudo. *Rede de casa*: o servidor continua; no Windows fica um ícone perto do relógio (Abrir, Liberar no firewall, Encerrar), feito direto com a API do Windows para não depender de WinForms. Em qualquer sistema, Preferências > Vaults e servidor > Encerrar o Cube4Notes também encerra (só no próprio computador).
- Primeira execução numa janela: o assistente roda em HTTP só neste computador; o certificado só é criado se o usuário escolher *Rede de casa*.
- Como serviço do systemd (`instalar-servico.sh`): o executável vai para `/opt/cube4notes`, o serviço roda com o usuário que instalou (nunca root) e com `--sem-janela --sem-navegador`. Rodar o script de novo atualiza o executável e reinicia o serviço; configuração, aparelhos e notas continuam.
- Mensagens do programa (ícone, avisos do Windows, console, nome das cópias de conflito) seguem a língua do sistema: Windows pela API, macOS pelas preferências, Linux por `LANG`/`LC_*`. `CUBE4NOTES_LANG=pt` ou `en` força uma língua.

## Configuração

Tudo fica numa pasta de configuração: `%LOCALAPPDATA%\Cube4Notes` no Windows, `~/.local/share/Cube4Notes` no Linux, `~/Library/Application Support/Cube4Notes` no macOS, ou `--config <pasta>`.

```text
config.json     nome do servidor, modo, porta e lista de vaults
devices.json    aparelhos e agentes (só o hash dos tokens), administradores e vaults liberados
tls/            autoridade certificadora local, certificado do servidor e os endereços que ele cobre (modo Rede de casa)
```

- Sem `config.json`, o servidor inicia no **assistente de primeira execução**. No próprio computador não pede código; de outro aparelho, pede o código de 6 caracteres mostrado no console.
- **Modos:** `pessoal` (*Só este computador*: escuta só em localhost, HTTP, sem certificado) e `rede` (*Rede de casa*: HTTPS na porta 43125 e HTTP na 43124, que redireciona para HTTPS, entrega a autoridade certificadora em `.cer` e `.pem` e atende `/mcp` só para agentes no próprio computador). Trocar o modo grava a configuração e reinicia o servidor dentro do mesmo processo.
- **Vaults:** qualquer pasta, exceto a raiz do disco, pastas do sistema, a pasta de configuração e pastas dentro de outro vault. Cada vault tem um id estável usado nas rotas (ex.: "Trabalho 2026" vira `trabalho-2026`). Tirar um vault da lista não apaga a pasta.
- **Migração:** a configuração da versão de uma pasta só (`pasta-de-notas.txt` ou `--notes`) vira o vault `notas`, e os aparelhos antigos continuam valendo.
- Arquivos internos de cada vault: `<vault>/.cube4notes/` (histórico e renomeações) e `<vault>/.lixeira/`.

### Opções de linha de comando

| Opção | Efeito |
| --- | --- |
| `--config <pasta>` | pasta da configuração |
| `--port <número>` | porta do app (padrão 43125; no modo *Rede de casa* a porta anterior redireciona para HTTPS) |
| `--notes <pasta>` | sem configuração existente, usa essa pasta como primeiro vault (id `notas`; migração do primeiro protótipo) |
| `--sem-janela` | só o servidor, sem janela |
| `--sem-navegador` | não abre a janela nem o navegador ao iniciar |
| `--sem-https` | HTTP simples na rede (só para testes) |
| `--sem-instalar-certificado` | não adiciona a autoridade à confiança do Windows |
| `--sem-firewall` | não cria a regra do Firewall do Windows |
| `--sem-nome-na-rede` | não responde por `<computador>-notes.local` |

## Aparelhos, agentes e permissões

- O aparelho que conclui o assistente é administrador. No próprio computador do servidor (localhost), o pareamento é automático e também é administrador.
- Os outros aparelhos entram por convite: QR code (144 bits) ou código curto de 6 caracteres, uso único, válido por 5 minutos. O convite define os vaults liberados e se o aparelho administra.
- Um aparelho já conectado que lê um convite novo tem o acesso trocado pelo do convite, sem virar outro aparelho.
- **Convite de transferência:** um aparelho conectado pede (`POST /api/transfer`) um convite preso a ele mesmo, para abrir o Cube4Notes por outro endereço (o nome do computador) sem novo QR. Ele ganha um token a mais; remover o aparelho invalida todos.
- **Agentes:** token só de leitura, com os vaults escolhidos; recusado em qualquer alteração e nunca administrador.
- Cada aparelho guarda offline todos os vaults liberados (um IndexedDB por vault). Vault que deixa de ser liberado some da tela; alterações pendentes nele ficam guardadas no aparelho.

## Sincronização

- Cópia local em IndexedDB e fila de operações (`put`, `delete`, `mkdir`, `rmdir`, `move` pela rota `sync`; `upload` pela rota `attachment`). Gravar e apagar levam a versão-base (SHA-256 do conteúdo). Decisão: [ADR 0008](../docs/adr/0008-sincronizacao-por-versao-base.md).
- Conflito: o servidor mantém a versão dele e grava a do aparelho como `Nome (conflito Aparelho aaaa-mm-dd HHmm).md` (em inglês, `conflict`).
- Exclusão vai para `.lixeira`; se a nota mudou antes da exclusão chegar, ela é mantida.
- Renomeações ficam registradas por 30 dias: uma edição enviada para o nome antigo é aplicada no nome novo (resposta com `movedTo`).
- Histórico: no máximo uma versão a cada 5 minutos por nota, até 100 versões e 180 dias, sempre as 10 mais recentes. Acompanha renomeações.
- Anexos: imagens e PDFs até 25 MB. Colados offline ficam no aparelho e sobem com o caminho escolhido por ele; arquivo igual já existente é reaproveitado, diferente ganha sufixo. Imagens citadas nas notas são pré-carregadas (até 10 MB cada, 150 MB por vault).
- A interface consulta `/api/status` e recarrega sozinha quando o servidor passa a entregar uma interface nova.

## API

Todas as rotas exigem `Authorization: Bearer <token>`, exceto `status`, `pair` e `setup`. O token nunca vai na URL. Alterações exigem a mesma origem (cabeçalho `Origin` ou `Sec-Fetch-Site`). Erros do servidor vêm como códigos estáveis (`{"error": "pick-folder"}`), traduzidos pela interface.

| Rota | Função |
| --- | --- |
| `GET /api/status` | nome, modo, assistente, se o token vale, administrador, versão da interface, endereço pelo nome (`hostUrl`) |
| `POST /api/pair` `{invite, deviceName, transfer}` | pareia com convite (sem convite em localhost); aparelho conectado tem o acesso atualizado; `transfer` usa um convite de transferência |
| `POST /api/transfer` | convite de transferência para o próprio aparelho |
| `GET /api/setup/browse?path=&code=`, `POST /api/setup` | assistente de primeira execução |
| `GET /api/vaults` | vaults liberados para o aparelho |
| `GET /api/v/{vault}/manifest` | pastas, notas (com versão) e anexos |
| `POST /api/v/{vault}/fetch` `{paths}` | conteúdo de várias notas |
| `POST /api/v/{vault}/sync` `{ops}` | aplica as operações da fila |
| `GET /api/v/{vault}/raw?path=` | imagem ou PDF do vault |
| `POST /api/v/{vault}/attachment?name=` ou `?path=` | salva imagem ou PDF (até 25 MB), em `anexos/` ou no caminho dado |
| `GET /api/v/{vault}/history?path=`, `GET .../history/version?path=&id=` | versões de uma nota e o texto de uma versão |
| `GET /api/admin/browse?path=` | subpastas do computador do servidor, para escolher a pasta de um vault |
| `POST`, `PATCH`, `DELETE /api/admin/vaults[/{id}]` | cria, renomeia e tira vaults da lista |
| `POST /api/admin/invite` `{vaults, admin}` | gera convite |
| `GET`, `PATCH`, `DELETE /api/admin/devices[/{id}]` | lista aparelhos e agentes, muda acesso, remove |
| `POST /api/admin/agents` `{name, vaults}` | cria token de agente (somente leitura) |
| `GET`, `PATCH /api/admin/server` `{name, mode}` | nome e modo do servidor (mudar o modo reinicia) |
| `POST /api/admin/quit` | encerra o Cube4Notes (só no próprio computador) |
| `GET`, `POST`, `DELETE /mcp` | MCP para agentes ([docs/06-agentes-de-ia.md](../docs/06-agentes-de-ia.md)); em HTTP só de localhost |
| `GET /cube4notes-ca.cer`, `/cube4notes-ca.pem` | autoridade certificadora (também em HTTP, porta 43124) |

## Estrutura

```text
Program.cs                 início, rede, rotas
src/Configuracao.cs        config.json, migração, validação de pastas de vault
src/Vaults.cs              operações de arquivo de cada vault (versão, conflito, lixeira, renomeações, anexos)
src/Historico.cs           histórico de versões de cada nota (.cube4notes/historico)
src/Aparelhos.cs           aparelhos, agentes, convites, limite de tentativas
src/Rede.cs                segurança de Host/Origem, caminhos, endereços da rede local
src/Tls.cs                 autoridade certificadora local e certificado do servidor
src/Mdns.cs                responde por <computador>-notes.local na rede local (mDNS)
src/Firewall.cs            regras do Firewall do Windows (portas e mDNS), só para a rede local
src/Mcp.cs                 acesso somente leitura para agentes de IA (MCP)
src/Interface.cs           entrega a interface embutida no executável
src/Janela.cs              janela do app (Photino) em processo separado
src/Bandeja.cs             ícone perto do relógio no Windows (API do Windows)
src/Idioma.cs              língua das mensagens do programa (a do sistema)
Cube4Notes.csproj          projeto
gerar-executavel.cmd/.sh   executável independente (Windows / Linux e macOS)
instalar-servico.sh        serviço do systemd num Linux sem tela
wwwroot/                   interface compilada (versionada)
web/                       código-fonte da interface (TypeScript + Vite + Milkdown)
dev/                       servidor de teste em Node e testes (abaixo)
seguranca/                 bateria de testes de segurança (Python, sem dependências)
SEGURANCA.md               revisão OWASP e riscos conhecidos
```

### Interface (`web/src`)

```text
main.ts        telas, editor, barra lateral, painel, preferências, aparelhos
store.ts       IndexedDB, fila offline, sincronização, anexos, API
editor.ts      Milkdown (Crepe), textos em português, envio de anexos
links.ts       links Markdown relativos e reescrita ao renomear
props.ts       propriedades (YAML simples) e tags
tipos.ts       tipos, modelos, relações e listas por tipo
conjuntos.ts   conjuntos prontos de modelos (português e inglês)
i18n.ts        textos da interface (português e inglês)
termtheme.ts   temas de cores (Cube4Themes)
```

Para alterar a interface: `cd web`, `npm ci`, `npm run build` (compila para `wwwroot/`, que deve ser commitado junto). Durante o desenvolvimento, `npm run dev` com o servidor rodando na porta 43125 em HTTP (modo *Só este computador* ou `--sem-https`), ou `node dev/mock-server.mjs --config <pasta> --port 43125` sem compilar o .NET.

## Testes

```bash
python dev/teste_executavel.py dist/<plataforma>/Cube4Notes   # o executável real, como um usuário novo
python dev/teste_sync.py                                      # sincronização adversarial (dois aparelhos, offline, conflitos)
python dev/teste_offline.py                                   # app aberto e editado sem servidor
python dev/teste_recursos.py                                  # links, anexos, histórico, tags, modelos, relações, agentes
python dev/teste_endereco.py                                  # troca para o endereço pelo nome
python dev/teste_idioma.py                                    # nenhum texto da outra língua na interface
python dev/teste_mdns.py <computador>                         # resposta pelo nome na rede (rodar na rede de casa)
python seguranca/teste_seguranca.py --lan https://<ip>:43125  # bateria de segurança contra um servidor rodando
python ../scripts/check_project.py ..                         # estrutura e links da documentação
```

Os testes da interface usam Playwright e o servidor de teste em Node (`dev/mock-server.mjs`), que implementa a mesma API. Todos, menos `teste_mdns` e `teste_seguranca`, rodam no GitHub a cada push na `main` e em cada pull request ([ci.yml](../.github/workflows/ci.yml)).
