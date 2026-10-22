# ADR 0006: Endereço pelo nome do computador, com o IP como reserva

- Status: aceita
- Data: 2026-10-21

## Contexto

Os aparelhos guardam o app, as notas offline e o token por endereço (origem do navegador). O QR code levava o IP do computador. Quando o roteador deu outro IP ao computador, o celular continuou procurando o IP antigo e ficou em "Sem servidor"; para o navegador, o IP novo é outro site, sem notas e sem pareamento.

## Decisão

- O QR continua usando o IP, que funciona em qualquer aparelho.
- O servidor informa em `/api/status` o endereço pelo nome (`https://<nome-do-computador>-notes.local:<porta>/`), coberto pelo certificado local. O sufixo `-notes` evita disputar o nome com o próprio sistema: no primeiro teste real, o Windows respondia por `<computador>.local` com o endereço de uma VPN, que o celular não alcança.
- Num aparelho que usa o IP, o app testa se alcança o nome (carregando o ícone do servidor pelo endereço com nome; só esse arquivo aceita ser carregado de outra origem). Se alcança, oferece a troca. A troca envia antes as alterações pendentes e usa um **convite de transferência**: de uso único, válido por 5 minutos, criado pelo próprio aparelho autenticado e preso a ele, que dá um token a mais ao mesmo aparelho no endereço novo. Nada é duplicado e o acesso continua o mesmo.
- O próprio servidor responde pelo nome na rede local (mDNS), porque o Windows muitas vezes não responde por `<nome>.local` ou responde com o endereço errado. Responde só ao próprio nome, só a endereços da rede local e só com IPs locais.
- O firewall do Windows passa a aceitar também as perguntas pelo nome (mDNS, UDP 5353), só da sub-rede local.
- A documentação explica os dois tipos de endereço, os limites do nome e recomenda reservar o IP no roteador.

## Alternativas

- QR com o nome: falharia nos aparelhos que não resolvem `.local` (vários Android, redes de visitantes).
- Procurar o servidor varrendo a rede quando o IP muda: lento, e o app no endereço antigo não teria como usar o servidor no endereço novo (outra origem, sem dados).
- Servidor de nomes ou serviço externo: contraria a regra de nunca depender da internet.

## Consequências

- Aparelhos que resolvem `.local` (iPhone, iPad, macOS, Windows, Linux) deixam de depender do IP.
- No iPhone e no iPad, o atalho da Tela de Início precisa ser recriado depois da troca.
- Android e redes que bloqueiam mDNS continuam pelo IP; para esses, a recomendação é reservar o IP no roteador.
- Remover o aparelho invalida todos os tokens dele, de todos os endereços.
- O nome só funciona se o aparelho confiar no certificado do Cube4Notes. Se a autoridade mudar (pasta `tls` apagada, outra configuração, outro computador), cada aparelho precisa remover o certificado antigo e instalar o novo; o README explica o passo a passo por sistema.
