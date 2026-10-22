# Cenários de uso

Os cenários que o Cube4Notes precisa atender e como cada um funciona hoje.

## 1. Computador na rede de casa

O Cube4Notes roda no computador que guarda as notas (o do próprio usuário ou um servidor sempre ligado). Outro computador da casa abre `https://<ip-do-servidor>:43125` no navegador, conecta uma vez pelo QR code ou pelo código de 6 caracteres e edita com a mesma interface. Não precisa montar o disco do servidor nem instalar nada além do certificado.

## 2. Celular ou tablet em casa

O aparelho lê o QR code, instala o certificado uma vez e, se quiser, adiciona o Cube4Notes à tela inicial. A interface é pensada para toque: barra de formatação, menu de blocos com `/`, relações abaixo da nota e listas em cartões. Passo a passo: [Conectar um celular](../README.pt-BR.md#conectar-um-celular-passo-a-passo).

## 3. Celular ou tablet longe de casa

O servidor não é alcançável de fora, por decisão. O aparelho continua com a cópia completa dos vaults liberados: abre, edita, cria e organiza notas e pastas, cola imagens e PDFs. Tudo fica guardado no aparelho e sobrevive a fechar e reabrir o app.

## 4. Volta para casa

Ao alcançar o servidor, cada aparelho envia a sua fila de alterações e recebe as dos outros. Alterações em notas diferentes simplesmente se juntam. Se a mesma nota mudou no aparelho e no servidor, as duas versões ficam: a do servidor no lugar e a do aparelho como cópia de conflito, com aviso. Nada é descartado em silêncio. Detalhes: [arquitetura, sincronização](01-arquitetura.md#sincronização).

## 5. Servidor desligado ou sempre ligado

Com o servidor desligado, cada aparelho trabalha na sua cópia; os aparelhos não sincronizam entre si. Com um servidor sempre ligado (por exemplo um Linux rodando o Cube4Notes como serviço), ele fica disponível o tempo todo dentro de casa. "Sempre ligado" não significa acessível pela internet.

## 6. O roteador troca o IP do computador

Os aparelhos guardam o endereço do servidor. Se o roteador der outro IP ao computador, eles deixam de achá-lo. A solução recomendada é reservar o IP no roteador; como alternativa, o Cube4Notes responde pelo nome `<computador>-notes.local` e oferece a troca para esse endereço. Explicação completa: [Como os aparelhos acham o seu computador](../README.pt-BR.md#como-os-aparelhos-acham-o-seu-computador).

## 7. Agente de IA consultando as notas

Um agente num computador da casa lê as notas pelo MCP, com um token que só lê e só alcança os vaults escolhidos. Ele nunca recebe acesso ao disco nem altera notas. Configuração: [06-agentes-de-ia.md](06-agentes-de-ia.md).

## 8. Sem servidor em casa

Quem tem um computador só usa o modo *Só este computador*: o mesmo executável, sem rede, sem certificado e sem firewall. Dá para mudar para *Rede de casa* depois, em Preferências, sem perder nada.
