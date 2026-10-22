# ADR 0009: HTTPS com uma autoridade certificadora criada pelo próprio Cube4Notes

- Status: aceita (registrada depois da implementação)
- Data: 2026-10-20

## Contexto

Os aparelhos falam com o servidor pela rede de casa, sem internet. Navegadores só permitem service worker (app offline), área de transferência e armazenamento persistente em contexto seguro (HTTPS ou `localhost`). Certificados de autoridades públicas exigem um domínio na internet, o que contraria a regra de não depender de serviço externo. Tokens de aparelho e de agente não podem trafegar em texto aberto.

## Decisão

- No modo *Rede de casa*, o Cube4Notes cria uma autoridade certificadora própria na primeira execução, restrita a nomes locais e IPs privados (Name Constraints), e guarda na pasta de configuração.
- Ela assina o certificado do servidor, que cobre `localhost`, o nome do computador, `<computador>-notes.local` e os IPs privados atuais. O certificado é guardado e refeito sozinho quando os endereços mudam.
- Cada aparelho instala a autoridade uma vez. Ela é entregue em HTTP comum (porta 43124), em `.cer` e `.pem`, porque precisa ser baixada antes de ser confiável. Fora isso, a porta 43124 só redireciona para HTTPS; a única exceção é `/mcp` para agentes no próprio computador (`localhost`), cujo token não sai da máquina.
- No Windows do próprio servidor, a autoridade é adicionada à confiança do usuário, com a confirmação do Windows.
- O modo *Só este computador* usa HTTP em `localhost`, que os navegadores já tratam como seguro.

## Alternativas

- HTTP na rede local: o app não funcionaria offline e os tokens trafegariam em texto aberto.
- Certificado autoassinado por servidor: exigiria aceitar um aviso por endereço, e o aviso voltaria a cada troca de IP.
- Domínio público com Let's Encrypt e DNS apontando para IP privado: depende de internet, de um domínio e de um serviço externo.

## Consequências

- Instalar o certificado é um passo obrigatório por aparelho, documentado por sistema no README.
- Se a autoridade mudar (pasta `tls` apagada, outra pasta de configuração, outro computador), todos os aparelhos precisam reinstalar.
- Programas em Node.js e Python não usam a confiança do sistema; por isso a autoridade também é entregue em PEM ([06-agentes-de-ia.md](../06-agentes-de-ia.md)).
