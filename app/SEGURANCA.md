# Revisão de segurança (OWASP Top 10)

Data: 19/10/2026, revista em 21/10/2026 (links, anexos offline, histórico, agentes de IA). Escopo: servidor `Program.cs`, interface `web/` e o contrato da API. Método: revisão de código item a item do OWASP Top 10, correções e uma bateria automatizada de ataques (`seguranca/teste_seguranca.py`, hoje 101 verificações sobre HTTPS, incluindo vaults, permissões por aparelho e tokens de agente) mais testes de navegador para injeção de script.

**Como os testes foram rodados:** a bateria passou 66/66 (sobre HTTPS), depois dos vaults 73/73 e, com agentes, anexos, histórico e troca de endereço, 101/101 sobre HTTPS contra o servidor de teste `dev/mock-server.mjs`, que implementa as mesmas regras do servidor .NET. O ambiente onde isto foi escrito não alcança a rede da casa, então a bateria **ainda precisa rodar no computador do servidor, contra o servidor .NET** (instruções no fim).

## Achados e correções

| OWASP | Problema encontrado | Correção |
| --- | --- | --- |
| A01 Controle de acesso | **DNS rebinding**: um site malicioso aberto no computador do servidor podia se passar por `localhost`, parear sozinho (localhost dispensa código) e ler todas as notas. | O servidor só aceita os nomes `localhost`, `127.0.0.1`, o nome do computador e os IPs locais dele; qualquer outro `Host` recebe 421. |
| A01 | **CSRF**: outra página podia disparar escritas. | Toda requisição que não é leitura precisa vir da mesma origem (`Origin`/`Sec-Fetch-Site`); senão 403. |
| A01 | Código de 6 dígitos válido durante toda a execução, para qualquer número de aparelhos, exibido no console. | Substituído por **convite de uso único** (QR code com 144 bits aleatórios, ou código curto de 6 caracteres para digitar), válido por 5 minutos, gerado só no computador do servidor. O código curto tem cerca de 1 bilhão de combinações e cada endereço só pode errar 10 vezes a cada 10 minutos. |
| A01 | Não havia como tirar o acesso de um aparelho. | Lista de aparelhos com **Remover**; o token deixa de valer na hora. Gerar convites e gerenciar aparelhos e vaults só por aparelho **administrador** (o do assistente de primeira execução, o próprio computador do servidor ou quem recebeu convite de administrador). |
| A01 | Caminhos: faltava barrar nomes reservados do Windows (`CON`, `AUX`, `COM1`...), caminhos de rede `\\servidor\...` e caracteres inválidos no Linux. | Validação única: nada absoluto, nada fora da pasta, nada oculto, sem `..`, sem atalhos/junções, sem nomes reservados, limites de tamanho. |
| A02 Criptografia | **Tráfego em HTTP puro** na rede local: notas e token visíveis para quem capturasse o Wi-Fi. Além disso, o Chrome recente força `https://` e não conseguia conectar. | **HTTPS** na porta principal, TLS 1.2 ou superior (1.0/1.1 recusados), com autoridade certificadora própria criada no computador. A autoridade tem **restrição de nomes** (só `localhost`, `*.local`, o nome do computador e IPs privados): conferido que um certificado falso para `www.google.com` ou `8.8.8.8`, mesmo assinado por ela, é recusado. Codificação conferida byte a byte com uma biblioteca de referência. |
| A02 | Token ia na URL das imagens (`?t=`), aparecendo em histórico e logs. | Token só no cabeçalho `Authorization`; imagens são baixadas com `fetch` e exibidas como blob local. |
| A03 Injeção (XSS) | Um anexo `.html` ou `.svg` enviado por um aparelho seria servido na mesma origem e poderia roubar tokens dos outros aparelhos. | Anexos só `png jpg gif webp avif bmp pdf`, até 25 MB; arquivos servidos com `Content-Security-Policy: sandbox`; o que não é imagem/PDF vai como download. |
| A03 | Ctrl+clique abria qualquer esquema de link, inclusive `javascript:`. | Só abre `http`, `https` e `mailto`. |
| A03 | (verificado, sem falha) HTML dentro da nota. | O editor mostra HTML como texto; nenhum script, `onerror` ou `iframe` é criado. Testado no navegador. |
| A04 Design inseguro | Sem limites de lote. | Máximo 500 operações por sincronização, 500 leituras por pedido, nota até 10 MB, corpo até 32 MB, cabeçalhos até 32 KB. |
| A05 Configuração | Faltavam cabeçalhos de proteção. | `Content-Security-Policy` sem scripts externos ou inline, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, `COOP`/`CORP`, `Permissions-Policy`; API com `no-store`. |
| A05 / A09 | Erros devolviam a mensagem da exceção (com caminhos completos do disco). | Resposta genérica `server error`; o detalhe só aparece no console do servidor. |
| A06 Componentes | 4 alertas de baixa gravidade na biblioteca KaTeX (fórmulas), que vem junto com o editor. | Recurso de fórmulas desligado e versão forçada para a corrigida: `npm audit` sem vulnerabilidades. O servidor não usa pacotes externos, só o .NET. |
| A07 Autenticação | Sem proteção contra força bruta no pareamento por rede. | 10 convites errados bloqueiam aquele endereço por 10 minutos (429). Tokens de 256 bits, guardados só como SHA-256, comparados em tempo constante. |
| A08 Integridade | (verificado) | Gravação atômica de notas e da lista de aparelhos; nenhuma alteração é descartada (conflito vira cópia, exclusão vai para `.lixeira`). |
| A09 Registro | Tentativas suspeitas não apareciam. | Console registra Host/Origem recusados, convites inválidos, bloqueios, aparelhos conectados e removidos, com limite para não inundar. |
| A10 SSRF | (não se aplica) | O servidor não faz requisições para fora. |
| A01 | (novo, 21/10) Agentes de IA precisavam ler notas sem receber o poder de um aparelho. | Token próprio de agente, **somente leitura** e com lista de vaults obrigatória: nunca é administrador (nem no próprio computador), qualquer método que não seja leitura na API recebe 403, não troca o acesso por convite e só lê pelo `/mcp` os vaults liberados. Da rede, `/mcp` só em HTTPS (HTTP redireciona); em HTTP só no próprio computador. `/mcp` passa pelas mesmas regras de Host, Origem e rede local. |
| A01 | (novo, 21/10) Anexo enviado com caminho escolhido pelo aparelho (anexos colados offline). | Mesmo validador de caminhos das notas; só tipos de imagem e PDF (nunca `.md`); arquivo existente nunca é sobrescrito (ganha sufixo); temporário oculto até terminar. |
| A01 | (novo, 21/10) Aparelho que passa a usar o endereço pelo nome do computador precisava de acesso no novo endereço sem novo QR. | Convite de transferência criado só pelo próprio aparelho autenticado, de uso único, válido por 5 minutos e preso àquele aparelho: dá um token a mais ao mesmo aparelho (no máximo 5 extras), com o mesmo acesso. Não serve como convite comum, e convite comum não serve como transferência. Remover o aparelho invalida todos os tokens dele. |
| A01 | (novo, 21/10) Histórico de versões lido por caminho e id. | Caminho validado como nota; id só no formato de data (`yyyyMMdd-HHmmss-fff`), sem como montar caminho para fora de `.cube4notes/historico`. |

## Riscos que continuam (conscientes)

- **Chave da autoridade local sem senha** em `%LOCALAPPDATA%\Cube4Notes\tls` (pasta do usuário). Quem tiver acesso a ela poderia se passar pelo servidor **só em endereços locais**, graças à restrição de nomes. Aparelhos que não instalaram o certificado aceitam a conexão depois do aviso do navegador, sem proteção contra quem se passar pelo servidor na rede; instale o certificado.
- **Quem usa o próprio computador do servidor é administrador.** O `localhost` pareia sem convite e gerencia aparelhos. Qualquer programa rodando nesse computador já teria acesso aos arquivos, então isso não amplia o risco.
- **Administrador vale pelo token, não pelo endereço.** Um aparelho administrador continua administrador de qualquer ponto da rede local (necessário para configurar uma máquina sem tela). Dê convite de administrador só a aparelhos seus; os demais recebem só os vaults escolhidos.
- **O administrador escolhe qualquer pasta do computador do servidor como vault.** Raiz do disco, pastas do sistema, a pasta de configuração e pastas dentro de outro vault são recusadas; o restante é decisão do administrador.
- **Aparelhos pareados são confiáveis para escrever.** Um aparelho comprometido pode alterar notas (sempre com cópia em conflito e lixeira, nunca apagando de vez). Para tirar o acesso: Remover.
- **Token guardado no navegador do aparelho** (IndexedDB). A CSP reduz o risco de um script roubá-lo; se o aparelho for perdido, remova-o na lista.
- **Regra de firewall por porta.** No modo Rede de casa, o Windows libera as portas 43124 e 43125 só para a sub-rede local (`remoteip=localsubnet`), em qualquer perfil de rede, para o celular conectar mesmo que o Windows classifique o Wi-Fi como público. O servidor continua recusando qualquer endereço fora da rede local. Regras antigas presas ao caminho do `.exe` são apagadas, porque uma regra de bloqueio do programa venceria a liberação.
- **Token de agente dá leitura de tudo o que foi liberado.** Quem copiar o token lê aqueles vaults de dentro da rede de casa. Libere só o necessário e remova o agente quando não usar mais. O console registra cada ferramenta usada por cada agente.
- **Anexos e histórico guardados sem limite de espaço total.** O histórico fica limitado a 100 versões por nota e 180 dias; anexos guardados no aparelho, a 150 MB de pré-carga por vault (o que for aberto fica guardado).
- **Nome do computador na rede (`<nome>.local`).** Qualquer máquina da rede pode responder por esse nome, mas a conexão exige o certificado da autoridade do Cube4Notes deste computador, que nenhuma outra máquina tem; o token também não vale em outro servidor. O firewall do Windows passa a aceitar as perguntas de nome (UDP 5353) só da sub-rede local.
- **Notas sem criptografia em disco** no servidor e nos aparelhos; depende da proteção do próprio sistema (BitLocker, bloqueio do celular).

## Rodar a bateria no computador do servidor

Com o servidor rodando, num terminal na pasta `app`:

```powershell
python seguranca\teste_seguranca.py --lan https://<ip-do-computador>:43125
```

`--lan` é o endereço de rede do próprio computador do servidor: o servidor enxerga essas requisições como vindas de outro aparelho. O teste de força bruta bloqueia esse endereço por 10 minutos (o `localhost` continua funcionando); para pular, acrescente `--sem-forca-bruta`. O teste cria e remove dois aparelhos de teste, manda a pasta `_teste_seguranca` para a `.lixeira` e deixa um `anexos/fora.png` que pode ser apagado.

O teste baixa o certificado pela porta 43124 e verifica a cadeia de verdade. Para uma varredura externa adicional, dá para apontar o OWASP ZAP (modo baseline) para `https://localhost:43125`.
