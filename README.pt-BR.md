# Cube4Notes

**Suas notas em Markdown no seu próprio computador, e em todos os seus aparelhos. Mesmo offline.**

O Cube4Notes é um app de notas que guarda tudo como arquivos Markdown comuns num computador que é seu, oferece um editor visual moderno e leva as mesmas notas para o celular, o tablet e outros computadores, sem nenhum serviço de nuvem no meio.

![Editor do Cube4Notes](docs/images/editor-light.png)

> **Estado: protótipo funcionando.** O uso diário no Windows e no iPhone está em validação. Pode haver mudanças incompatíveis. English version: [README.md](README.md).

## Não precisa de servidor

O Cube4Notes roda **localmente, no computador que você já usa**. Basta rodar, e as notas ficam numa pasta desse computador. Não há servidor para comprar, rede para configurar nem conta para criar.

- **Só este computador.** Escolha *Só este computador* no assistente da primeira execução. O Cube4Notes atende só nesse computador, sem nada exposto na rede. Funciona como qualquer app de notas de desktop.
- **Qualquer outro aparelho que você quiser.** Escolha *Rede de casa*, e o mesmo computador passa a entregar as notas ao celular, tablet ou notebook pelo Wi-Fi. Leia um QR code em cada aparelho e pronto. Não há mais nada para instalar.
- **Uma máquina dedicada, só se você quiser.** Se preferir, rode o Cube4Notes numa máquina sempre ligada (um PC antigo, um mini PC, um Linux). As notas são arquivos comuns: mudar de um arranjo para outro é apontar o Cube4Notes para a mesma pasta.

Os aparelhos sincronizam com o computador quando estão na mesma rede que ele. Longe dele, cada aparelho continua funcionando com a cópia completa e sincroniza ao voltar. O Cube4Notes nunca expõe as notas à internet.

## Destaques

- **Markdown puro no disco.** Notas são arquivos `.md` comuns em pastas comuns. Sem banco de dados, sem formato próprio, nada para exportar.
- **Editor visual.** O Markdown vira formatação enquanto você digita: títulos, listas de tarefas, tabelas, blocos de código com destaque de sintaxe, imagens. `Ctrl+/` alterna para o Markdown puro. As edições geram diferenças pequenas e limpas.
- **Offline em primeiro lugar.** Cada aparelho guarda todas as notas a que tem acesso. Leia, crie, edite, renomeie, mova e exclua sem conexão; as alterações entram numa fila e sincronizam depois.
- **Nenhuma perda silenciosa.** Se a mesma nota mudou em dois lugares, uma versão fica e a outra é salva como `Nota (conflito Aparelho data).md`, com comparação lado a lado. Exclusões vão para a pasta `.lixeira`. Edições numa nota renomeada em outro aparelho seguem para o nome novo.
- **Vários vaults.** Qualquer pasta pode ser um vault. Cada aparelho acessa só os vaults que você escolher.
- **Conectar aparelho por QR code**, ou por um código de 6 caracteres. Convites são de uso único e valem 5 minutos. Ler um convite novo num aparelho já conectado atualiza o acesso dele. O acesso de um aparelho pode ser retirado na hora.
- **HTTPS local sem complicação.** No modo *Rede de casa* o Cube4Notes cria a própria autoridade certificadora, restrita a `localhost`, `*.local`, ao nome do computador e a IPs privados, então ela não serve para falsificar sites da internet.
- **Aplicativo de verdade.** O Cube4Notes abre numa janela própria, com o motor web do sistema (WebView2 no Windows, WebKit no Linux e no macOS). No modo *Rede de casa*, fechar a janela deixa ele rodando perto do relógio para os outros aparelhos continuarem sincronizando; o ícone reabre ou encerra. Máquinas sem tela rodam como servidor no console.
- **Links entre notas.** Digite `[[` para escolher a nota e o Cube4Notes grava um link Markdown padrão (`[Nota](pasta/Nota.md)`), que continua funcionando em qualquer editor. Renomeie ou mova uma nota, pasta ou anexo e todos os links acompanham. `Ctrl`+clique (ou um toque na tela) abre; link para nota que ainda não existe oferece criá-la.
- **Imagens e PDFs, também offline.** Cole ou arraste na nota. Ficam guardados no aparelho na hora, sobem quando o servidor responde, e as imagens usadas nas notas ficam em todos os aparelhos para aparecer longe de casa.
- **Histórico de versões.** Antes de uma nota ser sobrescrita, o texto anterior fica guardado no servidor (no máximo uma versão a cada 5 minutos de edição, até 100 por nota). Compare qualquer versão com o texto atual e restaure; restaurar nunca perde o texto atual.
- **Tags e propriedades.** `#tags` no texto ou na propriedade `tags:`, painel de tags e filtros na busca como `#projeto` ou `status:aberto`. As propriedades (YAML no topo da nota) são editadas como campos; YAML elaborado escrito à mão não é mexido.
- **Modelos, tipos e relações.** Modelos são notas comuns na pasta `modelos/` (`templates/` também vale), com tipo, campos, tags e a pasta onde a nota nova vai; conjuntos prontos (Trabalho, Pessoal, Leituras, Estudos, Projetos de software, Jogos de tabuleiro) ajudam a começar. Um campo que nomeia outra nota (`empresa: Empresa Y`) é uma relação: abra a empresa e veja as pessoas e reuniões agrupadas por tipo, ou a lista de todas as empresas com os campos como colunas, contadores de relações e último contato. Nota do dia a um clique (`Alt+D`). No celular, as relações aparecem abaixo da nota e as listas viram cartões. Tudo calculado no aparelho, também offline.
- **Acesso somente leitura para agentes de IA (MCP).** Dê a um agente, como o Claude Code, um token próprio, só de leitura, para os vaults escolhidos. Ele lista, busca e lê notas por MCP, nunca escreve, e só de dentro da sua rede.
- **Navegação rápida.** Abas, árvore de pastas com arrastar e soltar, `Ctrl+K` para abrir notas e comandos, busca no conteúdo, painel de estrutura e de links para a nota.
- **53 temas de terminal** (Dracula, Nord, Gruvbox, Solarized, Catppuccin, Tokyo Night...) além de claro, escuro e sépia, vindos do [Cube4Themes](https://github.com/robertoritter/Cube4Themes). Interface em português e inglês (escolhida em cada aparelho, em Preferências); o ícone ao lado do relógio, os avisos do Windows e o console seguem a língua do sistema, e os conjuntos de modelos são criados na língua da interface.

| Celular | Vaults | Tema de terminal |
| --- | --- | --- |
| ![Celular](docs/images/mobile-editor.png) | ![Troca de vault](docs/images/vaults.png) ![Lateral no celular](docs/images/mobile-tree.png) | ![Tema Tokyo Night](docs/images/editor-dark.png) |

## Como começar (Windows)

Requisito: [.NET 10 SDK](https://dotnet.microsoft.com/download), ou o `Cube4Notes.exe` independente (veja abaixo), que não precisa de nada instalado.

1. Dê dois cliques no `Cube4Notes.exe` (ou, a partir do código, em `app/iniciar.cmd`).
2. O Cube4Notes abre numa janela própria de aplicativo (sem navegador e sem console). Na primeira execução, um assistente pergunta três coisas:
   - onde você vai usar: *Só este computador* ou *Rede de casa*;
   - a pasta do primeiro vault (qualquer pasta; se não existir, é criada, e arquivos `.md` que já estiverem nela aparecem como notas);
   - o nome deste aparelho.
3. Na primeira execução o Windows pede uma vez para confiar no certificado do Cube4Notes: aceite (ele só vale para endereços locais). No modo *Rede de casa* o Cube4Notes pede ao Windows, uma vez (confirmação de administrador), para abrir as duas portas dele, e as perguntas pelo nome, só para a rede local. Se um dia o celular parar de conectar, clique com o botão direito no ícone perto do relógio e escolha *Liberar no firewall*.

Para conectar celular ou tablet: abra **Preferências > Conectar aparelho**, escolha os vaults que ele pode acessar e leia o QR code. Depois leia [Como os aparelhos acham o seu computador](#como-os-aparelhos-acham-o-seu-computador-leia-antes-de-conectar-o-celular), para o roteador trocar o IP do computador sem deixar o celular sem servidor. Para o navegador parar de mostrar o aviso e o app abrir sem conexão, instale o certificado no aparelho uma vez: veja [Instalar o certificado](#instalar-o-certificado-no-celular-no-tablet-e-em-outros-computadores).

Tudo pode ser mudado depois em **Preferências > Vaults e servidor**: adicionar, renomear ou tirar vaults da lista, e trocar entre *Só este computador* e *Rede de casa* quando quiser.

Configurar uma máquina sem tela: inicie o Cube4Notes nela, abra `https://<ip-dela>:43125` em outro aparelho da mesma rede e digite o código de configuração mostrado no console.

### Executável independente

`app/gerar-executavel.cmd` gera um `Cube4Notes.exe` independente em `app/dist/win-x64`, que roda em qualquer Windows sem .NET. É um arquivo único, com a interface embutida: copie para onde quiser e dê dois cliques.

### Opções de linha de comando

| Opção | Efeito |
| --- | --- |
| `--config <pasta>` | Pasta da configuração (padrão `%LOCALAPPDATA%\Cube4Notes`) |
| `--port <número>` | Porta (padrão 43125; no modo *Rede de casa* a porta anterior redireciona HTTP para HTTPS) |
| `--notes <pasta>` | Importa uma pasta de notas como o vault "Notas" (atualização a partir do primeiro protótipo) |
| `--sem-janela` | Servidor no console, sem janela (para máquinas sem tela) |
| `--sem-navegador` | No modo console, não abre o navegador ao iniciar |
| `--sem-https` | HTTP simples na rede (só para testes) |
| `--sem-instalar-certificado` | Não adiciona o certificado à confiança do Windows |
| `--sem-nome-na-rede` | Não responder por `<nome-do-computador>-notes.local` na rede local |

## Como os aparelhos acham o seu computador (leia antes de conectar o celular)

O Cube4Notes nunca passa pela internet. O celular ou tablet conversa direto com o computador que guarda as notas, pelo Wi-Fi de casa. Por isso o **endereço** do computador importa, e vale saber como funciona.

**Dois tipos de endereço**

- **Pelo IP**, por exemplo `https://192.168.0.10:43125`. Funciona sempre na rede de casa, em qualquer aparelho. O problema: a maioria dos roteadores distribui os IPs sozinha e pode dar outro ao computador depois (`192.168.0.11`). Um aparelho que ainda aponta para o IP antigo deixa de achar o servidor, e o app fica em "Sem servidor".
- **Pelo nome**, por exemplo `https://meu-pc-notes.local:43125` (o nome do computador seguido de `-notes.local`). O aparelho pergunta à rede local "quem é meu-pc-notes.local?" e o Cube4Notes responde com o IP atual do computador. É o mesmo mecanismo (mDNS, também chamado Bonjour) que o celular usa para achar impressoras e caixas de som AirPlay. Quando o IP muda, o nome continua funcionando.

  Por que `-notes` e não só `meu-pc.local`? O sistema operacional também pode responder por `meu-pc.local`, e às vezes com o endereço de uma VPN ou placa de rede virtual que o celular não alcança. Com um nome só dele, só o Cube4Notes responde, sempre com o endereço da rede de casa.

**O que o Cube4Notes faz**

1. O QR code usa o IP, porque funciona em qualquer aparelho.
2. Logo depois de conectar, o app testa se este aparelho também acha o computador pelo nome. Se achar, oferece passar a usar o nome. A troca mantém o mesmo acesso do aparelho (sem QR novo), envia antes as alterações pendentes e baixa as notas de novo no endereço novo, então nada se perde. Também dá para fazer depois em **Preferências > Usar o nome do computador como endereço**.
3. No iPhone e no iPad, um site adicionado à Tela de Início pertence a um endereço. Depois da troca, adicione o Cube4Notes de novo à Tela de Início e apague o ícone antigo.

**O `meu-pc-notes.local` é sempre o meu computador, em qualquer rede?** Não, e tudo bem. Quem responde pelo nome é quem estiver na rede em que você está naquele momento:

- em casa, o seu computador responde;
- em outra rede (rua, escritório, dados móveis) ninguém responde, e o app simplesmente funciona offline, como sempre funciona longe de casa;
- se outra rede tiver um computador com o mesmo nome, o app mesmo assim se recusa a conectar: a conexão usa HTTPS com um certificado criado pelo seu próprio computador, que nenhuma outra máquina consegue apresentar. O token do aparelho também só vale no seu servidor.

**Onde o nome pode não funcionar**

- Wi-Fi de visitantes e redes que isolam os aparelhos bloqueiam essas perguntas pelo nome. Uma rede comum de casa permite.
- O Android resolve nomes `.local` de forma irregular, conforme a versão e o navegador. iPhone, iPad, macOS, Windows e Linux resolvem bem.
- O próprio Cube4Notes responde pelo nome, então não depende de o sistema fazer isso (o Windows muitas vezes não faz). No Windows ele também cria uma regra de firewall para as perguntas pelo nome (UDP 5353, só rede local) junto com a regra das portas dele. No Linux, se o `avahi-daemon` estiver rodando, ele já responde pelo nome do computador e o Cube4Notes deixa com ele. Para desligar o nome, inicie o Cube4Notes com `--sem-nome-na-rede`.
- Dois computadores com o mesmo nome na mesma rede confundem a resposta. Dê nomes diferentes a eles.

**A opção mais robusta: IP fixo.** Nas configurações do roteador, procure *reserva de DHCP* (também chamada *IP fixo* ou *concessão estática*) e reserve o IP atual para o computador que roda o Cube4Notes. Assim o IP e o nome funcionam para sempre, em qualquer aparelho, inclusive Android.

**Se um aparelho perdeu o servidor depois que o IP mudou:** reserve o IP antigo no roteador (o app volta com tudo, inclusive alterações feitas no aparelho que ainda não tinham subido), ou leia o QR code de novo (o aparelho baixa as notas de novo; alterações feitas nele que não subiram ficam no app antigo até o IP antigo voltar).

## Instalar o certificado no celular, no tablet e em outros computadores

No modo *Rede de casa* o Cube4Notes usa HTTPS com uma **autoridade certificadora criada no seu próprio computador**, que só vale para nomes locais e IPs privados. O computador do servidor confia nela sozinho. Cada outro aparelho precisa instalá-la **uma vez**; sem isso o navegador mostra avisos, o app não fica guardado no aparelho para usar longe de casa e a troca para o endereço pelo nome (veja acima) falha sem avisar.

O certificado fica sempre disponível, em HTTP comum para poder ser baixado antes de ser confiável, em `http://<ip-do-computador>:43124/cube4notes-ca.cer` (a porta é uma abaixo da do app). As mesmas instruções aparecem em **Preferências > Conectar aparelho**.

- **iPhone / iPad** (use o Safari; outros navegadores do iOS não instalam certificados):
  1. abra o endereço acima e permita o download;
  2. **Ajustes > Geral > VPN e Gerenciamento de Dispositivo**: instale o perfil "Cube4Notes CA (<nome do computador>)";
  3. **Ajustes > Geral > Sobre > Ajustes de Confiança de Certificados**: ligue a confiança total no "Cube4Notes CA". Esse último passo é fácil de esquecer e, sem ele, nada muda.
- **Android**: baixe o arquivo e vá em **Configurações > Segurança > Criptografia e credenciais > Instalar um certificado > Certificado CA**, escolha o arquivo e reabra o navegador. Os nomes dos menus variam conforme o fabricante.
- **Outro computador com Windows**: abra o arquivo e instale em *Autoridades de Certificação Raiz Confiáveis*. **macOS**: abra no Acesso às Chaves e marque *Sempre Confiar*. **Linux**: copie para o repositório do sistema (`/usr/local/share/ca-certificates/` e `update-ca-certificates` no Debian/Ubuntu); o Firefox pode precisar importar nas configurações dele.

**Sinais de que o aparelho não confia no certificado atual**

- O Safari ou o Chrome mostra *Não seguro* (*Not Secure*) ou um aviso de certificado ao lado do endereço.
- A barra de endereço pisca ou volta para a tela de busca depois de ler o QR code.
- O app não abre longe de casa, ou o Cube4Notes nunca oferece o endereço pelo nome.

**Quando a autoridade certificadora muda, todos os aparelhos precisam instalar de novo.** Ela é criada uma vez e fica na pasta de configuração (`%LOCALAPPDATA%\Cube4Notes\tls` no Windows). Ela é criada de novo se essa pasta for apagada, se o Cube4Notes rodar com outra pasta `--config`, ou em outro computador. Nesse caso, em cada aparelho, remova antes o perfil/certificado antigo e instale o novo. O nome do certificado mostra de qual computador ele é: "Cube4Notes CA (<nome do computador>)".

Só a *autoridade* precisa ser instalada. O certificado do próprio servidor é renovado sozinho quando os endereços do computador mudam, e os aparelhos que confiam na autoridade o aceitam sem fazer nada.

## Plataformas

| Plataforma | Estado |
| --- | --- |
| Windows | Funcionando, em validação diária |
| iPhone / iPad (Safari, app na tela inicial) | Funcionando, em validação diária |
| Android, outros navegadores de computador | Devem funcionar, ainda não validados |
| Linux | Multiplataforma por construção (`net10.0`); script de compilação, CI e serviço em andamento |
| macOS | Planejado; compilado e testado só em CI |

## Princípios

- As notas são suas, num formato que qualquer editor abre.
- Só local: o Cube4Notes é acessível no computador onde roda e, se você ativar, na sua própria rede. Sem acesso externo, sem túnel, sem nuvem.
- Segurança faz parte do núcleo: token próprio por aparelho (guardado só como hash), verificação de Host e Origem, regras rígidas para anexos, revisão OWASP Top 10 ([app/SEGURANCA.md](app/SEGURANCA.md)).
- Fácil de configurar em qualquer ambiente: assistente no navegador na primeira execução, sem arquivos de configuração para editar à mão.

## Estrutura do repositório

```text
app/                        Cube4Notes (servidor, interface web, testes)
  Program.cs, src/          servidor: API mínima em .NET 10
  web/                      código-fonte da interface: TypeScript, Vite, Milkdown
  wwwroot/                  interface compilada, entregue pelo servidor
  dev/mock-server.mjs       servidor em Node com a mesma API, para desenvolver a interface e testar
  dev/teste_sync.py         testes maldosos de sincronização (dois aparelhos simulados)
  seguranca/                bateria de testes de segurança (OWASP Top 10)
services/api/               primeiro protótipo de servidor
apps/, packages/, services/mcp/   componentes planejados (cliente web, editor, contratos, integração com agentes)
docs/                       visão, arquitetura, plano de entrega, pesquisa e decisões
```

Mapa da documentação:

- [`docs/00-visao-e-escopo.md`](docs/00-visao-e-escopo.md): problema, público, escopo e limites.
- [`docs/01-arquitetura.md`](docs/01-arquitetura.md): componentes, fluxos, segurança e ambientes.
- [`docs/02-plano-de-entrega.md`](docs/02-plano-de-entrega.md): fases e critérios de saída.
- [`docs/05-cenarios-de-uso.md`](docs/05-cenarios-de-uso.md): cenário doméstico e aparelhos.
- [`docs/03-licenciamento.md`](docs/03-licenciamento.md): alternativas de licença comparadas; decisão em [`docs/adr/0002-licenca-mit.md`](docs/adr/0002-licenca-mit.md).
- [`docs/04-pesquisa-e-evidencias.md`](docs/04-pesquisa-e-evidencias.md): fontes externas.
- [`AGENTS.md`](AGENTS.md): protocolo operacional obrigatório.
- [`app/README.md`](app/README.md): referência técnica do app (API, configuração, testes).

## Desenvolvimento

```bash
cd app/web
npm install
npm run build        # compila a interface para app/wwwroot
npm run dev          # servidor de desenvolvimento; rode o Cube4Notes na porta 43125 junto
```

Testes (Python 3; os de sincronização também precisam do Playwright):

```bash
python app/dev/teste_sync.py                                   # cenários maldosos de sincronização
python app/seguranca/teste_seguranca.py --lan https://<ip>:43125   # bateria de segurança contra um servidor rodando
python scripts/check_project.py                                # verificação da estrutura do repositório
```

## Próximos passos

- Script de compilação e CI no Linux (toda versão precisa compilar também no Linux)
- Instalar como serviço (serviço do Windows, systemd, launchd) e achar o servidor pelo nome na rede
- Histórico automático opcional de cada vault com Git

## Licença

O Cube4Notes é open source, sob a [licença MIT](LICENSE). Os nomes Cube4Notes e Cube4Code e as logos não são cobertos pela licença.

---

Desenvolvido por **Roberto Ritter** na [Cube4Code](https://cube4code.com).
