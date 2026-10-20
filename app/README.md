# Cube4Notes: referência técnica do app

Visão geral do produto, como instalar e usar: [README.pt-BR.md](../README.pt-BR.md) (em inglês: [README.md](../README.md)). Este arquivo é a referência para quem mexe no código.

## Rodar

- Windows: `iniciar.cmd` (compila e roda com o .NET 10 SDK). Equivale a `dotnet run -c Release` nesta pasta.
- Verificar se compila sem rodar: `compilar.cmd` (resultado em `compilar.log`).
- Executável independente para Windows: `gerar-executavel.ps1` (saída em `dist\win-x64`). A interface (`wwwroot`) vai embutida no executável como recurso, então o `.exe` é um arquivo único.
- O projeto mira `net10.0`, nunca `net10.0-windows`: o que é específico do Windows (confiar no certificado) fica atrás de verificação do sistema em tempo de execução.

## Configuração

Tudo fica numa pasta de configuração (padrão `%LOCALAPPDATA%\Cube4Notes`, ou `--config <pasta>`):

```text
config.json     nome do servidor, modo, porta e lista de vaults
devices.json    aparelhos conectados (só o hash do token), administrador e vaults liberados
tls/            autoridade certificadora local e certificado do servidor (modo Rede de casa)
```

- Sem `config.json`, o servidor inicia no **assistente de primeira execução**. No próprio computador não pede código; de outro aparelho, pede o código mostrado no console.
- **Modos:** `pessoal` (Só este computador: escuta só em localhost, HTTP, sem certificado) e `rede` (Rede de casa: HTTPS na porta 43125 e HTTP na 43124, que só redireciona e entrega o certificado). Trocar o modo grava a configuração e reinicia o servidor dentro do mesmo processo.
- **Vaults:** qualquer pasta, exceto a raiz do disco, pastas do sistema, a pasta de configuração e pastas dentro de outro vault. Cada vault tem um id estável usado nas rotas (ex.: "Trabalho 2026" vira `trabalho-2026`). Tirar um vault da lista não apaga a pasta.
- **Migração:** se existir a configuração da versão de uma pasta só (`pasta-de-notas.txt` ou `--notes`), ela vira o vault `notas` e os aparelhos antigos continuam valendo. No navegador, as notas e a fila offline da versão antiga são migradas para esse vault sem perdas.
- Arquivos internos de cada vault ficam em `<vault>/.cube4notes/` (registro de renomeações) e `<vault>/.lixeira/`.

Opções: `--config`, `--port`, `--notes`, `--sem-navegador`, `--sem-https`, `--sem-instalar-certificado`.

## Aparelhos e permissões

- O aparelho que conclui o assistente é administrador. No próprio computador do servidor (localhost), o pareamento é automático e também é administrador.
- Os outros aparelhos entram por convite (QR com 144 bits, ou código curto de 6 caracteres; uso único; 5 minutos). O convite define os vaults liberados e se o aparelho pode administrar.
- Um aparelho já conectado que lê um convite novo tem o acesso trocado pelo do convite, sem virar outro aparelho.
- Administrador gerencia vaults, aparelhos, convites e o modo do servidor. Os demais só acessam os vaults liberados.
- Cada aparelho guarda offline todos os vaults liberados (um IndexedDB por vault). Vault que deixa de ser liberado some da tela; alterações pendentes nele ficam guardadas no aparelho.

## Sincronização

- Cópia local em IndexedDB e fila de operações (`put`, `delete`, `mkdir`, `rmdir`, `move`) com versão-base (SHA-256 do conteúdo).
- Conflito: o servidor mantém a versão dele e grava a do aparelho como `Nome (conflito Aparelho aaaa-mm-dd HHmm).md`.
- Exclusão vai para `.lixeira`; se a nota mudou antes da exclusão chegar, ela é mantida.
- Renomeações ficam registradas por 30 dias: uma edição enviada para o nome antigo é aplicada no nome novo (resposta com `movedTo`) em vez de recriar a nota.
- A interface consulta `/api/status` e recarrega sozinha quando o servidor passa a entregar uma interface nova.

## API

Todas as rotas exigem `Authorization: Bearer <token>`, exceto `status`, `pair` e `setup`. O token nunca vai na URL.

| Rota | Função |
| --- | --- |
| `GET /api/status` | nome, modo, se está no assistente, se o token vale, se é administrador, versão da interface |
| `POST /api/pair` `{invite, deviceName}` | pareia com convite (sem convite em localhost); aparelho já conectado tem o acesso atualizado |
| `GET /api/setup/browse?path=&code=`, `POST /api/setup` | assistente de primeira execução |
| `GET /api/vaults` | vaults liberados para o aparelho |
| `GET /api/v/{vault}/manifest` | pastas e notas com versão |
| `POST /api/v/{vault}/fetch` `{paths}` | conteúdo de várias notas |
| `POST /api/v/{vault}/sync` `{ops}` | aplica as operações da fila |
| `GET /api/v/{vault}/raw?path=` | imagem ou PDF do vault (outros tipos baixam como arquivo) |
| `POST /api/v/{vault}/attachment?name=` | salva imagem ou PDF (até 25 MB) em `anexos/` |
| `GET /api/admin/browse?path=` | lista subpastas do computador do servidor, para escolher a pasta de um vault |
| `POST`, `PATCH`, `DELETE /api/admin/vaults[/{id}]` | cria, renomeia e tira vaults da lista |
| `POST /api/admin/invite` `{vaults, admin}` | gera convite |
| `GET`, `PATCH`, `DELETE /api/admin/devices[/{id}]` | lista aparelhos, muda acesso, remove |
| `GET`, `PATCH /api/admin/server` `{name, mode}` | nome e modo do servidor (mudar o modo reinicia) |

## Estrutura

```text
Program.cs                 início, rede, rotas
src/Configuracao.cs        config.json, migração, validação de pastas de vault
src/Vaults.cs              operações de arquivo de cada vault (versão, conflito, lixeira, renomeações)
src/Aparelhos.cs           aparelhos, convites, registro de renomeações, limite de tentativas
src/Rede.cs                segurança de Host/Origem, validação de caminhos, endereços da rede local
src/Tls.cs                 autoridade certificadora local e certificado do servidor
Cube4Notes.csproj          projeto
wwwroot/                   interface compilada
web/                       código-fonte da interface (TypeScript + Vite + Milkdown)
dev/mock-server.mjs        servidor de teste em Node com a mesma API, só para desenvolvimento
dev/teste_sync.py          testes maldosos de sincronização (Playwright)
seguranca/                 bateria de testes de segurança (Python, sem dependências)
SEGURANCA.md               revisão OWASP e riscos conhecidos
```

Para alterar a interface: `cd web`, `npm install`, `npm run build` (recompila para `wwwroot/`). Durante o desenvolvimento, `npm run dev` com o servidor rodando na porta 43125, ou `node dev/mock-server.mjs --config <pasta> --port 43125` sem compilar o .NET.

## Testes

```bash
python dev/teste_sync.py                                          # 18 verificações de sincronização
python seguranca/teste_seguranca.py --lan https://<ip>:43125      # 73 verificações de segurança
```

A bateria de segurança passou 73/73 no servidor de teste em Node; ainda precisa rodar contra o servidor .NET.

## O que ainda falta

- Validação no Linux (Debian) e script de compilação com CI.
- Histórico de versões além da lixeira e das cópias de conflito.
- Autocompletar `[[links]]` ao digitar (hoje são reconhecidos nos backlinks).
