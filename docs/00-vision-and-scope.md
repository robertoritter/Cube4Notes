# Visão e escopo

## O problema

Ferramentas de notas costumam obrigar a uma escolha ruim. Uma opção é guardar tudo na nuvem de uma empresa. A outra é configurar sincronização, servidores e plugins, e torcer para o celular não perder o que foi escrito offline. Além disso, escrever Markdown "na mão" afasta quem só quer escrever.

O Cube4Notes parte de três ideias:

1. **As notas são arquivos seus.** Markdown comum, numa pasta comum, legível por qualquer editor e por qualquer programa.
2. **O computador de casa é o servidor.** Nada passa pela internet: os aparelhos falam direto com o computador que guarda as notas, pela rede local.
3. **Cada aparelho funciona sozinho.** Celular, tablet e outros computadores guardam uma cópia completa e continuam funcionando longe de casa; quando voltam, sincronizam sem perder nada.

## Para quem é

- Quem quer notas em vários aparelhos sem conta, assinatura ou nuvem.
- Quem quer edição visual (títulos, listas, tabelas, imagens) sem decorar sintaxe, mas com os arquivos continuando em Markdown portável.
- Quem usa agentes de IA e quer que eles consultem as notas sem dar a eles acesso ao disco.
- Quem não tem servidor em casa: o mesmo executável roda no próprio computador, no modo *Só este computador*.

## O que o Cube4Notes é

- Um único executável que guarda as notas, serve a interface web e sincroniza os aparelhos da rede de casa.
- Um editor visual de Markdown que funciona no navegador do computador, do celular e do tablet, e também offline.
- Vários vaults (qualquer pasta pode ser um), com acesso escolhido por aparelho.
- Links entre notas, tipos, modelos e relações, tags e propriedades, histórico de versões, anexos offline.
- Acesso somente leitura para agentes de IA, por MCP.

## O que o Cube4Notes não é (por decisão)

- **Não é um serviço na nuvem** e não abre acesso pela internet: sem túnel, relay, abertura de portas ou conta.
- **Não é colaborativo em tempo real.** Cada aparelho edita a sua cópia; edições simultâneas na mesma nota viram uma cópia de conflito para juntar, nunca uma perda.
- **Não sincroniza aparelhos entre si.** O servidor é o ponto de encontro.
- **Não tem plugins nem compatibilidade com ecossistemas de outros editores.** Os arquivos são Markdown padrão; qualquer editor abre.
- **Agentes não escrevem.** O acesso de IA é só leitura.
- **Não tem app nativo para iPhone, iPad ou Android.** O cliente móvel é a interface web, instalável na tela inicial e com uso offline.

## Princípios que guiam as decisões

- Nenhuma alteração é descartada em silêncio. Conflito vira cópia, exclusão vai para a lixeira, edição em nota renomeada segue a nota.
- Fácil de instalar em qualquer ambiente: um executável, sem banco, proxy ou containers. Sem configuração manual por máquina.
- Segurança é requisito do núcleo: HTTPS com autoridade própria, token por aparelho, convites de uso único, só rede local.
- Sempre compila e roda no Windows, no Linux e no macOS (`net10.0`), verificado no CI.
- Documentação explícita sobre o que pode dar errado (rede, IP, certificado), sem esconder limites.

Decisões detalhadas: [`docs/adr`](adr/README.md). Estado atual e próximos passos: [02-status-and-roadmap.md](02-status-and-roadmap.md).
